import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType } from '@prisma/client';
import { CompanyRepository } from '../company/company.repository';
import { ConversationRepository } from './repositories/conversation.repository';
import { PrismaService } from '../../database/prisma.service';
import { MarketingDirectorAgent } from './marketing-director.agent';
import { AgentExecutionResult, AgentStreamEventType } from '../agent-engine/base/agent-engine.types';
import { CONVERSATION_HISTORY_LIMIT } from '../agent-engine/agent-engine.constants';
import { MemoryService } from '../agent-engine/memory/memory.service';
import { BudgetGuardService } from '../agent-engine/budget/budget-guard.service';
import { AuditService } from '../audit/audit.service';

export interface RunAgentInput {
  companyId: string;
  userId: string;
  conversationId?: string;
  message: string;
  model?: string;
}

export interface RunAgentOutput {
  conversationId: string;
  response: string;
  traceId: string;
  agentExecutionId: string;
  estimatedCostUsd: number;
  totalLatencyMs: number;
  iterations: number;
  pendingApprovalId?: string;
}

@Injectable()
export class MarketingAgentService {
  private readonly logger = new Logger(MarketingAgentService.name);

  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly conversationRepo: ConversationRepository,
    private readonly memoryService: MemoryService,
    private readonly agent: MarketingDirectorAgent,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly budgetGuard: BudgetGuardService,
  ) {}

  async run(input: RunAgentInput): Promise<RunAgentOutput> {
    // 1. Verify company membership (never trust companyId from client)
    const member = await this.companyRepo.findMemberInCompany(input.companyId, input.userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }

    // 2. Find or create conversation (tenant-safe: findById verifies companyId)
    let conversationId: string;
    if (input.conversationId) {
      const existing = await this.conversationRepo.findById(input.companyId, input.conversationId);
      if (!existing) {
        throw new NotFoundException('Conversation not found');
      }
      conversationId = existing.id;
    } else {
      const conv = await this.conversationRepo.create(
        input.companyId,
        input.userId,
        AgentType.DIRECTOR,
        this.extractConversationTitle(input.message),
      );
      conversationId = conv.id;
    }

    // 3. Load conversation history
    const history = await this.conversationRepo.getHistory(
      conversationId,
      CONVERSATION_HISTORY_LIMIT,
    );

    // 4. Load company context (Tier 2 memory)
    const company = await this.companyRepo.findById(input.companyId);
    const knowledge = await this.memoryService.getCompanyKnowledge(input.companyId);

    // 5. Enforce budget limits if configured
    await this.budgetGuard.assertWithinBudget(input.companyId);

    // 6. Persist user message
    await this.conversationRepo.addMessage(conversationId, 'user', input.message);

    // 7. Execute agent
    const model = input.model ?? this.config.get<string>('AI_MODEL', 'claude-opus-5');
    let result: AgentExecutionResult;
    try {
      result = await this.agent.execute({
        companyId: input.companyId,
        userId: input.userId,
        conversationId,
        conversationHistory: history,
        userMessage: input.message,
        model,
        additionalContext: {
          company: {
            id: company?.id ?? input.companyId,
            name: company?.name ?? 'Unknown Company',
            industry: company?.industry,
            website: company?.website,
            knowledge,
          },
        },
      });
    } catch (err) {
      this.logger.error(`Agent execution error: ${String(err)}`);
      throw err;
    }

    // 8. Persist assistant response
    await this.conversationRepo.addMessage(
      conversationId,
      'assistant',
      result.response,
      result.traceResult.totalOutputTokens,
    );

    // 9. Increment conversation cost
    await this.conversationRepo.incrementCost(
      conversationId,
      result.traceResult.estimatedCostUsd,
    );

    // 10. Auto-generate title from first AI response if conversation has none
    if (!input.conversationId) {
      const autoTitle = this.generateTitle(result.response);
      await this.conversationRepo.updateTitle(input.companyId, conversationId, autoTitle);
    }

    return {
      conversationId,
      response: result.response,
      traceId: result.traceResult.traceId,
      agentExecutionId: result.traceResult.agentExecutionId,
      estimatedCostUsd: result.traceResult.estimatedCostUsd,
      totalLatencyMs: result.traceResult.totalLatencyMs,
      iterations: result.traceResult.iterations,
      pendingApprovalId: result.pendingApprovalId,
    };
  }

  async runStream(
    input: RunAgentInput,
    onEvent: (event: AgentStreamEventType) => void,
  ): Promise<RunAgentOutput> {
    const member = await this.companyRepo.findMemberInCompany(input.companyId, input.userId);
    if (!member || !member.isActive) throw new ForbiddenException('Access denied to this company');

    let conversationId: string;
    if (input.conversationId) {
      const existing = await this.conversationRepo.findById(input.companyId, input.conversationId);
      if (!existing) throw new NotFoundException('Conversation not found');
      conversationId = existing.id;
    } else {
      const conv = await this.conversationRepo.create(
        input.companyId, input.userId, AgentType.DIRECTOR, this.extractConversationTitle(input.message),
      );
      conversationId = conv.id;
    }

    const history = await this.conversationRepo.getHistory(conversationId, CONVERSATION_HISTORY_LIMIT);
    const company = await this.companyRepo.findById(input.companyId);
    const knowledge = await this.memoryService.getCompanyKnowledge(input.companyId);

    await this.budgetGuard.assertWithinBudget(input.companyId);

    await this.conversationRepo.addMessage(conversationId, 'user', input.message);

    const model = input.model ?? this.config.get<string>('AI_MODEL', 'claude-opus-5');
    const result = await this.agent.executeStream(
      {
        companyId: input.companyId,
        userId: input.userId,
        conversationId,
        conversationHistory: history,
        userMessage: input.message,
        model,
        additionalContext: {
          company: { id: company?.id ?? input.companyId, name: company?.name ?? 'Unknown Company', industry: company?.industry, website: company?.website, knowledge },
        },
      },
      onEvent,
    );

    await this.conversationRepo.addMessage(conversationId, 'assistant', result.response, result.traceResult.totalOutputTokens);
    await this.conversationRepo.incrementCost(conversationId, result.traceResult.estimatedCostUsd);

    if (!input.conversationId) {
      const autoTitle = this.generateTitle(result.response);
      await this.conversationRepo.updateTitle(input.companyId, conversationId, autoTitle);
    }

    return {
      conversationId,
      response: result.response,
      traceId: result.traceResult.traceId,
      agentExecutionId: result.traceResult.agentExecutionId,
      estimatedCostUsd: result.traceResult.estimatedCostUsd,
      totalLatencyMs: result.traceResult.totalLatencyMs,
      iterations: result.traceResult.iterations,
      pendingApprovalId: result.pendingApprovalId,
    };
  }

  async listConversations(companyId: string, userId: string) {
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }
    return this.conversationRepo.listByCompany(companyId, userId);
  }

  async renameConversation(companyId: string, conversationId: string, userId: string, title: string) {
    await this.verifyConversationOwnership(companyId, conversationId, userId);
    const result = await this.conversationRepo.rename(companyId, conversationId, title.trim().slice(0, 200));
    void this.auditService.log({ companyId, userId, action: 'CONVERSATION_RENAMED', resource: 'conversation', resourceId: conversationId, after: { title } });
    return result;
  }

  async archiveConversation(companyId: string, conversationId: string, userId: string) {
    await this.verifyConversationOwnership(companyId, conversationId, userId);
    const result = await this.conversationRepo.archive(companyId, conversationId);
    void this.auditService.log({ companyId, userId, action: 'CONVERSATION_ARCHIVED', resource: 'conversation', resourceId: conversationId });
    return result;
  }

  async deleteConversation(companyId: string, conversationId: string, userId: string): Promise<void> {
    await this.verifyConversationOwnership(companyId, conversationId, userId);
    await this.conversationRepo.delete(companyId, conversationId);
    void this.auditService.log({ companyId, userId, action: 'CONVERSATION_DELETED', resource: 'conversation', resourceId: conversationId });
  }


  private async verifyConversationOwnership(companyId: string, conversationId: string, userId: string): Promise<void> {
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) throw new ForbiddenException('Access denied to this company');
    const conv = await this.conversationRepo.findById(companyId, conversationId);
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId !== userId) throw new ForbiddenException('You do not own this conversation');
  }

  private generateTitle(aiResponse: string): string {
    const stripped = aiResponse
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/`[^`]+`/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length <= 80) return stripped;
    const sentence = stripped.match(/^[^.!?]+[.!?]/)?.[0];
    if (sentence && sentence.length <= 80) return sentence.trim();
    return stripped.slice(0, 77) + '...';
  }

  private extractConversationTitle(message: string): string {
    const trimmed = message.trim();
    if (trimmed.length <= 60) return trimmed;
    return trimmed.slice(0, 57) + '...';
  }
}

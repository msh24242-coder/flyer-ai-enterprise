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
import { MarketingDirectorAgent } from './marketing-director.agent';
import { AgentExecutionResult, AgentStreamEventType } from '../agent-engine/base/agent-engine.types';
import { CONVERSATION_HISTORY_LIMIT } from '../agent-engine/agent-engine.constants';
import { MemoryService } from '../agent-engine/memory/memory.service';

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

    // 5. Persist user message
    await this.conversationRepo.addMessage(conversationId, 'user', input.message);

    // 6. Execute agent
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

    // 7. Persist assistant response
    await this.conversationRepo.addMessage(
      conversationId,
      'assistant',
      result.response,
      result.traceResult.totalOutputTokens,
    );

    // 8. Increment conversation cost
    await this.conversationRepo.incrementCost(
      conversationId,
      result.traceResult.estimatedCostUsd,
    );

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
    // Verify membership before listing
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }
    return this.conversationRepo.listByCompany(companyId, userId);
  }

  private extractConversationTitle(message: string): string {
    const trimmed = message.trim();
    if (trimmed.length <= 60) return trimmed;
    return trimmed.slice(0, 57) + '...';
  }
}

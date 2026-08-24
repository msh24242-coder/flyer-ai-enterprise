import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanonicalMessage, CanonicalContentBlock } from '../../../common/types/canonical.types';
import { IAIProvider } from '../providers/ai/ai-provider.interface';
import { IEmbeddingProvider } from '../providers/embedding/embedding-provider.interface';
import { MemoryService } from '../memory/memory.service';
import { ApprovalEngineService } from '../approval/approval-engine.service';
import { ObservabilityTracerService } from '../observability/observability-tracer.service';
import { AgentOrchestratorService } from '../orchestration/agent-orchestrator.service';
import { AI_PROVIDER, EMBEDDING_PROVIDER, MAX_AGENT_ITERATIONS, CONVERSATION_HISTORY_LIMIT } from '../agent-engine.constants';
import { AgentToolDefinition, AgentExecutionContext, AgentExecutionResult, AgentIdentity } from './agent-engine.types';
import { ToolCallRecord } from '../observability/observability.types';
import { MemoryType } from '@prisma/client';

export abstract class AgentEngine {
  protected readonly logger: Logger;

  constructor(
    @Inject(AI_PROVIDER) protected readonly aiProvider: IAIProvider,
    @Inject(EMBEDDING_PROVIDER) protected readonly embeddingProvider: IEmbeddingProvider,
    protected readonly memoryService: MemoryService,
    protected readonly approvalEngine: ApprovalEngineService,
    protected readonly tracer: ObservabilityTracerService,
    protected readonly orchestrator: AgentOrchestratorService,
    protected readonly config: ConfigService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  abstract getIdentity(): AgentIdentity;
  abstract buildSystemPrompt(context: AgentExecutionContext): Promise<string>;
  abstract defineTools(): AgentToolDefinition[];

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const identity = this.getIdentity();
    const model = context.model ?? this.config.get<string>('AI_MODEL', 'claude-opus-5');

    const traceCtx = this.tracer.createTrace({
      agentType: identity.agentType,
      companyId: context.companyId,
      userId: context.userId,
      conversationId: context.conversationId,
      model,
    });

    const systemPrompt = await this.buildSystemPrompt(context);
    const tools = this.defineTools();
    const canonicalTools = tools.map((t) => t.tool);

    const recentHistory = context.conversationHistory.slice(-CONVERSATION_HISTORY_LIMIT);
    const userTurn: CanonicalMessage = {
      role: 'user',
      content: [{ type: 'text', text: context.userMessage }],
    };
    const messages: CanonicalMessage[] = [...recentHistory, userTurn];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iterations = 0;
    const toolCallRecords: ToolCallRecord[] = [];
    let finalResponse = '';
    let pendingApprovalId: string | undefined;

    try {
      while (iterations < MAX_AGENT_ITERATIONS) {
        iterations++;

        const response = await this.aiProvider.complete({
          model,
          system: systemPrompt,
          messages,
          tools: canonicalTools,
          maxTokens: 8192,
        });

        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;

        const assistantMessage = response.messages[0];
        messages.push(assistantMessage);

        if (response.stopReason === 'end_turn') {
          const textBlock = assistantMessage.content.find((b) => b.type === 'text');
          finalResponse = textBlock ? (textBlock as { type: 'text'; text: string }).text : '';
          break;
        }

        if (response.stopReason === 'tool_use') {
          const toolResultBlocks: CanonicalContentBlock[] = [];

          for (const block of assistantMessage.content) {
            if (block.type !== 'tool_use') continue;

            const toolDef = tools.find((t) => t.tool.name === block.name);
            if (!toolDef) {
              toolResultBlocks.push({
                type: 'tool_result',
                toolUseId: block.id,
                content: `Unknown tool: ${block.name}`,
                isError: true,
              });
              continue;
            }

            const toolStart = Date.now();
            const approvalResult = await this.approvalEngine.check({
              toolName: block.name,
              permissionLevel: toolDef.permissionLevel,
              companyId: context.companyId,
              userId: context.userId,
              agentExecutionId: traceCtx.traceId,
              input: block.input,
            });

            if (approvalResult.outcome === 'PENDING') {
              pendingApprovalId = approvalResult.approvalRequestId;
              finalResponse = `Action "${block.name}" requires human approval before proceeding. Approval request ID: ${pendingApprovalId}`;

              const traceResult = await this.tracer.finalizeTrace(traceCtx, {
                totalInputTokens,
                totalOutputTokens,
                iterations,
                toolCalls: toolCallRecords,
                finalStatus: 'PENDING_APPROVAL',
              });

              return { response: finalResponse, traceResult, pendingApprovalId };
            }

            if (approvalResult.outcome === 'DENIED') {
              toolResultBlocks.push({
                type: 'tool_result',
                toolUseId: block.id,
                content: `Permission denied: ${approvalResult.reason}`,
                isError: true,
              });

              toolCallRecords.push({
                toolCallId: block.id,
                toolName: block.name,
                input: block.input,
                output: null,
                isError: true,
                durationMs: Date.now() - toolStart,
                permissionLevel: toolDef.permissionLevel,
                wasApproved: false,
              });
              continue;
            }

            let toolOutput: unknown;
            let toolIsError = false;

            try {
              toolOutput = await toolDef.handler(block.input);
            } catch (err) {
              toolIsError = true;
              toolOutput = err instanceof Error ? err.message : String(err);
              this.logger.error(`Tool ${block.name} failed: ${String(toolOutput)}`);
            }

            const durationMs = Date.now() - toolStart;
            const outputStr = typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput);

            toolCallRecords.push({
              toolCallId: block.id,
              toolName: block.name,
              input: block.input,
              output: toolOutput,
              isError: toolIsError,
              durationMs,
              permissionLevel: toolDef.permissionLevel,
              wasApproved: true,
            });

            toolResultBlocks.push({
              type: 'tool_result',
              toolUseId: block.id,
              content: outputStr,
              isError: toolIsError,
            });
          }

          messages.push({ role: 'user', content: toolResultBlocks });
        }
      }

      if (iterations >= MAX_AGENT_ITERATIONS && !finalResponse) {
        finalResponse = 'Agent reached maximum iteration limit without completing the task.';
      }

      await this.memoryService.enqueueMemoryWrite({
        companyId: context.companyId,
        agentType: identity.agentType,
        memoryType: MemoryType.LESSON,
        content: `User: ${context.userMessage}\nAgent: ${finalResponse}`,
        agentExecutionId: traceCtx.traceId,
        conversationId: context.conversationId,
      });

      const traceResult = await this.tracer.finalizeTrace(traceCtx, {
        totalInputTokens,
        totalOutputTokens,
        iterations,
        toolCalls: toolCallRecords,
        finalStatus: 'COMPLETED',
      });

      return { response: finalResponse, traceResult };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Agent execution failed: ${errorMessage}`);

      const traceResult = await this.tracer.finalizeTrace(traceCtx, {
        totalInputTokens,
        totalOutputTokens,
        iterations,
        toolCalls: toolCallRecords,
        finalStatus: 'FAILED',
        errorMessage,
      });

      return { response: `Execution failed: ${errorMessage}`, traceResult };
    }
  }
}

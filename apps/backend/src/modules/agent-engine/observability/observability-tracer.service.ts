import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PRICING } from '../agent-engine.constants';
import { TraceContext, ToolCallRecord, TraceResult } from './observability.types';

@Injectable()
export class ObservabilityTracerService {
  private readonly logger = new Logger(ObservabilityTracerService.name);

  constructor(private readonly prisma: PrismaService) {}

  createTrace(params: Omit<TraceContext, 'traceId' | 'startedAt'>): TraceContext {
    return {
      traceId: uuidv4(),
      startedAt: new Date(),
      ...params,
    };
  }

  async finalizeTrace(
    ctx: TraceContext,
    data: {
      totalInputTokens: number;
      totalOutputTokens: number;
      iterations: number;
      toolCalls: ToolCallRecord[];
      finalStatus: TraceResult['finalStatus'];
      errorMessage?: string;
    },
  ): Promise<TraceResult> {
    const totalLatencyMs = Date.now() - ctx.startedAt.getTime();
    const estimatedCostUsd = this.calculateCost(
      ctx.model,
      data.totalInputTokens,
      data.totalOutputTokens,
    );

    let executionId: string;
    try {
      const execution = await this.prisma.agentExecution.create({
        data: {
          traceId: ctx.traceId,
          agentType: ctx.agentType,
          companyId: ctx.companyId,
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          model: ctx.model,
          status: data.finalStatus,
          inputTokens: data.totalInputTokens,
          outputTokens: data.totalOutputTokens,
          estimatedCostUsd,
          totalLatencyMs,
          iterations: data.iterations,
          errorMessage: data.errorMessage,
          startedAt: ctx.startedAt,
          completedAt: new Date(),
        },
      });
      executionId = execution.id;

      if (data.toolCalls.length > 0) {
        await this.prisma.toolCallLog.createMany({
          data: data.toolCalls.map((tc) => ({
            agentExecutionId: executionId,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.input as Prisma.InputJsonValue,
            output: tc.output != null ? (tc.output as Prisma.InputJsonValue) : Prisma.JsonNull,
            isError: tc.isError,
            durationMs: tc.durationMs,
            permissionLevel: tc.permissionLevel,
            wasApproved: tc.wasApproved,
          })),
        });
      }
    } catch (err) {
      this.logger.error(`Failed to persist trace ${ctx.traceId}: ${String(err)}`);
      executionId = 'unpersisted-' + ctx.traceId;
    }

    return {
      traceId: ctx.traceId,
      agentExecutionId: executionId,
      totalInputTokens: data.totalInputTokens,
      totalOutputTokens: data.totalOutputTokens,
      estimatedCostUsd,
      totalLatencyMs,
      iterations: data.iterations,
      toolCalls: data.toolCalls,
      finalStatus: data.finalStatus,
      errorMessage: data.errorMessage,
    };
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model];
    if (!pricing) return 0;
    return (inputTokens / 1_000_000) * pricing.inputPerMTok +
      (outputTokens / 1_000_000) * pricing.outputPerMTok;
  }
}

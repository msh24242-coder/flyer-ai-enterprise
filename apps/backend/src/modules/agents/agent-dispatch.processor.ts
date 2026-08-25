import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ModuleRef, ContextIdFactory } from '@nestjs/core';
import { Job } from 'bullmq';
import { AgentType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AgentOrchestratorService } from '../agent-engine/orchestration/agent-orchestrator.service';
import { QUEUE_AGENT_TASKS } from '../agent-engine/agent-engine.constants';
import { AgentExecutionContext } from '../agent-engine/base/agent-engine.types';
import { StrategyAgent } from './strategy/strategy.agent';
import { ContentAgent } from './content/content.agent';
import { ResearchAgent } from './research/research.agent';

interface AgentTaskJobData {
  agentTaskId: string;
  companyId: string;
  targetAgentType: string;
  payload: Record<string, unknown>;
  conversationId?: string;
}

@Processor(QUEUE_AGENT_TASKS)
export class AgentDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentDispatchProcessor.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
    private readonly orchestrator: AgentOrchestratorService,
  ) {
    super();
  }

  async process(job: Job<AgentTaskJobData>): Promise<void> {
    const { agentTaskId, companyId, targetAgentType, payload, conversationId } = job.data;
    this.logger.log(`Processing agent task ${agentTaskId} for ${targetAgentType}`);

    try {
      // Build execution context from task data
      const context: AgentExecutionContext = {
        companyId,
        conversationId,
        conversationHistory: [],
        userMessage: (payload.userMessage as string) ?? JSON.stringify(payload),
        model: (payload.model as string) ?? 'claude-opus-5',
        additionalContext: payload,
      };

      // Resolve the correct agent using a fresh DI context per job
      const contextId = ContextIdFactory.create();
      let result: string;

      if (targetAgentType === AgentType.STRATEGY) {
        const agent = await this.moduleRef.resolve(StrategyAgent, contextId, { strict: false });
        const execResult = await agent.execute(context);
        result = execResult.response;
      } else if (targetAgentType === AgentType.CONTENT) {
        const agent = await this.moduleRef.resolve(ContentAgent, contextId, { strict: false });
        const execResult = await agent.execute(context);
        result = execResult.response;
      } else if (targetAgentType === AgentType.RESEARCH) {
        const agent = await this.moduleRef.resolve(ResearchAgent, contextId, { strict: false });
        const execResult = await agent.execute(context);
        result = execResult.response;
      } else {
        this.logger.warn(`No handler for agent type: ${targetAgentType}`);
        result = `No handler registered for agent type: ${targetAgentType}`;
      }

      await this.orchestrator.markTaskCompleted(agentTaskId, { response: result });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Agent task ${agentTaskId} failed: ${errorMessage}`);
      await this.orchestrator.markTaskFailed(agentTaskId, errorMessage);
      throw err;
    }
  }
}

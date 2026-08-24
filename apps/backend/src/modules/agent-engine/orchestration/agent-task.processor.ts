import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AGENT_TASKS } from '../agent-engine.constants';
import { AgentOrchestratorService } from './agent-orchestrator.service';

interface AgentTaskJobData {
  agentTaskId: string;
  targetAgentType: string;
  payload: Record<string, unknown>;
}

@Processor(QUEUE_AGENT_TASKS)
export class AgentTaskProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentTaskProcessor.name);

  constructor(private readonly orchestrator: AgentOrchestratorService) {
    super();
  }

  async process(job: Job<AgentTaskJobData>): Promise<void> {
    const { agentTaskId, targetAgentType, payload } = job.data;

    this.logger.log(`Processing agent task ${agentTaskId} for ${targetAgentType}`);

    try {
      // Agent implementations will register handlers here in Phase 2+
      // For now, log and mark as completed to validate the queue infrastructure
      this.logger.warn(
        `No handler registered for agent type: ${targetAgentType}. Task ${agentTaskId} queued but not executed.`,
      );
      await this.orchestrator.markTaskCompleted(agentTaskId, {
        note: 'No handler registered yet',
        payload,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Agent task ${agentTaskId} failed: ${errorMessage}`);
      await this.orchestrator.markTaskFailed(agentTaskId, errorMessage);
      throw err;
    }
  }
}

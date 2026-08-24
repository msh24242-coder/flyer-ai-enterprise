import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentType, AgentTaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { QUEUE_AGENT_TASKS } from '../agent-engine.constants';

export interface AgentTaskDispatch {
  companyId: string;
  requestedByAgentType: AgentType;
  targetAgentType: AgentType;
  payload: Record<string, unknown>;
  conversationId?: string;
  parentTaskId?: string;
}

export interface AgentTaskRecord {
  id: string;
  status: AgentTaskStatus;
}

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_AGENT_TASKS) private readonly agentTaskQueue: Queue,
  ) {}

  async dispatch(task: AgentTaskDispatch): Promise<AgentTaskRecord> {
    const record = await this.prisma.agentTask.create({
      data: {
        companyId: task.companyId,
        requestedByAgent: task.requestedByAgentType,
        targetAgent: task.targetAgentType,
        payload: task.payload as Prisma.InputJsonValue,
        conversationId: task.conversationId,
        parentTaskId: task.parentTaskId,
        status: 'QUEUED',
      },
    });

    await this.agentTaskQueue.add(
      'execute-agent-task',
      { agentTaskId: record.id, ...task },
      {
        jobId: record.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    );

    this.logger.log(
      `Dispatched task ${record.id}: ${task.requestedByAgentType} → ${task.targetAgentType}`,
    );

    return { id: record.id, status: record.status };
  }

  async getTaskStatus(taskId: string): Promise<AgentTaskRecord | null> {
    const task = await this.prisma.agentTask.findUnique({
      where: { id: taskId },
      select: { id: true, status: true },
    });
    return task;
  }

  async markTaskCompleted(taskId: string, result: unknown): Promise<void> {
    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        result: result as Prisma.InputJsonValue,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async markTaskFailed(taskId: string, error: string): Promise<void> {
    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: { status: 'FAILED', errorMessage: error },
    });
  }
}

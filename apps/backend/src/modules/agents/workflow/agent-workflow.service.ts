import { Injectable, Logger } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { AgentOrchestratorService, AgentTaskDispatch } from '../../agent-engine/orchestration/agent-orchestrator.service';

export type WorkflowType = 'full_campaign' | 'content_sprint' | 'research_then_strategy';

export interface WorkflowInput {
  companyId: string;
  requestedByUserId: string;
  conversationId?: string;
  userMessage: string;
  model?: string;
}

export interface WorkflowResult {
  workflowType: WorkflowType;
  tasks: Array<{ taskId: string; agentType: AgentType; status: string }>;
}

@Injectable()
export class AgentWorkflowService {
  private readonly logger = new Logger(AgentWorkflowService.name);

  constructor(private readonly orchestrator: AgentOrchestratorService) {}

  /**
   * full_campaign: Research → Strategy → Content
   * Each task passes the prior task's payload as parent context.
   */
  async runFullCampaignWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
    this.logger.log(`Starting full_campaign workflow for company ${input.companyId}`);

    const base: Omit<AgentTaskDispatch, 'targetAgentType' | 'requestedByAgentType'> = {
      companyId: input.companyId,
      conversationId: input.conversationId,
      payload: {
        userMessage: input.userMessage,
        model: input.model ?? 'claude-opus-5',
        workflowType: 'full_campaign',
      },
    };

    const researchTask = await this.orchestrator.dispatch({
      ...base,
      requestedByAgentType: AgentType.DIRECTOR,
      targetAgentType: AgentType.RESEARCH,
    });

    const strategyTask = await this.orchestrator.dispatch({
      ...base,
      requestedByAgentType: AgentType.DIRECTOR,
      targetAgentType: AgentType.STRATEGY,
      parentTaskId: researchTask.id,
      payload: { ...base.payload, parentTaskId: researchTask.id },
    });

    const contentTask = await this.orchestrator.dispatch({
      ...base,
      requestedByAgentType: AgentType.STRATEGY,
      targetAgentType: AgentType.CONTENT,
      parentTaskId: strategyTask.id,
      payload: { ...base.payload, parentTaskId: strategyTask.id },
    });

    return {
      workflowType: 'full_campaign',
      tasks: [
        { taskId: researchTask.id, agentType: AgentType.RESEARCH, status: researchTask.status },
        { taskId: strategyTask.id, agentType: AgentType.STRATEGY, status: strategyTask.status },
        { taskId: contentTask.id, agentType: AgentType.CONTENT, status: contentTask.status },
      ],
    };
  }

  /**
   * content_sprint: Content + Social in parallel
   */
  async runContentSprintWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
    this.logger.log(`Starting content_sprint workflow for company ${input.companyId}`);

    const base: Omit<AgentTaskDispatch, 'targetAgentType' | 'requestedByAgentType'> = {
      companyId: input.companyId,
      conversationId: input.conversationId,
      payload: {
        userMessage: input.userMessage,
        model: input.model ?? 'claude-opus-5',
        workflowType: 'content_sprint',
      },
    };

    const [contentTask, socialTask] = await Promise.all([
      this.orchestrator.dispatch({
        ...base,
        requestedByAgentType: AgentType.DIRECTOR,
        targetAgentType: AgentType.CONTENT,
      }),
      this.orchestrator.dispatch({
        ...base,
        requestedByAgentType: AgentType.DIRECTOR,
        targetAgentType: AgentType.SOCIAL,
      }),
    ]);

    return {
      workflowType: 'content_sprint',
      tasks: [
        { taskId: contentTask.id, agentType: AgentType.CONTENT, status: contentTask.status },
        { taskId: socialTask.id, agentType: AgentType.SOCIAL, status: socialTask.status },
      ],
    };
  }

  /**
   * research_then_strategy: Research → Strategy
   */
  async runResearchThenStrategyWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
    this.logger.log(`Starting research_then_strategy workflow for company ${input.companyId}`);

    const base: Omit<AgentTaskDispatch, 'targetAgentType' | 'requestedByAgentType'> = {
      companyId: input.companyId,
      conversationId: input.conversationId,
      payload: {
        userMessage: input.userMessage,
        model: input.model ?? 'claude-opus-5',
        workflowType: 'research_then_strategy',
      },
    };

    const researchTask = await this.orchestrator.dispatch({
      ...base,
      requestedByAgentType: AgentType.DIRECTOR,
      targetAgentType: AgentType.RESEARCH,
    });

    const strategyTask = await this.orchestrator.dispatch({
      ...base,
      requestedByAgentType: AgentType.RESEARCH,
      targetAgentType: AgentType.STRATEGY,
      parentTaskId: researchTask.id,
      payload: { ...base.payload, parentTaskId: researchTask.id },
    });

    return {
      workflowType: 'research_then_strategy',
      tasks: [
        { taskId: researchTask.id, agentType: AgentType.RESEARCH, status: researchTask.status },
        { taskId: strategyTask.id, agentType: AgentType.STRATEGY, status: strategyTask.status },
      ],
    };
  }
}

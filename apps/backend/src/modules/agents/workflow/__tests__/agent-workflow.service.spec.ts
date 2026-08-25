import { AgentWorkflowService, WorkflowInput } from '../agent-workflow.service';
import { AgentOrchestratorService } from '../../../agent-engine/orchestration/agent-orchestrator.service';
import { AgentType, AgentTaskStatus } from '@prisma/client';

const mockOrchestrator = {
  dispatch: jest.fn(),
} as unknown as jest.Mocked<AgentOrchestratorService>;

function makeTask(id: string, agentType: AgentType) {
  return { id, agentType, status: AgentTaskStatus.QUEUED, companyId: 'co-1' };
}

const baseInput: WorkflowInput = {
  companyId: 'co-1',
  requestedByUserId: 'user-1',
  userMessage: 'Launch Q4 campaign',
};

describe('AgentWorkflowService', () => {
  let service: AgentWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AgentWorkflowService(mockOrchestrator);
  });

  describe('runFullCampaignWorkflow', () => {
    it('dispatches Research → Strategy → Content in sequence', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValueOnce(makeTask('research-1', AgentType.RESEARCH))
        .mockResolvedValueOnce(makeTask('strategy-1', AgentType.STRATEGY))
        .mockResolvedValueOnce(makeTask('content-1', AgentType.CONTENT));

      const result = await service.runFullCampaignWorkflow(baseInput);

      expect(result.workflowType).toBe('full_campaign');
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0]).toMatchObject({ taskId: 'research-1', agentType: AgentType.RESEARCH });
      expect(result.tasks[1]).toMatchObject({ taskId: 'strategy-1', agentType: AgentType.STRATEGY });
      expect(result.tasks[2]).toMatchObject({ taskId: 'content-1', agentType: AgentType.CONTENT });
    });

    it('passes researchTask id as parentTaskId for strategy task', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValueOnce(makeTask('research-id', AgentType.RESEARCH))
        .mockResolvedValueOnce(makeTask('strategy-id', AgentType.STRATEGY))
        .mockResolvedValueOnce(makeTask('content-id', AgentType.CONTENT));

      await service.runFullCampaignWorkflow(baseInput);

      const strategyCall = mockOrchestrator.dispatch.mock.calls[1][0];
      expect(strategyCall.parentTaskId).toBe('research-id');
      expect(strategyCall.targetAgentType).toBe(AgentType.STRATEGY);
    });

    it('passes strategyTask id as parentTaskId for content task', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValueOnce(makeTask('research-id', AgentType.RESEARCH))
        .mockResolvedValueOnce(makeTask('strategy-id', AgentType.STRATEGY))
        .mockResolvedValueOnce(makeTask('content-id', AgentType.CONTENT));

      await service.runFullCampaignWorkflow(baseInput);

      const contentCall = mockOrchestrator.dispatch.mock.calls[2][0];
      expect(contentCall.parentTaskId).toBe('strategy-id');
      expect(contentCall.targetAgentType).toBe(AgentType.CONTENT);
    });

    it('uses default model when model not provided', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValue(makeTask('task-1', AgentType.RESEARCH));

      await service.runFullCampaignWorkflow(baseInput).catch(() => {});

      const firstCall = mockOrchestrator.dispatch.mock.calls[0][0];
      expect(firstCall.payload.model).toBe('claude-opus-5');
    });

    it('uses provided model when specified', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValue(makeTask('task-1', AgentType.RESEARCH));

      await service.runFullCampaignWorkflow({ ...baseInput, model: 'claude-sonnet-5' }).catch(() => {});

      const firstCall = mockOrchestrator.dispatch.mock.calls[0][0];
      expect(firstCall.payload.model).toBe('claude-sonnet-5');
    });

    it('propagates companyId to all dispatched tasks', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValueOnce(makeTask('r', AgentType.RESEARCH))
        .mockResolvedValueOnce(makeTask('s', AgentType.STRATEGY))
        .mockResolvedValueOnce(makeTask('c', AgentType.CONTENT));

      await service.runFullCampaignWorkflow({ ...baseInput, companyId: 'company-xyz' });

      for (const call of mockOrchestrator.dispatch.mock.calls) {
        expect(call[0].companyId).toBe('company-xyz');
      }
    });
  });

  describe('runContentSprintWorkflow', () => {
    it('dispatches Content and Social in parallel (both dispatch calls made)', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValueOnce(makeTask('content-1', AgentType.CONTENT))
        .mockResolvedValueOnce(makeTask('social-1', AgentType.SOCIAL));

      const result = await service.runContentSprintWorkflow(baseInput);

      expect(result.workflowType).toBe('content_sprint');
      expect(result.tasks).toHaveLength(2);
      expect(mockOrchestrator.dispatch).toHaveBeenCalledTimes(2);
    });

    it('returns Content and Social tasks', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValueOnce(makeTask('content-1', AgentType.CONTENT))
        .mockResolvedValueOnce(makeTask('social-1', AgentType.SOCIAL));

      const result = await service.runContentSprintWorkflow(baseInput);

      const taskTypes = result.tasks.map((t) => t.agentType);
      expect(taskTypes).toContain(AgentType.CONTENT);
      expect(taskTypes).toContain(AgentType.SOCIAL);
    });
  });

  describe('runResearchThenStrategyWorkflow', () => {
    it('dispatches Research then Strategy with parent link', async () => {
      mockOrchestrator.dispatch
        .mockResolvedValueOnce(makeTask('res-1', AgentType.RESEARCH))
        .mockResolvedValueOnce(makeTask('str-1', AgentType.STRATEGY));

      const result = await service.runResearchThenStrategyWorkflow(baseInput);

      expect(result.workflowType).toBe('research_then_strategy');
      expect(result.tasks).toHaveLength(2);

      const strategyCall = mockOrchestrator.dispatch.mock.calls[1][0];
      expect(strategyCall.parentTaskId).toBe('res-1');
      expect(strategyCall.requestedByAgentType).toBe(AgentType.RESEARCH);
    });
  });
});

import { AgentWorkflowController } from '../agent-workflow.controller';
import { AgentWorkflowService } from '../agent-workflow.service';
import { AgentOrchestratorService } from '../../../agent-engine/orchestration/agent-orchestrator.service';
import { CompanyService } from '../../../company/company.service';
import { AgentType, AgentTaskStatus } from '@prisma/client';

const COMPANY_ID = 'company-abc';
const USER = { id: 'user-1', email: 'u@example.com', companyId: COMPANY_ID };

const mockWorkflowService = {
  runFullCampaignWorkflow: jest.fn(),
  runContentSprintWorkflow: jest.fn(),
  runResearchThenStrategyWorkflow: jest.fn(),
} as unknown as jest.Mocked<AgentWorkflowService>;

const mockOrchestrator = {
  getTaskStatus: jest.fn(),
} as unknown as jest.Mocked<AgentOrchestratorService>;

const mockCompanyService = {
  getCompany: jest.fn(),
} as unknown as jest.Mocked<CompanyService>;

describe('AgentWorkflowController', () => {
  let controller: AgentWorkflowController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCompanyService.getCompany.mockResolvedValue({ id: COMPANY_ID } as never);
    controller = new AgentWorkflowController(mockWorkflowService, mockOrchestrator, mockCompanyService);
  });

  // ─── triggerWorkflow ──────────────────────────────────────────────────────

  describe('triggerWorkflow — full_campaign', () => {
    it('delegates to runFullCampaignWorkflow and returns result', async () => {
      const workflowResult = {
        workflowType: 'full_campaign',
        tasks: [
          { taskId: 't1', agentType: AgentType.RESEARCH, status: AgentTaskStatus.QUEUED },
          { taskId: 't2', agentType: AgentType.STRATEGY, status: AgentTaskStatus.QUEUED },
          { taskId: 't3', agentType: AgentType.CONTENT, status: AgentTaskStatus.QUEUED },
        ],
      };
      mockWorkflowService.runFullCampaignWorkflow.mockResolvedValue(workflowResult as never);

      const dto = { workflowType: 'full_campaign' as const, message: 'Launch Q4 campaign' };
      const result = await controller.triggerWorkflow(COMPANY_ID, USER as never, dto as never);

      expect(result).toEqual(workflowResult);
      expect(mockWorkflowService.runFullCampaignWorkflow).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        requestedByUserId: USER.id,
        conversationId: undefined,
        userMessage: 'Launch Q4 campaign',
        model: undefined,
      });
    });
  });

  describe('triggerWorkflow — content_sprint', () => {
    it('delegates to runContentSprintWorkflow', async () => {
      const workflowResult = {
        workflowType: 'content_sprint',
        tasks: [
          { taskId: 't1', agentType: AgentType.CONTENT, status: AgentTaskStatus.QUEUED },
          { taskId: 't2', agentType: AgentType.SOCIAL, status: AgentTaskStatus.QUEUED },
        ],
      };
      mockWorkflowService.runContentSprintWorkflow.mockResolvedValue(workflowResult as never);

      const dto = { workflowType: 'content_sprint' as const, message: 'Create social content' };
      const result = await controller.triggerWorkflow(COMPANY_ID, USER as never, dto as never);

      expect(result).toEqual(workflowResult);
      expect(mockWorkflowService.runContentSprintWorkflow).toHaveBeenCalled();
    });
  });

  describe('triggerWorkflow — research_then_strategy', () => {
    it('delegates to runResearchThenStrategyWorkflow', async () => {
      const workflowResult = {
        workflowType: 'research_then_strategy',
        tasks: [
          { taskId: 't1', agentType: AgentType.RESEARCH, status: AgentTaskStatus.QUEUED },
          { taskId: 't2', agentType: AgentType.STRATEGY, status: AgentTaskStatus.QUEUED },
        ],
      };
      mockWorkflowService.runResearchThenStrategyWorkflow.mockResolvedValue(workflowResult as never);

      const dto = { workflowType: 'research_then_strategy' as const, message: 'Research competitors' };
      const result = await controller.triggerWorkflow(COMPANY_ID, USER as never, dto as never);

      expect(result).toEqual(workflowResult);
      expect(mockWorkflowService.runResearchThenStrategyWorkflow).toHaveBeenCalled();
    });
  });

  describe('triggerWorkflow — unknown type fallback', () => {
    it('falls back to runFullCampaignWorkflow for unknown workflow types', async () => {
      mockWorkflowService.runFullCampaignWorkflow.mockResolvedValue({ workflowType: 'full_campaign', tasks: [] } as never);

      const dto = { workflowType: 'unknown_type' as never, message: 'Do something' };
      await controller.triggerWorkflow(COMPANY_ID, USER as never, dto as never);

      expect(mockWorkflowService.runFullCampaignWorkflow).toHaveBeenCalled();
    });
  });

  // ─── getTaskStatus ────────────────────────────────────────────────────────

  describe('getTaskStatus', () => {
    it('returns task status from orchestrator', async () => {
      const taskRecord = { id: 'task-1', status: AgentTaskStatus.RUNNING };
      mockOrchestrator.getTaskStatus.mockResolvedValue(taskRecord as never);

      const result = await controller.getTaskStatus(COMPANY_ID, 'task-1', USER as never);

      expect(result).toEqual(taskRecord);
      expect(mockCompanyService.getCompany).toHaveBeenCalledWith(COMPANY_ID, USER.id);
      expect(mockOrchestrator.getTaskStatus).toHaveBeenCalledWith(COMPANY_ID, 'task-1');
    });

    it('returns null when task does not exist', async () => {
      mockOrchestrator.getTaskStatus.mockResolvedValue(null);

      const result = await controller.getTaskStatus(COMPANY_ID, 'no-such-task', USER as never);

      expect(result).toBeNull();
    });
  });
});

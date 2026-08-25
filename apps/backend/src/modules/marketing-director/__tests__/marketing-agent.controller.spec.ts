import { MarketingAgentController } from '../marketing-agent.controller';
import { MarketingAgentService } from '../marketing-agent.service';

const COMPANY_ID = 'company-abc';
const USER = { id: 'user-1', email: 'u@example.com', companyId: COMPANY_ID };

const mockAgentService = {
  run: jest.fn(),
  runStream: jest.fn(),
  listConversations: jest.fn(),
  renameConversation: jest.fn(),
  archiveConversation: jest.fn(),
  deleteConversation: jest.fn(),
} as unknown as jest.Mocked<MarketingAgentService>;

const defaultRunResult = {
  conversationId: 'conv-1',
  response: 'Here is my plan.',
  traceId: 'trace-1',
  agentExecutionId: 'exec-1',
  estimatedCostUsd: 0.002,
  totalLatencyMs: 800,
  iterations: 1,
};

describe('MarketingAgentController', () => {
  let controller: MarketingAgentController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MarketingAgentController(mockAgentService);
  });

  // ─── run ───────────────────────────────────────────────────────────────────

  describe('run', () => {
    it('delegates to agentService.run and returns result', async () => {
      mockAgentService.run.mockResolvedValue(defaultRunResult as never);

      const dto = { message: 'Create a Q4 campaign', conversationId: undefined };
      const result = await controller.run(COMPANY_ID, dto as never, USER as never);

      expect(result).toEqual(defaultRunResult);
      expect(mockAgentService.run).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        userId: USER.id,
        conversationId: undefined,
        message: 'Create a Q4 campaign',
        model: undefined,
      });
    });

    it('passes conversationId when provided', async () => {
      mockAgentService.run.mockResolvedValue(defaultRunResult as never);

      const dto = { message: 'Continue', conversationId: 'conv-existing' };
      await controller.run(COMPANY_ID, dto as never, USER as never);

      expect(mockAgentService.run).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-existing' }),
      );
    });
  });

  // ─── listConversations ────────────────────────────────────────────────────

  describe('listConversations', () => {
    it('returns the conversation list from service', async () => {
      const conversations = [
        { id: 'conv-1', title: 'Q4 planning', status: 'ACTIVE', agentType: 'DIRECTOR', createdAt: new Date().toISOString() },
      ];
      mockAgentService.listConversations.mockResolvedValue(conversations as never);

      const result = await controller.listConversations(COMPANY_ID, USER as never);

      expect(result).toEqual(conversations);
      expect(mockAgentService.listConversations).toHaveBeenCalledWith(COMPANY_ID, USER.id);
    });
  });

  // ─── renameConversation ───────────────────────────────────────────────────

  describe('renameConversation', () => {
    it('renames a conversation and returns the updated record', async () => {
      const updated = { id: 'conv-1', title: 'New Title' };
      mockAgentService.renameConversation.mockResolvedValue(updated as never);

      const result = await controller.renameConversation(
        COMPANY_ID, 'conv-1', { title: 'New Title' }, USER as never,
      );

      expect(result).toEqual(updated);
      expect(mockAgentService.renameConversation).toHaveBeenCalledWith(
        COMPANY_ID, 'conv-1', USER.id, 'New Title',
      );
    });
  });

  // ─── archiveConversation ──────────────────────────────────────────────────

  describe('archiveConversation', () => {
    it('archives a conversation', async () => {
      const archived = { id: 'conv-1', status: 'ARCHIVED' };
      mockAgentService.archiveConversation.mockResolvedValue(archived as never);

      const result = await controller.archiveConversation(COMPANY_ID, 'conv-1', USER as never);

      expect(result).toEqual(archived);
      expect(mockAgentService.archiveConversation).toHaveBeenCalledWith(
        COMPANY_ID, 'conv-1', USER.id,
      );
    });
  });

  // ─── deleteConversation ───────────────────────────────────────────────────

  describe('deleteConversation', () => {
    it('deletes a conversation and returns undefined', async () => {
      mockAgentService.deleteConversation.mockResolvedValue(undefined);

      const result = await controller.deleteConversation(COMPANY_ID, 'conv-1', USER as never);

      expect(result).toBeUndefined();
      expect(mockAgentService.deleteConversation).toHaveBeenCalledWith(
        COMPANY_ID, 'conv-1', USER.id,
      );
    });
  });
});

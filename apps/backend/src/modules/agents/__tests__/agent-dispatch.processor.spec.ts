import { AgentDispatchProcessor } from '../agent-dispatch.processor';
import { AgentType } from '@prisma/client';

const makeJob = (overrides: Record<string, unknown> = {}) => ({
  data: {
    agentTaskId: 'task-123',
    companyId: 'co-1',
    targetAgentType: AgentType.STRATEGY,
    payload: { userMessage: 'Plan Q4', model: 'claude-opus-5' },
    conversationId: undefined,
    ...overrides,
  },
});

const mockAgent = { execute: jest.fn() };

const mockModuleRef = {
  resolve: jest.fn().mockResolvedValue(mockAgent),
};

const mockOrchestrator = {
  markTaskCompleted: jest.fn().mockResolvedValue(undefined),
  markTaskFailed: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {};

describe('AgentDispatchProcessor', () => {
  let processor: AgentDispatchProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgent.execute.mockResolvedValue({ response: 'agent output' });
    processor = new AgentDispatchProcessor(
      mockModuleRef as never,
      mockPrisma as never,
      mockOrchestrator as never,
    );
  });

  describe('process', () => {
    it('resolves and executes the STRATEGY agent', async () => {
      const job = makeJob({ targetAgentType: AgentType.STRATEGY });

      await processor.process(job as never);

      expect(mockModuleRef.resolve).toHaveBeenCalled();
      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'co-1', userMessage: 'Plan Q4' }),
      );
      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalledWith('task-123', { response: 'agent output' });
    });

    it('resolves and executes the CONTENT agent', async () => {
      const job = makeJob({ targetAgentType: AgentType.CONTENT });

      await processor.process(job as never);

      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalledWith('task-123', { response: 'agent output' });
    });

    it('resolves and executes the RESEARCH agent', async () => {
      const job = makeJob({ targetAgentType: AgentType.RESEARCH });

      await processor.process(job as never);

      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalledWith('task-123', expect.any(Object));
    });

    it('resolves and executes the SOCIAL agent', async () => {
      const job = makeJob({ targetAgentType: AgentType.SOCIAL });

      await processor.process(job as never);

      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalled();
    });

    it('resolves and executes the PERFORMANCE agent', async () => {
      const job = makeJob({ targetAgentType: AgentType.PERFORMANCE });

      await processor.process(job as never);

      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalled();
    });

    it('resolves and executes the ANALYTICS agent', async () => {
      const job = makeJob({ targetAgentType: AgentType.ANALYTICS });

      await processor.process(job as never);

      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalled();
    });

    it('resolves and executes the CREATIVE agent', async () => {
      const job = makeJob({ targetAgentType: AgentType.CREATIVE });

      await processor.process(job as never);

      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalled();
    });

    it('marks task completed with no-handler message for unknown agent type', async () => {
      const job = makeJob({ targetAgentType: 'UNKNOWN_AGENT' });

      await processor.process(job as never);

      expect(mockOrchestrator.markTaskCompleted).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({ response: expect.stringContaining('UNKNOWN_AGENT') }),
      );
      expect(mockAgent.execute).not.toHaveBeenCalled();
    });

    it('marks task failed and re-throws when agent throws', async () => {
      const error = new Error('Agent exploded');
      mockAgent.execute.mockRejectedValue(error);
      const job = makeJob({ targetAgentType: AgentType.STRATEGY });

      await expect(processor.process(job as never)).rejects.toThrow('Agent exploded');

      expect(mockOrchestrator.markTaskFailed).toHaveBeenCalledWith('task-123', 'Agent exploded');
      expect(mockOrchestrator.markTaskCompleted).not.toHaveBeenCalled();
    });

    it('uses payload as userMessage fallback when userMessage missing', async () => {
      const job = makeJob({
        targetAgentType: AgentType.CONTENT,
        payload: { someData: 'value' },
      });

      await processor.process(job as never);

      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userMessage: expect.stringContaining('someData') }),
      );
    });

    it('defaults to claude-opus-5 model when not provided in payload', async () => {
      const job = makeJob({
        targetAgentType: AgentType.CONTENT,
        payload: { userMessage: 'Write something' },
      });

      await processor.process(job as never);

      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-5' }),
      );
    });

    it('passes conversationId from job data to execution context', async () => {
      const job = makeJob({
        targetAgentType: AgentType.STRATEGY,
        conversationId: 'conv-abc',
      });

      await processor.process(job as never);

      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-abc' }),
      );
    });
  });
});

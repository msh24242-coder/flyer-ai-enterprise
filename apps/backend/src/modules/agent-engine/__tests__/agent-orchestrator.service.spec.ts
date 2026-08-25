import { AgentOrchestratorService, AgentTaskDispatch } from '../orchestration/agent-orchestrator.service';
import { AgentType, AgentTaskStatus } from '@prisma/client';

const mockPrisma = {
  agentTask: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

function makeService() {
  return new AgentOrchestratorService(mockPrisma as never, mockQueue as never);
}

const baseDispatch: AgentTaskDispatch = {
  companyId: 'co-1',
  requestedByAgentType: AgentType.DIRECTOR,
  targetAgentType: AgentType.CONTENT,
  payload: { userMessage: 'Write a blog post' },
};

describe('AgentOrchestratorService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('dispatch', () => {
    it('creates an agentTask record with QUEUED status', async () => {
      const record = { id: 'task-1', status: AgentTaskStatus.QUEUED };
      mockPrisma.agentTask.create.mockResolvedValue(record);

      const result = await makeService().dispatch(baseDispatch);

      expect(mockPrisma.agentTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'co-1',
          requestedByAgent: AgentType.DIRECTOR,
          targetAgent: AgentType.CONTENT,
          status: 'QUEUED',
        }),
      });
      expect(result).toEqual({ id: 'task-1', status: AgentTaskStatus.QUEUED });
    });

    it('adds a job to the BullMQ queue', async () => {
      mockPrisma.agentTask.create.mockResolvedValue({ id: 'task-2', status: AgentTaskStatus.QUEUED });

      await makeService().dispatch(baseDispatch);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-agent-task',
        expect.objectContaining({ agentTaskId: 'task-2' }),
        expect.objectContaining({ jobId: 'task-2', attempts: 3 }),
      );
    });

    it('propagates conversationId to the task record', async () => {
      mockPrisma.agentTask.create.mockResolvedValue({ id: 'task-3', status: AgentTaskStatus.QUEUED });

      await makeService().dispatch({ ...baseDispatch, conversationId: 'conv-1' });

      expect(mockPrisma.agentTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ conversationId: 'conv-1' }),
      });
    });

    it('propagates parentTaskId to the task record', async () => {
      mockPrisma.agentTask.create.mockResolvedValue({ id: 'task-4', status: AgentTaskStatus.QUEUED });

      await makeService().dispatch({ ...baseDispatch, parentTaskId: 'parent-1' });

      expect(mockPrisma.agentTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ parentTaskId: 'parent-1' }),
      });
    });
  });

  describe('getTaskStatus', () => {
    it('returns task when found', async () => {
      mockPrisma.agentTask.findUnique.mockResolvedValue({ id: 'task-1', status: AgentTaskStatus.COMPLETED });

      const result = await makeService().getTaskStatus('task-1');

      expect(result).toEqual({ id: 'task-1', status: AgentTaskStatus.COMPLETED });
      expect(mockPrisma.agentTask.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        select: { id: true, status: true },
      });
    });

    it('returns null when task not found', async () => {
      mockPrisma.agentTask.findUnique.mockResolvedValue(null);

      const result = await makeService().getTaskStatus('missing');

      expect(result).toBeNull();
    });
  });

  describe('markTaskCompleted', () => {
    it('updates status to COMPLETED with result and timestamp', async () => {
      mockPrisma.agentTask.update.mockResolvedValue({});

      await makeService().markTaskCompleted('task-1', { response: 'Done' });

      expect(mockPrisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          result: { response: 'Done' },
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('markTaskFailed', () => {
    it('updates status to FAILED with error message', async () => {
      mockPrisma.agentTask.update.mockResolvedValue({});

      await makeService().markTaskFailed('task-1', 'Connection timeout');

      expect(mockPrisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: 'FAILED', errorMessage: 'Connection timeout' },
      });
    });
  });
});

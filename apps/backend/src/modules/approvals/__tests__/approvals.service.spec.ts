import { NotFoundException } from '@nestjs/common';
import { ApprovalStatus, PermissionLevel } from '@prisma/client';
import { ApprovalsService } from '../approvals.service';
import { ApprovalsRepository } from '../approvals.repository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockApproval = any;

function makeApproval(id: string, _companyId = 'co-1', status: ApprovalStatus = ApprovalStatus.PENDING): MockApproval {
  return {
    id,
    toolName: 'some_tool',
    toolInput: { arg: 'value' },
    permissionLevel: PermissionLevel.WRITE,
    status,
    reviewNote: null,
    resolvedAt: null,
    createdAt: new Date(),
    agentExecutionId: null,
    conversationId: null,
    requestedById: 'agent-1',
    reviewedById: null,
  };
}

const mockRepo = {
  list: jest.fn(),
  findOne: jest.fn(),
  resolve: jest.fn(),
} as unknown as jest.Mocked<ApprovalsRepository>;

describe('ApprovalsService', () => {
  let service: ApprovalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApprovalsService(mockRepo);
  });

  describe('listApprovals', () => {
    it('lists approvals for the company', async () => {
      const approvals = [makeApproval('a-1'), makeApproval('a-2')];
      mockRepo.list.mockResolvedValue(approvals);

      const result = await service.listApprovals('co-1');

      expect(result).toEqual(approvals);
      expect(mockRepo.list).toHaveBeenCalledWith('co-1', undefined);
    });

    it('passes status filter to repository', async () => {
      mockRepo.list.mockResolvedValue([]);

      await service.listApprovals('co-1', ApprovalStatus.PENDING);

      expect(mockRepo.list).toHaveBeenCalledWith('co-1', ApprovalStatus.PENDING);
    });
  });

  describe('getApproval', () => {
    it('returns approval when found', async () => {
      const approval = makeApproval('a-1');
      mockRepo.findOne.mockResolvedValue(approval);

      const result = await service.getApproval('co-1', 'a-1');

      expect(result).toEqual(approval);
      expect(mockRepo.findOne).toHaveBeenCalledWith('co-1', 'a-1');
    });

    it('throws NotFoundException when approval not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getApproval('co-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('enforces tenant isolation — different company cannot retrieve approval', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getApproval('co-attacker', 'a-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('approves a PENDING approval', async () => {
      const pending = makeApproval('a-1');
      const granted = makeApproval('a-1', 'co-1', ApprovalStatus.GRANTED);
      mockRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(granted);
      mockRepo.resolve.mockResolvedValue({ count: 1 });

      const result = await service.approve('co-1', 'a-1', 'reviewer-1', 'LGTM');

      expect(mockRepo.resolve).toHaveBeenCalledWith('co-1', 'a-1', 'reviewer-1', true, 'LGTM');
      expect(result?.status).toBe(ApprovalStatus.GRANTED);
    });

    it('throws NotFoundException when approval not in PENDING state', async () => {
      const granted = makeApproval('a-1', 'co-1', ApprovalStatus.GRANTED);
      mockRepo.findOne.mockResolvedValue(granted);
      mockRepo.resolve.mockResolvedValue({ count: 0 });

      await expect(service.approve('co-1', 'a-1', 'reviewer-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when approval does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.approve('co-1', 'missing', 'reviewer-1')).rejects.toThrow(NotFoundException);
    });

    it('prevents cross-tenant approval', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.approve('co-attacker', 'a-1', 'bad-actor')).rejects.toThrow(NotFoundException);
      expect(mockRepo.resolve).not.toHaveBeenCalled();
    });
  });

  describe('deny', () => {
    it('denies a PENDING approval', async () => {
      const pending = makeApproval('a-1');
      const denied = makeApproval('a-1', 'co-1', ApprovalStatus.DENIED);
      mockRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(denied);
      mockRepo.resolve.mockResolvedValue({ count: 1 });

      const result = await service.deny('co-1', 'a-1', 'reviewer-1', 'Not approved');

      expect(mockRepo.resolve).toHaveBeenCalledWith('co-1', 'a-1', 'reviewer-1', false, 'Not approved');
      expect(result?.status).toBe(ApprovalStatus.DENIED);
    });

    it('throws NotFoundException when denial fails (not in PENDING state)', async () => {
      const granted = makeApproval('a-1', 'co-1', ApprovalStatus.GRANTED);
      mockRepo.findOne.mockResolvedValue(granted);
      mockRepo.resolve.mockResolvedValue({ count: 0 });

      await expect(service.deny('co-1', 'a-1', 'reviewer-1')).rejects.toThrow(NotFoundException);
    });

    it('prevents cross-tenant denial', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deny('co-attacker', 'a-1', 'bad-actor')).rejects.toThrow(NotFoundException);
      expect(mockRepo.resolve).not.toHaveBeenCalled();
    });
  });
});

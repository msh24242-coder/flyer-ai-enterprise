import { ApprovalsController } from '../approvals.controller';
import { ApprovalsService } from '../approvals.service';
import { ApprovalStatus } from '@prisma/client';

const COMPANY_ID = 'company-abc';
const USER = { id: 'user-1', email: 'admin@example.com', companyId: COMPANY_ID };

const mockApprovalsService = {
  listApprovals: jest.fn(),
  getApproval: jest.fn(),
  approve: jest.fn(),
  deny: jest.fn(),
} as unknown as jest.Mocked<ApprovalsService>;

describe('ApprovalsController', () => {
  let controller: ApprovalsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ApprovalsController(mockApprovalsService);
  });

  describe('list', () => {
    it('lists all approvals without a status filter', async () => {
      const approvals = [{ id: 'a1', status: ApprovalStatus.PENDING }];
      mockApprovalsService.listApprovals.mockResolvedValue(approvals as never);

      const result = await controller.list(COMPANY_ID, undefined);
      expect(result).toEqual(approvals);
      expect(mockApprovalsService.listApprovals).toHaveBeenCalledWith(COMPANY_ID, undefined);
    });

    it('passes PENDING status filter to service', async () => {
      mockApprovalsService.listApprovals.mockResolvedValue([]);

      await controller.list(COMPANY_ID, 'PENDING');
      expect(mockApprovalsService.listApprovals).toHaveBeenCalledWith(
        COMPANY_ID,
        ApprovalStatus.PENDING,
      );
    });

    it('ignores unknown status values', async () => {
      mockApprovalsService.listApprovals.mockResolvedValue([]);

      await controller.list(COMPANY_ID, 'NOT_REAL');
      expect(mockApprovalsService.listApprovals).toHaveBeenCalledWith(COMPANY_ID, undefined);
    });
  });

  describe('getOne', () => {
    it('returns a single approval by id', async () => {
      const approval = { id: 'a1', status: ApprovalStatus.PENDING };
      mockApprovalsService.getApproval.mockResolvedValue(approval as never);

      const result = await controller.getOne(COMPANY_ID, 'a1');
      expect(result).toEqual(approval);
      expect(mockApprovalsService.getApproval).toHaveBeenCalledWith(COMPANY_ID, 'a1');
    });
  });

  describe('approve', () => {
    it('approves a pending request with a review note', async () => {
      const approved = { id: 'a1', status: ApprovalStatus.GRANTED };
      mockApprovalsService.approve.mockResolvedValue(approved as never);

      const result = await controller.approve(COMPANY_ID, 'a1', { reviewNote: 'Looks good' }, USER as never);
      expect(result).toEqual(approved);
      expect(mockApprovalsService.approve).toHaveBeenCalledWith(
        COMPANY_ID, 'a1', USER.id, 'Looks good',
      );
    });

    it('approves without a review note', async () => {
      mockApprovalsService.approve.mockResolvedValue({ id: 'a1', status: ApprovalStatus.GRANTED } as never);

      await controller.approve(COMPANY_ID, 'a1', {}, USER as never);
      expect(mockApprovalsService.approve).toHaveBeenCalledWith(
        COMPANY_ID, 'a1', USER.id, undefined,
      );
    });
  });

  describe('deny', () => {
    it('denies a pending request with a review note', async () => {
      const denied = { id: 'a1', status: ApprovalStatus.DENIED };
      mockApprovalsService.deny.mockResolvedValue(denied as never);

      const result = await controller.deny(COMPANY_ID, 'a1', { reviewNote: 'Not appropriate' }, USER as never);
      expect(result).toEqual(denied);
      expect(mockApprovalsService.deny).toHaveBeenCalledWith(
        COMPANY_ID, 'a1', USER.id, 'Not appropriate',
      );
    });
  });
});

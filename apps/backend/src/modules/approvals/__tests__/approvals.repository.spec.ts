import { ApprovalsRepository } from '../approvals.repository';
import { ApprovalStatus } from '@prisma/client';

const COMPANY_ID = 'company-abc';
const APPROVAL_ID = 'approval-1';

const mockPrisma = {
  approvalRequest: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('ApprovalsRepository', () => {
  let repo: ApprovalsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ApprovalsRepository(mockPrisma as never);
  });

  describe('list', () => {
    it('returns approvals for a company without status filter', async () => {
      const approvals = [{ id: APPROVAL_ID, status: ApprovalStatus.PENDING }];
      mockPrisma.approvalRequest.findMany.mockResolvedValue(approvals);

      const result = await repo.list(COMPANY_ID, undefined);

      expect(result).toEqual(approvals);
      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: COMPANY_ID } }),
      );
    });

    it('filters by status when provided', async () => {
      mockPrisma.approvalRequest.findMany.mockResolvedValue([]);

      await repo.list(COMPANY_ID, ApprovalStatus.GRANTED);

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: COMPANY_ID, status: ApprovalStatus.GRANTED },
        }),
      );
    });

    it('limits results to 100 ordered by createdAt desc', async () => {
      mockPrisma.approvalRequest.findMany.mockResolvedValue([]);

      await repo.list(COMPANY_ID);

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a single approval scoped by company', async () => {
      const approval = { id: APPROVAL_ID, status: ApprovalStatus.PENDING };
      mockPrisma.approvalRequest.findFirst.mockResolvedValue(approval);

      const result = await repo.findOne(COMPANY_ID, APPROVAL_ID);

      expect(result).toEqual(approval);
      expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: APPROVAL_ID, companyId: COMPANY_ID } }),
      );
    });

    it('returns null when approval not found', async () => {
      mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);

      const result = await repo.findOne(COMPANY_ID, 'no-such-id');

      expect(result).toBeNull();
    });
  });

  describe('resolve', () => {
    it('grants an approval with a review note', async () => {
      mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

      await repo.resolve(COMPANY_ID, APPROVAL_ID, 'reviewer-1', true, 'Approved');

      expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: APPROVAL_ID, companyId: COMPANY_ID, status: 'PENDING' },
          data: expect.objectContaining({
            status: ApprovalStatus.GRANTED,
            reviewedById: 'reviewer-1',
            reviewNote: 'Approved',
          }),
        }),
      );
    });

    it('denies an approval without a review note', async () => {
      mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

      await repo.resolve(COMPANY_ID, APPROVAL_ID, 'reviewer-1', false, undefined);

      expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ApprovalStatus.DENIED,
            reviewNote: null,
          }),
        }),
      );
    });

    it('only updates PENDING approvals (status filter in where clause)', async () => {
      mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

      await repo.resolve(COMPANY_ID, APPROVAL_ID, 'reviewer-1', true);

      expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });
  });
});

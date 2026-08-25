import { AuditService, AuditLogEntry } from '../audit.service';

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

function makeService() {
  return new AuditService(mockPrisma as never);
}

const baseEntry: AuditLogEntry = {
  companyId: 'co-1',
  userId: 'user-1',
  action: 'CREATE',
  resource: 'campaign',
  resourceId: 'camp-1',
};

describe('AuditService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('log', () => {
    it('persists an audit log entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await makeService().log(baseEntry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'co-1',
          userId: 'user-1',
          action: 'CREATE',
          resource: 'campaign',
          resourceId: 'camp-1',
        }),
      });
    });

    it('includes before and after snapshots when provided', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

      await makeService().log({
        ...baseEntry,
        before: { status: 'DRAFT' },
        after: { status: 'ACTIVE' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          before: { status: 'DRAFT' },
          after: { status: 'ACTIVE' },
        }),
      });
    });

    it('includes ip and userAgent when provided', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-3' });

      await makeService().log({
        ...baseEntry,
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
        }),
      });
    });

    it('swallows DB errors without throwing', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB down'));

      await expect(makeService().log(baseEntry)).resolves.toBeUndefined();
    });

    it('swallows errors so callers are never interrupted', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('connection refused'));

      let threw = false;
      try {
        await makeService().log(baseEntry);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });

  describe('list', () => {
    it('returns audit logs for a company', async () => {
      const logs = [{ id: 'log-1', action: 'CREATE', resource: 'campaign', resourceId: 'c-1', userId: 'u-1', traceId: null, createdAt: new Date() }];
      mockPrisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await makeService().list('co-1');

      expect(result).toEqual(logs);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1' } }),
      );
    });

    it('filters by resource when provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await makeService().list('co-1', { resource: 'goal' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1', resource: 'goal' } }),
      );
    });

    it('filters by userId when provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await makeService().list('co-1', { userId: 'user-42' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1', userId: 'user-42' } }),
      );
    });

    it('defaults to a take of 100', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await makeService().list('co-1');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('respects custom limit', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await makeService().list('co-1', { limit: 25 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
      );
    });

    it('enforces tenant isolation', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await makeService().list('co-attacker');

      const call = mockPrisma.auditLog.findMany.mock.calls[0][0] as { where: { companyId: string } };
      expect(call.where.companyId).toBe('co-attacker');
    });
  });
});

import { ApprovalEngineService } from '../approval/approval-engine.service';
import { PermissionLevel } from '@prisma/client';

const mockPrisma = {
  approvalRequest: {
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
};

describe('ApprovalEngineService', () => {
  let service: ApprovalEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApprovalEngineService(mockPrisma as never);
  });

  const baseRequest = {
    toolName: 'some_tool',
    companyId: 'company-123',
    input: { key: 'value' },
  };

  it('allows READ permission immediately', async () => {
    const result = await service.check({
      ...baseRequest,
      permissionLevel: PermissionLevel.READ,
    });
    expect(result.outcome).toBe('ALLOWED');
    expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
  });

  it('allows WRITE permission immediately', async () => {
    const result = await service.check({
      ...baseRequest,
      permissionLevel: PermissionLevel.WRITE,
    });
    expect(result.outcome).toBe('ALLOWED');
    expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
  });

  it('creates ApprovalRequest and returns PENDING for APPROVAL_REQUIRED', async () => {
    mockPrisma.approvalRequest.create.mockResolvedValue({ id: 'approval-abc' });

    const result = await service.check({
      ...baseRequest,
      permissionLevel: PermissionLevel.APPROVAL_REQUIRED,
      userId: 'user-1',
    });

    expect(result.outcome).toBe('PENDING');
    expect(result.approvalRequestId).toBe('approval-abc');
    expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toolName: 'some_tool',
          permissionLevel: PermissionLevel.APPROVAL_REQUIRED,
          status: 'PENDING',
        }),
      }),
    );
  });

  it('denies ADMIN_ONLY when no userId provided', async () => {
    const result = await service.check({
      ...baseRequest,
      permissionLevel: PermissionLevel.ADMIN_ONLY,
    });
    expect(result.outcome).toBe('DENIED');
    expect(result.reason).toMatch(/authenticated user/);
  });

  it('denies ADMIN_ONLY when user is not admin', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await service.check({
      ...baseRequest,
      permissionLevel: PermissionLevel.ADMIN_ONLY,
      userId: 'user-999',
    });
    expect(result.outcome).toBe('DENIED');
    expect(result.reason).toMatch(/ADMIN role/);
  });

  it('allows ADMIN_ONLY when user is admin', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-admin', role: 'ADMIN' });
    const result = await service.check({
      ...baseRequest,
      permissionLevel: PermissionLevel.ADMIN_ONLY,
      userId: 'user-admin',
    });
    expect(result.outcome).toBe('ALLOWED');
  });

  it('resolveApproval calls update with GRANTED status', async () => {
    mockPrisma.approvalRequest.update.mockResolvedValue({});
    await service.resolveApproval('approval-1', true);
    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'GRANTED' }),
      }),
    );
  });

  it('resolveApproval calls update with DENIED status', async () => {
    mockPrisma.approvalRequest.update.mockResolvedValue({});
    await service.resolveApproval('approval-1', false);
    expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DENIED' }),
      }),
    );
  });
});

import { ForbiddenException } from '@nestjs/common';
import { CompanyService } from '../company.service';
import { CompanyRepository } from '../company.repository';
import { UserRole } from '@prisma/client';

const COMPANY_A = 'company-aaa';
const COMPANY_B = 'company-bbb';
const USER_IN_A = 'user-in-a';
const USER_IN_B = 'user-in-b';

const mockPrisma = { agentExecution: { findMany: jest.fn() } };

const mockRepo: jest.Mocked<CompanyRepository> = {
  findById: jest.fn(),
  update: jest.fn(),
  getMembers: jest.fn(),
  findMemberInCompany: jest.fn(),
  updateMemberRole: jest.fn(),
  deactivateMember: jest.fn(),
  listKnowledge: jest.fn(),
  findKnowledge: jest.fn(),
  upsertKnowledge: jest.fn(),
  deleteKnowledge: jest.fn(),
  logAudit: jest.fn(),
} as never;

describe('Tenant Isolation', () => {
  let service: CompanyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CompanyService(mockRepo, mockPrisma as never);
  });

  it('user from company A cannot read company B profile', async () => {
    // findMemberInCompany(COMPANY_B, USER_IN_A) returns null — user not in B
    mockRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(service.getCompany(COMPANY_B, USER_IN_A)).rejects.toThrow(ForbiddenException);
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('user from company A cannot update company B', async () => {
    mockRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.updateCompany(COMPANY_B, { name: 'Hacked' }, USER_IN_A),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('user from company A cannot list members of company B', async () => {
    mockRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(service.getMembers(COMPANY_B, USER_IN_A)).rejects.toThrow(ForbiddenException);
    expect(mockRepo.getMembers).not.toHaveBeenCalled();
  });

  it('user from company A cannot remove a member from company B', async () => {
    mockRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.removeMember(COMPANY_B, USER_IN_B, USER_IN_A),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.deactivateMember).not.toHaveBeenCalled();
  });

  it('user from company A cannot list knowledge of company B', async () => {
    mockRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(service.listKnowledge(COMPANY_B, USER_IN_A)).rejects.toThrow(ForbiddenException);
    expect(mockRepo.listKnowledge).not.toHaveBeenCalled();
  });

  it('user from company A cannot upsert knowledge in company B', async () => {
    mockRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.upsertKnowledge(
        COMPANY_B,
        { category: 'brand', key: 'voice', value: { tone: 'evil' } },
        USER_IN_A,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.upsertKnowledge).not.toHaveBeenCalled();
  });

  it('user from company A cannot delete knowledge in company B', async () => {
    mockRepo.findMemberInCompany.mockResolvedValue(null);

    await expect(
      service.deleteKnowledge(COMPANY_B, 'knowledge-xyz', USER_IN_A),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.deleteKnowledge).not.toHaveBeenCalled();
  });

  it('inactive member of company A is also denied access', async () => {
    mockRepo.findMemberInCompany.mockResolvedValue({
      id: USER_IN_A,
      companyId: COMPANY_A,
      isActive: false,
      role: UserRole.OWNER,
    } as never);

    await expect(service.getCompany(COMPANY_A, USER_IN_A)).rejects.toThrow(ForbiddenException);
  });
});

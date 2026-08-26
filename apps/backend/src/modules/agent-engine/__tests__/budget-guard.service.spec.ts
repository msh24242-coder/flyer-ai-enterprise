import { BadRequestException } from '@nestjs/common';
import { BudgetGuardService } from '../budget/budget-guard.service';

const mockPrisma = {
  company: { findUnique: jest.fn() },
  agentExecution: { aggregate: jest.fn() },
};

function makeGuard() {
  return new BudgetGuardService(mockPrisma as never);
}

describe('BudgetGuardService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when the company has no monthlyBudgetUsd configured', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ aiConfig: {} });

    await expect(makeGuard().assertWithinBudget('co-1')).resolves.toBeUndefined();
    expect(mockPrisma.agentExecution.aggregate).not.toHaveBeenCalled();
  });

  it('does nothing when the company has no aiConfig at all', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ aiConfig: null });

    await expect(makeGuard().assertWithinBudget('co-1')).resolves.toBeUndefined();
  });

  it('allows the call when 30-day spend is below the configured budget', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ aiConfig: { monthlyBudgetUsd: 100 } });
    mockPrisma.agentExecution.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: 42 } });

    await expect(makeGuard().assertWithinBudget('co-1')).resolves.toBeUndefined();
    expect(mockPrisma.agentExecution.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'co-1' }) }),
    );
  });

  it('throws BadRequestException when 30-day spend has reached the budget', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ aiConfig: { monthlyBudgetUsd: 10 } });
    mockPrisma.agentExecution.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: 10 } });

    await expect(makeGuard().assertWithinBudget('co-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when 30-day spend has exceeded the budget', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ aiConfig: { monthlyBudgetUsd: 10 } });
    mockPrisma.agentExecution.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: 15.5 } });

    await expect(makeGuard().assertWithinBudget('co-1')).rejects.toThrow(
      /Monthly AI budget of \$10 has been reached \(\$15.5000 spent\)/,
    );
  });

  it('treats a null spend sum as zero (no prior executions)', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ aiConfig: { monthlyBudgetUsd: 10 } });
    mockPrisma.agentExecution.aggregate.mockResolvedValue({ _sum: { estimatedCostUsd: null } });

    await expect(makeGuard().assertWithinBudget('co-1')).resolves.toBeUndefined();
  });
});

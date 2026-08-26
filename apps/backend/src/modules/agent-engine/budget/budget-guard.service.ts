import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Single, shared enforcement point for the monthly AI spend cap.
 * Any code path that can trigger real LLM spend (chat, streaming chat, or a
 * workflow that fans out to sub-agents) must call this before doing so.
 */
@Injectable()
export class BudgetGuardService {
  constructor(private readonly prisma: PrismaService) {}

  async assertWithinBudget(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { aiConfig: true },
    });
    const aiConfig = (company?.aiConfig ?? {}) as Record<string, unknown>;
    const monthlyBudgetUsd =
      typeof aiConfig.monthlyBudgetUsd === 'number' ? aiConfig.monthlyBudgetUsd : null;
    if (!monthlyBudgetUsd) return;

    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    const result = await this.prisma.agentExecution.aggregate({
      where: { companyId, createdAt: { gte: thirtyDaysAgo } },
      _sum: { estimatedCostUsd: true },
    });
    const spent = Number(result._sum.estimatedCostUsd ?? 0);

    if (spent >= monthlyBudgetUsd) {
      throw new BadRequestException(
        `Monthly AI budget of $${monthlyBudgetUsd} has been reached ($${spent.toFixed(4)} spent). Update your budget in Settings to continue.`,
      );
    }
  }
}

/**
 * Billing Service — Usage tracking, quota management, plan info
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@openbot/database';

@Injectable()
export class BillingService {
  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}

  async getInfo(userId: string) {
    const billing = await this.prisma.billingAccount.findUnique({ where: { userId } });
    if (!billing) throw new NotFoundException('Billing account not found');

    const tokensUsed = Number(billing.tokensUsedThisMonth);
    const tokenLimit = Number(billing.monthlyTokenLimit);

    return {
      plan: billing.plan,
      tokensUsed,
      tokenLimit,
      percentUsed: tokenLimit > 0 ? Math.round((tokensUsed / tokenLimit) * 100) : 0,
      resetDate: billing.quotaResetAt.toISOString(),
    };
  }

  async getUsageSummary(userId: string, startDate?: Date, endDate?: Date) {
    const billing = await this.prisma.billingAccount.findUnique({ where: { userId } });
    if (!billing) throw new NotFoundException('Billing account not found');

    const start = startDate || new Date(new Date().setDate(1)); // First of current month
    const end = endDate || new Date();

    const records = await this.prisma.usageRecord.findMany({
      where: {
        billingAccountId: billing.id,
        createdAt: { gte: start, lte: end },
      },
    });

    // Aggregate by provider
    const byProvider = new Map<string, { tokens: number; costUsd: number; requestCount: number }>();
    let totalTokens = 0;
    let totalCostUsd = 0;

    for (const r of records) {
      totalTokens += r.totalTokens;
      totalCostUsd += r.costUsd;

      const existing = byProvider.get(r.provider) || { tokens: 0, costUsd: 0, requestCount: 0 };
      existing.tokens += r.totalTokens;
      existing.costUsd += r.costUsd;
      existing.requestCount += 1;
      byProvider.set(r.provider, existing);
    }

    return {
      totalTokens,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      byProvider: Array.from(byProvider.entries()).map(([provider, stats]) => ({
        provider,
        ...stats,
        costUsd: Math.round(stats.costUsd * 10000) / 10000,
      })),
      period: { start: start.toISOString(), end: end.toISOString() },
    };
  }

  async resetMonthlyQuota(userId: string) {
    await this.prisma.billingAccount.update({
      where: { userId },
      data: { tokensUsedThisMonth: BigInt(0), quotaResetAt: new Date() },
    });
  }
}

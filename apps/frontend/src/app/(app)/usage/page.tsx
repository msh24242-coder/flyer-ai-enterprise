'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { BarChart3, Zap, DollarSign, TrendingUp } from 'lucide-react';
import type { Translations } from '@/i18n/en';

type AgentUsage = { agentType: string; executions: number; totalCostUsd: number; totalTokens: number };
type UsageData = {
  totalExecutions: number; totalCostUsd: number;
  totalInputTokens: number; totalOutputTokens: number;
  byAgent: AgentUsage[]; fromDate: string; toDate: string;
};
type AgentTypeKey = keyof Translations['enums']['agentType'];

const AGENT_COLORS: Record<string, string> = {
  DIRECTOR: 'var(--brand-600)', STRATEGY: '#8b5cf6', RESEARCH: '#06b6d4',
  CONTENT: '#f59e0b', SOCIAL: '#10b981', PERFORMANCE: '#ef4444',
  ANALYTICS: '#6366f1', CREATIVE: '#ec4899',
};

export default function UsagePage() {
  const { user, accessToken } = useAuth();
  const { t, formatDate, formatNumber, formatCurrency, pluralize } = usePreferences();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) return;
    api.company.getAiUsage(user.companyId, accessToken)
      .then((data) => setUsage(data as UsageData))
      .catch((err) => setError(err instanceof Error ? err.message : t((d) => d.usage.failedToLoad)))
      .finally(() => setLoading(false));
  }, [user, accessToken, t]);

  const currencyOpts = { minimumFractionDigits: 4, maximumFractionDigits: 4 };
  const agentTypeLabels = t((d) => d.enums.agentType);

  const stats = usage ? [
    { label: t((d) => d.usage.totalExecutions), value: formatNumber(usage.totalExecutions), icon: Zap, iconBg: 'var(--info-bg)', iconColor: 'var(--info-text)' },
    { label: t((d) => d.usage.totalCost), value: formatCurrency(Number(usage.totalCostUsd), 'USD', currencyOpts), icon: DollarSign, iconBg: 'var(--success-bg)', iconColor: 'var(--success-text)', sub: 'USD' },
    { label: t((d) => d.usage.inputTokens), value: formatNumber(Number(usage.totalInputTokens)), icon: TrendingUp, iconBg: 'var(--warning-bg)', iconColor: 'var(--warning-text)' },
    { label: t((d) => d.usage.outputTokens), value: formatNumber(Number(usage.totalOutputTokens)), icon: BarChart3, iconBg: 'var(--bg-muted)', iconColor: 'var(--text-secondary)' },
  ] : [];

  const maxExec = usage ? Math.max(...usage.byAgent.map((a) => a.executions), 1) : 1;

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.usage.title)} />
      <PageHeader title={t((d) => d.usage.title)} description={t((d) => d.usage.subtitle)} />

      <div className="flex-1 p-6 space-y-6">
        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !usage ? (
          <EmptyState
            icon={BarChart3}
            title={t((d) => d.usage.noUsageData)}
            description={t((d) => d.usage.emptyHint)}
          />
        ) : (
          <div className="space-y-6">
            {/* Date range */}
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t((d) => d.usage.dataRange, { from: formatDate(usage.fromDate), to: formatDate(usage.toDate) })}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label}
                    className="rounded-xl border p-5"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-xs)' }}
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: stat.iconBg }}>
                      <Icon size={16} style={{ color: stat.iconColor }} />
                    </div>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Per-agent breakdown */}
            {usage.byAgent.length > 0 && (
              <div className="rounded-xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-xs)' }}>
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--surface-border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.usage.usageByAgent)}</h3>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--surface-border)' }}>
                  {usage.byAgent.map((agent) => (
                    <div key={agent.agentType} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ background: AGENT_COLORS[agent.agentType] ?? 'var(--text-tertiary)' }} />
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {agentTypeLabels[agent.agentType as AgentTypeKey] ?? agent.agentType}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(Number(agent.totalCostUsd), 'USD', currencyOpts)}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {t((d) => d.usage.execTokensSummary, {
                              execCount: pluralize(agent.executions, t((d) => d.units.execution)),
                              tokenCount: pluralize(Number(agent.totalTokens), t((d) => d.units.token)),
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(agent.executions / maxExec) * 100}%`,
                            background: AGENT_COLORS[agent.agentType] ?? 'var(--brand-600)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type AgentUsage = { agentType: string; executions: number; totalCostUsd: number; totalTokens: number };
type UsageData = {
  totalExecutions: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byAgent: AgentUsage[];
  fromDate: string;
  toDate: string;
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </Card>
  );
}

export default function UsagePage() {
  const { user, accessToken } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) return;
    api.company.getAiUsage(user.companyId, accessToken)
      .then((data) => setUsage(data as UsageData))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load usage'))
      .finally(() => setLoading(false));
  }, [user, accessToken]);

  return (
    <div className="flex flex-col">
      <Header title="AI Usage" />

      <div className="flex-1 p-6">
        <p className="mb-6 text-sm text-gray-500">
          AI agent usage and cost for the last 30 days.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : !usage ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl">📊</p>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No usage data</h3>
            <p className="mt-2 text-sm text-gray-500">Start using the AI Director to see usage metrics here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total Executions"
                value={usage.totalExecutions.toLocaleString()}
                sub={`${new Date(usage.fromDate).toLocaleDateString()} – ${new Date(usage.toDate).toLocaleDateString()}`}
              />
              <StatCard
                label="Total Cost"
                value={`$${Number(usage.totalCostUsd).toFixed(4)}`}
                sub="USD"
              />
              <StatCard
                label="Input Tokens"
                value={Number(usage.totalInputTokens).toLocaleString()}
              />
              <StatCard
                label="Output Tokens"
                value={Number(usage.totalOutputTokens).toLocaleString()}
              />
            </div>

            {/* Per-agent breakdown */}
            {usage.byAgent.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">By Agent</h3>
                <Card className="divide-y divide-gray-100">
                  {usage.byAgent.map((agent) => (
                    <div key={agent.agentType} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{agent.agentType}</p>
                        <p className="text-xs text-gray-400">{agent.executions} executions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          ${Number(agent.totalCostUsd).toFixed(4)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {Number(agent.totalTokens).toLocaleString()} tokens
                        </p>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { ShieldCheck, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';
import type { Translations } from '@/i18n/en';

type Approval = {
  id: string; status: string; toolName: string; agentType: string;
  toolInput: unknown; reason?: string; reviewNote?: string; createdAt: string;
};
type ApprovalStatus = 'PENDING' | 'GRANTED' | 'DENIED' | 'EXPIRED';
type AgentTypeKey = keyof Translations['enums']['agentType'];

const FILTERS: Array<ApprovalStatus | 'all'> = ['PENDING', 'GRANTED', 'DENIED', 'all'];

function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { PENDING: 'warning', GRANTED: 'success', DENIED: 'error', EXPIRED: 'default' };
  return map[status] ?? 'default';
}

export default function ApprovalsPage() {
  const { user, accessToken } = useAuth();
  const { t, formatDateTime } = usePreferences();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const approvalStatusLabels = t((d) => d.enums.approvalStatus);
  const agentTypeLabels = t((d) => d.enums.agentType);

  const loadApprovals = useCallback(async () => {
    if (!companyId || !token) return;
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await api.approvals.list(companyId, token, status);
      setApprovals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.approvals.failedToLoad));
    } finally {
      setLoading(false);
    }
  }, [companyId, token, filter, t]);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      await api.approvals.approve(companyId, token, id);
      setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: 'GRANTED' } : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.approvals.failedToApprove));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeny(id: string) {
    setActionLoading(id);
    try {
      await api.approvals.deny(companyId, token, id);
      setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: 'DENIED' } : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.approvals.failedToDeny));
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.nav.approvals)} />
      <PageHeader
        title={t((d) => d.approvals.title)}
        description={t((d) => d.approvals.subtitle)}
        actions={
          pendingCount > 0 && filter === 'PENDING' ? (
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>
              {t((d) => d.approvals.pendingCount, { count: pendingCount })}
            </span>
          ) : undefined
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
              style={
                filter === s
                  ? { background: 'var(--brand-600)', color: '#fff', border: '1px solid transparent' }
                  : { background: 'var(--surface-1)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }
              }
            >
              {s === 'all' ? t((d) => d.common.all) : approvalStatusLabels[s]}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : approvals.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={filter === 'PENDING' ? t((d) => d.approvals.noPendingApprovals) : t((d) => d.approvals.noFilteredApprovals, { filter: approvalStatusLabels[filter as ApprovalStatus]?.toLowerCase() ?? '' })}
            description={
              filter === 'PENDING'
                ? t((d) => d.approvals.pendingEmptyHint)
                : t((d) => d.common.tryDifferentFilter)
            }
          />
        ) : (
          <div className="space-y-3">
            {approvals.map((approval) => {
              const isExpanded = expanded === approval.id;
              return (
                <div
                  key={approval.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ background: 'var(--surface-1)', borderColor: approval.status === 'PENDING' ? 'var(--warning-border)' : 'var(--surface-border)' }}
                >
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: approval.status === 'PENDING' ? 'var(--warning-bg)' : approval.status === 'GRANTED' ? 'var(--success-bg)' : 'var(--error-bg)',
                        }}
                      >
                        <ShieldCheck size={16} style={{
                          color: approval.status === 'PENDING' ? 'var(--warning-text)' : approval.status === 'GRANTED' ? 'var(--success-text)' : 'var(--error-text)',
                        }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{approval.toolName}</p>
                          <Badge variant={statusVariant(approval.status)}>{approvalStatusLabels[approval.status as ApprovalStatus] ?? approval.status}</Badge>
                          <Badge variant="default">{agentTypeLabels[approval.agentType as AgentTypeKey] ?? approval.agentType}</Badge>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {formatDateTime(approval.createdAt)}
                        </p>
                        {approval.reason && (
                          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{approval.reason}</p>
                        )}
                        {approval.reviewNote && (
                          <p className="mt-1 text-xs italic" style={{ color: 'var(--text-tertiary)' }}>{t((d) => d.approvals.notePrefix, { note: approval.reviewNote })}</p>
                        )}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : approval.id)}
                          className="mt-2 flex items-center gap-1 text-xs transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {isExpanded ? <><ChevronUp size={12} /> {t((d) => d.approvals.hideInput)}</> : <><ChevronDown size={12} /> {t((d) => d.approvals.viewToolInput)}</>}
                        </button>
                      </div>
                      {approval.status === 'PENDING' && (
                        <div className="flex flex-shrink-0 flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(approval.id)}
                            loading={actionLoading === approval.id}
                            disabled={!!actionLoading && actionLoading !== approval.id}
                          >
                            <Check size={13} /> {t((d) => d.approvals.approve)}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeny(approval.id)}
                            loading={actionLoading === approval.id}
                            disabled={!!actionLoading && actionLoading !== approval.id}
                          >
                            <X size={13} /> {t((d) => d.approvals.deny)}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-5 py-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)' }}>
                      <pre dir="ltr" className="overflow-x-auto rounded-lg p-3 text-xs font-mono leading-relaxed text-start"
                        style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                        {JSON.stringify(approval.toolInput, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

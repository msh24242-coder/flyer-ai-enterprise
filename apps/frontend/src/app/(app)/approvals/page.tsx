'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Approval = {
  id: string;
  status: string;
  toolName: string;
  agentType: string;
  toolInput: unknown;
  reason?: string;
  reviewNote?: string;
  createdAt: string;
};

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    PENDING: 'warning', GRANTED: 'success', DENIED: 'error', EXPIRED: 'default',
  };
  return map[status] ?? 'default';
}

export default function ApprovalsPage() {
  const { user, accessToken } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  async function loadApprovals() {
    if (!companyId || !token) return;
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await api.approvals.list(companyId, token, status);
      setApprovals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadApprovals(); }, [user, accessToken, filter]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      await api.approvals.approve(companyId, token, id);
      setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status: 'GRANTED' } : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
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
      setError(err instanceof Error ? err.message : 'Failed to deny');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Approvals" />

      <div className="flex-1 p-6">
        <div className="mb-6">
          <p className="mb-4 text-sm text-gray-500">
            AI agent actions that require your review before execution.
          </p>
          <div className="flex items-center gap-2">
            {['PENDING', 'GRANTED', 'DENIED', 'all'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl">✅</p>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {filter === 'PENDING' ? 'No pending approvals' : `No ${filter.toLowerCase()} approvals`}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {filter === 'PENDING'
                ? 'The AI Director will ask for approval before taking sensitive actions.'
                : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((approval) => (
              <Card key={approval.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{approval.toolName}</p>
                      <Badge variant={statusVariant(approval.status)}>{approval.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      Agent: {approval.agentType} · {new Date(approval.createdAt).toLocaleString()}
                    </p>
                    {approval.reason && (
                      <p className="text-sm text-gray-600 mb-2">{approval.reason}</p>
                    )}
                    <details className="text-xs text-gray-400">
                      <summary className="cursor-pointer hover:text-gray-600">View tool input</summary>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs">
                        {JSON.stringify(approval.toolInput, null, 2)}
                      </pre>
                    </details>
                    {approval.reviewNote && (
                      <p className="mt-2 text-xs text-gray-500 italic">Note: {approval.reviewNote}</p>
                    )}
                  </div>
                  {approval.status === 'PENDING' && (
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(approval.id)}
                        loading={actionLoading === approval.id}
                        disabled={!!actionLoading && actionLoading !== approval.id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeny(approval.id)}
                        loading={actionLoading === approval.id}
                        disabled={!!actionLoading && actionLoading !== approval.id}
                      >
                        Deny
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

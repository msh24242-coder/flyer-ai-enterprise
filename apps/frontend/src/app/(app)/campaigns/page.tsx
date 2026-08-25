'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

type Campaign = { id: string; title: string; status: string; budget?: number; startDate?: string; endDate?: string; description?: string };

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    ACTIVE: 'success', COMPLETED: 'info', PAUSED: 'warning', CANCELLED: 'error', DRAFT: 'default',
  };
  return map[status] ?? 'default';
}

export default function CampaignsPage() {
  const { user, accessToken } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  async function loadCampaigns() {
    if (!companyId || !token) return;
    try {
      const data = await api.campaigns.list(companyId, token);
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCampaigns(); }, [user, accessToken]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const campaign = await api.campaigns.create(companyId, token, {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        budget: newBudget ? Number(newBudget) : undefined,
      });
      setCampaigns((prev) => [campaign, ...prev]);
      setNewTitle('');
      setNewDesc('');
      setNewBudget('');
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(campaignId: string, status: string) {
    setUpdatingStatusId(campaignId);
    try {
      const updated = await api.campaigns.update(companyId, token, campaignId, { status });
      setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, status: updated.status } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleDelete(campaignId: string) {
    if (!confirm('Delete this campaign?')) return;
    setDeletingId(campaignId);
    try {
      await api.campaigns.delete(companyId, token, campaignId);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter);

  return (
    <div className="flex flex-col">
      <Header title="Campaigns" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto">
            {['all', 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <Button onClick={() => setCreating(true)} size="sm">+ New Campaign</Button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {creating && (
          <Card className="mb-6 p-4">
            <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-gray-900">New Campaign</h3>
              <Input label="Title" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Q4 Product Launch" />
              <Input label="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Campaign objective and target audience" />
              <Input label="Budget (optional)" type="number" min="0" value={newBudget} onChange={(e) => setNewBudget(e.target.value)} placeholder="e.g. 10000" />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} size="sm">{saving ? 'Creating…' : 'Create'}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setCreating(false); setNewTitle(''); setNewDesc(''); setNewBudget(''); }}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl">📣</p>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {filter === 'all' ? 'No campaigns yet' : `No ${filter.toLowerCase()} campaigns`}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {filter === 'all' ? 'Ask the AI Director to create a campaign, or use the button above.' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((campaign) => (
              <Card key={campaign.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900">{campaign.title}</p>
                    {campaign.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{campaign.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                      {campaign.budget != null && (
                        <span>Budget: ${campaign.budget.toLocaleString()}</span>
                      )}
                      {campaign.startDate && (
                        <span>Start: {new Date(campaign.startDate).toLocaleDateString()}</span>
                      )}
                      {campaign.endDate && (
                        <span>End: {new Date(campaign.endDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={campaign.status}
                      onChange={(e) => void handleStatusChange(campaign.id, e.target.value)}
                      disabled={updatingStatusId === campaign.id}
                      className="rounded-lg border border-gray-200 bg-background px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                    <button
                      onClick={() => void handleDelete(campaign.id)}
                      disabled={deletingId === campaign.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === campaign.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Megaphone, Trash2, Plus, ChevronDown, DollarSign, Calendar } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';

type Campaign = { id: string; title: string; status: string; budget?: number; startDate?: string; endDate?: string; description?: string };

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];
const FILTERS = ['all', 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'];

function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    ACTIVE: 'success', COMPLETED: 'info', PAUSED: 'warning', CANCELLED: 'error', DRAFT: 'default',
  };
  return map[status] ?? 'default';
}

export default function CampaignsPage() {
  const { user, accessToken } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
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
      setNewTitle(''); setNewDesc(''); setNewBudget('');
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
      setError(err instanceof Error ? err.message : 'Failed to update');
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
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter);

  return (
    <div className="flex flex-col h-full">
      <Header title="Campaigns" />
      <PageHeader
        title="Campaigns"
        description="Manage your marketing campaigns and track performance"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> New Campaign
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Filter tabs */}
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
              {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {creating && (
          <div className="rounded-xl border p-5 animate-fade-in"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-sm)' }}>
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Campaign</h3>
              <Input label="Title" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Q4 Product Launch" />
              <Input label="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Campaign objective and audience" />
              <Input label="Budget (USD, optional)" type="number" min="0" value={newBudget} onChange={(e) => setNewBudget(e.target.value)} placeholder="e.g. 10000" />
              <div className="flex gap-2">
                <Button type="submit" loading={saving} size="sm">{saving ? 'Creating…' : 'Create Campaign'}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setCreating(false); setNewTitle(''); setNewDesc(''); setNewBudget(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={filter === 'all' ? 'No campaigns yet' : `No ${filter.toLowerCase()} campaigns`}
            description={filter === 'all' ? 'Create your first campaign or ask the AI Director to build one.' : 'Try a different filter.'}
            action={filter === 'all' ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New Campaign</Button> : undefined}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((campaign) => (
              <div
                key={campaign.id}
                className="group flex items-start gap-4 rounded-xl border p-5 transition-all duration-150 hover:shadow-sm"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
              >
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--success-bg)' }}>
                  <Megaphone size={16} style={{ color: 'var(--success-text)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{campaign.title}</p>
                  {campaign.description && (
                    <p className="mt-0.5 text-sm line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{campaign.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {campaign.budget != null && (
                      <span className="flex items-center gap-1"><DollarSign size={11} />{campaign.budget.toLocaleString()}</span>
                    )}
                    {campaign.startDate && (
                      <span className="flex items-center gap-1"><Calendar size={11} />{new Date(campaign.startDate).toLocaleDateString()}</span>
                    )}
                    {campaign.endDate && (
                      <span>→ {new Date(campaign.endDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                  <div className="relative">
                    <select
                      value={campaign.status}
                      onChange={(e) => void handleStatusChange(campaign.id, e.target.value)}
                      disabled={updatingStatusId === campaign.id}
                      className="appearance-none rounded-lg border pl-2 pr-6 py-1 text-xs cursor-pointer disabled:opacity-50"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <button
                    onClick={() => void handleDelete(campaign.id)}
                    disabled={deletingId === campaign.id}
                    className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50"
                    title="Delete campaign"
                  >
                    {deletingId === campaign.id ? <span className="text-xs">…</span> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

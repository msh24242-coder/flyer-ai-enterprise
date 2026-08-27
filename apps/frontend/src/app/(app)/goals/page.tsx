'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Target, Trash2, Plus, ChevronDown } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';

type Goal = { id: string; title: string; status: string; description?: string; targetDate?: string };
type GoalStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const STATUS_OPTIONS: GoalStatus[] = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    ACTIVE: 'success', COMPLETED: 'info', CANCELLED: 'error', DRAFT: 'default',
  };
  return map[status] ?? 'default';
}

function GoalRow({
  goal,
  onStatusChange,
  onDelete,
  updating,
  deleting,
}: {
  goal: Goal;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  updating: boolean;
  deleting: boolean;
}) {
  const { t, formatDate } = usePreferences();
  const goalStatusLabels = t((d) => d.enums.goalStatus);
  return (
    <div
      className="group flex items-start gap-4 rounded-xl border p-5 transition-all duration-150 hover:shadow-sm"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
    >
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--info-bg)' }}>
        <Target size={16} style={{ color: 'var(--info-text)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{goal.title}</p>
        {goal.description && (
          <p className="mt-0.5 text-sm line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{goal.description}</p>
        )}
        {goal.targetDate && (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t((d) => d.goals.targetPrefix, { date: formatDate(goal.targetDate, { month: 'short', day: 'numeric', year: 'numeric' }) })}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Badge variant={statusVariant(goal.status)}>{goalStatusLabels[goal.status as GoalStatus] ?? goal.status}</Badge>
        <div className="relative">
          <select
            value={goal.status}
            onChange={(e) => onStatusChange(goal.id, e.target.value)}
            disabled={updating}
            className="appearance-none rounded-lg border ps-2 pe-6 py-1 text-xs cursor-pointer disabled:opacity-50"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--surface-border)',
              color: 'var(--text-secondary)',
            }}
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{goalStatusLabels[s]}</option>)}
          </select>
          <ChevronDown size={10} className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <button
          onClick={() => onDelete(goal.id)}
          disabled={deleting}
          className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50"
          title={t((d) => d.goals.deleteTooltip)}
        >
          {deleting ? <span className="text-xs">…</span> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const { user, accessToken } = useAuth();
  const { t } = usePreferences();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const loadGoals = useCallback(async () => {
    if (!companyId || !token) return;
    try {
      const data = await api.goals.list(companyId, token);
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.goals.failedToLoad));
    } finally {
      setLoading(false);
    }
  }, [companyId, token, t]);

  useEffect(() => { void loadGoals(); }, [loadGoals]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const goal = await api.goals.create(companyId, token, {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
      });
      setGoals((prev) => [goal, ...prev]);
      setNewTitle('');
      setNewDesc('');
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.goals.failedToCreate));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(goalId: string, status: string) {
    setUpdatingStatusId(goalId);
    try {
      const updated = await api.goals.update(companyId, token, goalId, { status });
      setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, status: updated.status } : g));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.goals.failedToUpdate));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleDelete(goalId: string) {
    if (!confirm(t((d) => d.goals.deleteConfirm))) return;
    setDeletingId(goalId);
    try {
      await api.goals.delete(companyId, token, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.goals.failedToDelete));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.nav.goals)} />
      <PageHeader
        title={t((d) => d.goals.title)}
        description={t((d) => d.goals.subtitle)}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> {t((d) => d.goals.newGoal)}
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
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
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.goals.newGoal)}</h3>
              <Input label={t((d) => d.goals.titleLabel)} required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t((d) => d.goals.titlePlaceholder)} />
              <Input label={t((d) => d.goals.descriptionLabel)} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t((d) => d.goals.descriptionPlaceholder)} />
              <div className="flex gap-2">
                <Button type="submit" loading={saving} size="sm">{saving ? t((d) => d.goals.creating) : t((d) => d.goals.create)}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setCreating(false); setNewTitle(''); setNewDesc(''); }}>{t((d) => d.common.cancel)}</Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title={t((d) => d.goals.noGoalsYet)}
            description={t((d) => d.goals.emptyHint)}
            action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> {t((d) => d.goals.newGoal)}</Button>}
          />
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                updating={updatingStatusId === goal.id}
                deleting={deletingId === goal.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

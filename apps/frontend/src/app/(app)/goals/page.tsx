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

type Goal = { id: string; title: string; status: string; description?: string; targetDate?: string };

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    ACTIVE: 'success', COMPLETED: 'info', CANCELLED: 'error', DRAFT: 'default',
  };
  return map[status] ?? 'default';
}

export default function GoalsPage() {
  const { user, accessToken } = useAuth();
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

  async function loadGoals() {
    if (!companyId || !token) return;
    try {
      const data = await api.goals.list(companyId, token);
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadGoals(); }, [user, accessToken]);

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
      setError(err instanceof Error ? err.message : 'Failed to create goal');
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
      setError(err instanceof Error ? err.message : 'Failed to update goal');
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleDelete(goalId: string) {
    if (!confirm('Delete this goal?')) return;
    setDeletingId(goalId);
    try {
      await api.goals.delete(companyId, token, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Goals" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Track your marketing objectives and key results.</p>
          <Button onClick={() => setCreating(true)} size="sm">+ New Goal</Button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {creating && (
          <Card className="mb-6 p-4">
            <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-gray-900">New Goal</h3>
              <Input label="Title" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Grow MQL pipeline by 30% in Q4" />
              <Input label="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does success look like?" />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} size="sm">{saving ? 'Creating…' : 'Create'}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setCreating(false); setNewTitle(''); setNewDesc(''); }}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl">🎯</p>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No goals yet</h3>
            <p className="mt-2 text-sm text-gray-500">Ask the AI Director to create goals, or use the button above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <Card key={goal.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900">{goal.title}</p>
                    {goal.description && (
                      <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{goal.description}</p>
                    )}
                    {goal.targetDate && (
                      <p className="mt-1 text-xs text-gray-400">
                        Target: {new Date(goal.targetDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={goal.status}
                      onChange={(e) => void handleStatusChange(goal.id, e.target.value)}
                      disabled={updatingStatusId === goal.id}
                      className="rounded-lg border border-gray-200 bg-background px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <Badge variant={statusVariant(goal.status)}>{goal.status}</Badge>
                    <button
                      onClick={() => void handleDelete(goal.id)}
                      disabled={deletingId === goal.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === goal.id ? '…' : 'Delete'}
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

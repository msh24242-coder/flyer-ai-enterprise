'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { CheckSquare, Trash2, Calendar, ChevronDown } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';

type Task = { id: string; title: string; status: string; priority: string; dueDate?: string; description?: string };
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const FILTERS: Array<'all' | TaskStatus> = ['all', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    TODO: 'default', IN_PROGRESS: 'info', DONE: 'success', BLOCKED: 'error', CANCELLED: 'default',
    HIGH: 'error', MEDIUM: 'warning', LOW: 'default',
  };
  return map[status] ?? 'default';
}

function priorityDot(priority: string) {
  const colors: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#94a3b8' };
  return <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: colors[priority] ?? '#94a3b8' }} />;
}

export default function TasksPage() {
  const { user, accessToken } = useAuth();
  const { t, formatDate, pluralize } = usePreferences();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const taskStatusLabels = t((d) => d.enums.taskStatus);
  const taskPriorityLabels = t((d) => d.enums.taskPriority);

  useEffect(() => {
    if (!companyId || !token) return;
    api.tasks.list(companyId, token)
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : t((d) => d.tasks.failedToLoad)))
      .finally(() => setLoading(false));
  }, [companyId, token, t]);

  async function handleStatusChange(taskId: string, status: string) {
    setUpdatingId(taskId);
    try {
      const updated = await api.tasks.update(companyId, token, taskId, { status });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: updated.status } : t));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.tasks.failedToUpdate));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm(t((d) => d.tasks.deleteConfirm))) return;
    setDeletingId(taskId);
    try {
      await api.tasks.delete(companyId, token, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.tasks.failedToDelete));
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.tasks.title)} />
      <PageHeader title={t((d) => d.tasks.title)} description={t((d) => d.tasks.subtitle)} />

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
              {s === 'all' ? t((d) => d.common.all) : taskStatusLabels[s]}
            </button>
          ))}
          <span className="text-xs ms-auto" style={{ color: 'var(--text-tertiary)' }}>
            {pluralize(filtered.length, t((d) => d.units.task))}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={filter === 'all' ? t((d) => d.tasks.noTasksYet) : t((d) => d.tasks.noFilteredTasks, { filter: taskStatusLabels[filter].toLowerCase() })}
            description={filter === 'all' ? t((d) => d.tasks.emptyHint) : t((d) => d.common.tryDifferentFilter)}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all duration-150 hover:shadow-sm"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
              >
                {priorityDot(task.priority)}
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: task.status === 'DONE' ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: task.status === 'DONE' ? 'line-through' : 'none' }}
                  >
                    {task.title}
                  </p>
                  {task.dueDate && (
                    <p className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <Calendar size={10} /> {t((d) => d.tasks.duePrefix, { date: formatDate(task.dueDate) })}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge variant={statusVariant(task.priority)}>{taskPriorityLabels[task.priority as TaskPriority] ?? task.priority}</Badge>
                  <div className="relative">
                    <select
                      value={task.status}
                      onChange={(e) => void handleStatusChange(task.id, e.target.value)}
                      disabled={updatingId === task.id}
                      className="appearance-none rounded-lg border ps-2 pe-6 py-1 text-xs cursor-pointer disabled:opacity-50"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}
                    >
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{taskStatusLabels[s]}</option>)}
                    </select>
                    <ChevronDown size={10} className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <button
                    onClick={() => void handleDelete(task.id)}
                    disabled={deletingId === task.id}
                    className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title={t((d) => d.tasks.deleteTooltip)}
                  >
                    {deletingId === task.id ? <span className="text-xs">…</span> : <Trash2 size={13} />}
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

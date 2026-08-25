'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Task = { id: string; title: string; status: string; priority: string; dueDate?: string; description?: string };

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    TODO: 'default', IN_PROGRESS: 'info', DONE: 'success', BLOCKED: 'error',
    HIGH: 'error', MEDIUM: 'warning', LOW: 'default', URGENT: 'error',
  };
  return map[status] ?? 'default';
}

export default function TasksPage() {
  const { user, accessToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!user || !accessToken) return;
    api.tasks.list(user.companyId, accessToken)
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tasks'))
      .finally(() => setLoading(false));
  }, [user, accessToken]);

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="flex flex-col">
      <Header title="Tasks" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center gap-2 overflow-x-auto">
          {['all', 'TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl">✅</p>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {filter === 'all' ? 'No tasks yet' : `No ${filter.replace('_', ' ').toLowerCase()} tasks`}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {filter === 'all' ? 'The AI Director can create tasks for you.' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900">{task.title}</p>
                    {task.description && (
                      <p className="mt-0.5 truncate text-sm text-gray-500">{task.description}</p>
                    )}
                    {task.dueDate && (
                      <p className="mt-1 text-xs text-gray-400">
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={statusVariant(task.status)}>{task.status.replace('_', ' ')}</Badge>
                    <Badge variant={statusVariant(task.priority)} className="text-[10px]">{task.priority}</Badge>
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

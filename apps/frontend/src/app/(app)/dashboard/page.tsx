'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Goal = { id: string; title: string; status: string; description?: string };
type Campaign = { id: string; title: string; status: string; budget?: number };
type Task = { id: string; title: string; status: string; priority: string; dueDate?: string };

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    ACTIVE: 'success',
    COMPLETED: 'info',
    PAUSED: 'warning',
    CANCELLED: 'error',
    DRAFT: 'default',
    TODO: 'default',
    IN_PROGRESS: 'info',
    DONE: 'success',
    HIGH: 'error',
    MEDIUM: 'warning',
    LOW: 'default',
  };
  return map[status] ?? 'default';
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) return;
    const companyId = user.companyId;

    Promise.all([
      api.goals.list(companyId, accessToken),
      api.campaigns.list(companyId, accessToken),
      api.tasks.list(companyId, accessToken),
    ])
      .then(([g, c, t]) => {
        setGoals(g.slice(0, 5));
        setCampaigns(c.slice(0, 5));
        setTasks(t.filter((task) => task.status !== 'DONE').slice(0, 5));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [user, accessToken]);

  const stats = [
    { label: 'Active Goals', value: goals.filter((g) => g.status === 'ACTIVE').length, icon: '🎯' },
    { label: 'Active Campaigns', value: campaigns.filter((c) => c.status === 'ACTIVE').length, icon: '📣' },
    { label: 'Open Tasks', value: tasks.filter((t) => t.status !== 'DONE').length, icon: '✅' },
    { label: 'Campaigns Total', value: campaigns.length, icon: '📊' },
  ];

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />

      <div className="flex-1 p-6">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-5">
              {loading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <>
                  <p className="mb-1 text-2xl">{stat.icon}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </>
              )}
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Goals */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Goals</CardTitle>
              <a href="/goals" className="text-xs font-medium text-blue-600 hover:underline">View all</a>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : goals.length === 0 ? (
              <p className="text-sm text-gray-400">No goals yet. Ask the AI Director to create one.</p>
            ) : (
              <ul className="space-y-2">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-gray-700">{g.title}</span>
                    <Badge variant={statusVariant(g.status)}>{g.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Recent Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
              <a href="/campaigns" className="text-xs font-medium text-blue-600 hover:underline">View all</a>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-gray-400">No campaigns yet.</p>
            ) : (
              <ul className="space-y-2">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-gray-700">{c.title}</span>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Open Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Open Tasks</CardTitle>
              <a href="/tasks" className="text-xs font-medium text-blue-600 hover:underline">View all</a>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-400">No open tasks.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-gray-700">{t.title}</span>
                    <Badge variant={statusVariant(t.priority)}>{t.priority}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Target, Megaphone, CheckSquare, BrainCircuit, ArrowRight, TrendingUp } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';

type Goal = { id: string; title: string; status: string };
type Campaign = { id: string; title: string; status: string; budget?: number };
type Task = { id: string; title: string; status: string; priority: string; dueDate?: string };

function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    ACTIVE: 'success', COMPLETED: 'info', PAUSED: 'warning', CANCELLED: 'error', DRAFT: 'default',
    TODO: 'default', IN_PROGRESS: 'info', DONE: 'success', HIGH: 'error', MEDIUM: 'warning', LOW: 'default',
  };
  return map[status] ?? 'default';
}

function SectionCard({
  title,
  href,
  loading,
  empty,
  emptyText,
  children,
}: {
  title: string;
  href: string;
  loading: boolean;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--surface-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <Link
          href={href as never}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <div className="flex-1 px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : empty ? (
          <p className="py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
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
    {
      label: 'Active Goals',
      value: goals.filter((g) => g.status === 'ACTIVE').length,
      icon: Target,
      iconBg: 'var(--info-bg)',
      iconColor: 'var(--info-text)',
    },
    {
      label: 'Active Campaigns',
      value: campaigns.filter((c) => c.status === 'ACTIVE').length,
      icon: Megaphone,
      iconBg: 'var(--success-bg)',
      iconColor: 'var(--success-text)',
    },
    {
      label: 'Open Tasks',
      value: tasks.length,
      icon: CheckSquare,
      iconBg: 'var(--warning-bg)',
      iconColor: 'var(--warning-text)',
    },
    {
      label: 'Total Campaigns',
      value: campaigns.length,
      icon: TrendingUp,
      iconBg: 'var(--bg-muted)',
      iconColor: 'var(--text-secondary)',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {error && (
          <div
            className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}
          >
            {error}
          </div>
        )}

        {/* Welcome banner */}
        {!loading && goals.length === 0 && campaigns.length === 0 && (
          <div
            className="rounded-xl border p-6 bg-gradient-to-r from-blue-600 to-blue-700"
            style={{ borderColor: 'transparent' }}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <BrainCircuit size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white mb-1">
                  Welcome to Marketing OS, {user?.firstName}!
                </h2>
                <p className="text-sm text-blue-100 mb-4">
                  Your AI marketing workspace is ready. Start by asking the AI Director to set up your first campaign.
                </p>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  <BrainCircuit size={14} />
                  Open AI Director
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              iconBg={stat.iconBg}
              iconColor={stat.iconColor}
              loading={loading}
            />
          ))}
        </div>

        {/* Content sections */}
        <div className="grid gap-5 lg:grid-cols-3">
          <SectionCard
            title="Recent Goals"
            href="/goals"
            loading={loading}
            empty={goals.length === 0}
            emptyText="No goals yet — ask the AI Director to create one."
          >
            <ul className="space-y-2.5">
              {goals.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{g.title}</span>
                  <Badge variant={statusVariant(g.status)}>{g.status}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Recent Campaigns"
            href="/campaigns"
            loading={loading}
            empty={campaigns.length === 0}
            emptyText="No campaigns yet."
          >
            <ul className="space-y-2.5">
              {campaigns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                  <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Open Tasks"
            href="/tasks"
            loading={loading}
            empty={tasks.length === 0}
            emptyText="No open tasks — great work!"
          >
            <ul className="space-y-2.5">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{t.title}</span>
                  <Badge variant={statusVariant(t.priority)}>{t.priority}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

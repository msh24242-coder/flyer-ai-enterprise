'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { GitBranch, Zap, ArrowRight } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';

type WorkflowType = 'full_campaign' | 'content_sprint' | 'research_then_strategy';
type TaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING_AGENT';

interface WorkflowTask { taskId: string; agentType: string; status: TaskStatus; }
interface WorkflowResult { workflowType: string; tasks: WorkflowTask[]; }

const WORKFLOWS: { type: WorkflowType; label: string; description: string; agents: string[]; icon: string }[] = [
  {
    type: 'full_campaign',
    label: 'Full Campaign',
    description: 'End-to-end campaign: research, strategy, content, and social posts all in one workflow.',
    agents: ['Research', 'Strategy', 'Content', 'Social'],
    icon: '🚀',
  },
  {
    type: 'content_sprint',
    label: 'Content Sprint',
    description: 'Rapid content generation across formats and social media platforms.',
    agents: ['Content', 'Social'],
    icon: '⚡',
  },
  {
    type: 'research_then_strategy',
    label: 'Research + Strategy',
    description: 'Deep market research followed by strategic campaign planning.',
    agents: ['Research', 'Strategy'],
    icon: '🔬',
  },
];

function statusVariant(s: TaskStatus): BadgeVariant {
  const map: Record<TaskStatus, BadgeVariant> = {
    QUEUED: 'default', RUNNING: 'info', COMPLETED: 'success', FAILED: 'error', CANCELLED: 'default', PENDING_AGENT: 'warning',
  };
  return map[s] ?? 'default';
}

export default function WorkflowsPage() {
  const { user, accessToken } = useAuth();
  const [selectedType, setSelectedType] = useState<WorkflowType>('full_campaign');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTrigger() {
    if (!user || !accessToken || !message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.workflows.trigger(user.companyId, accessToken, selectedType, message.trim());
      setResult(data as WorkflowResult);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger workflow');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Workflows" />
      <PageHeader
        title="Workflow Builder"
        description="Launch multi-agent workflows for complex marketing tasks"
      />

      <div className="flex-1 p-6 space-y-6 max-w-4xl">
        {/* Workflow picker */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Select workflow type
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {WORKFLOWS.map((wf) => {
              const isSelected = selectedType === wf.type;
              return (
                <button
                  key={wf.type}
                  onClick={() => setSelectedType(wf.type)}
                  className="rounded-xl border p-5 text-left transition-all duration-150"
                  style={{
                    background: isSelected ? 'var(--info-bg)' : 'var(--surface-1)',
                    borderColor: isSelected ? 'var(--brand-500)' : 'var(--surface-border)',
                    boxShadow: isSelected ? '0 0 0 1px var(--brand-500)' : 'var(--shadow-xs)',
                  }}
                >
                  <div className="mb-3 text-2xl">{wf.icon}</div>
                  <p className="mb-1 text-sm font-semibold" style={{ color: isSelected ? 'var(--brand-700)' : 'var(--text-primary)' }}>
                    {wf.label}
                  </p>
                  <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{wf.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {wf.agents.map((agent) => (
                      <span key={agent} className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: isSelected ? 'var(--brand-100)' : 'var(--bg-muted)', color: isSelected ? 'var(--brand-700)' : 'var(--text-secondary)' }}>
                        {agent}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message input */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Goal / Campaign Context
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your marketing goal or campaign context… e.g. 'Launch Q4 holiday campaign targeting 25-35 year old fitness enthusiasts with a $20k budget'"
            className="w-full resize-none rounded-lg border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
          />
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={handleTrigger}
              loading={loading}
              disabled={!message.trim()}
            >
              <Zap size={14} />
              {loading ? 'Launching…' : 'Launch Workflow'}
            </Button>
            {!message.trim() && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Add a goal to launch the workflow</p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {result && (
          <div className="animate-fade-in">
            <div className="mb-3 flex items-center gap-2">
              <GitBranch size={16} style={{ color: 'var(--success-text)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Workflow Launched</h3>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
                {result.tasks.length} tasks queued
              </span>
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
              {result.tasks.map((task, i) => (
                <div key={task.taskId}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderBottom: i < result.tasks.length - 1 ? '1px solid var(--surface-border)' : 'none' }}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{task.agentType}</p>
                    <p className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{task.taskId.slice(0, 16)}…</p>
                  </div>
                  <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                  {i < result.tasks.length - 1 && <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Tasks are processed asynchronously. Check the Content and Approvals pages for results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

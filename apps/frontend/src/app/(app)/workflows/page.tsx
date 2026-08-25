'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type WorkflowType = 'full_campaign' | 'content_sprint' | 'research_then_strategy';
type TaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING_AGENT';

interface WorkflowTask {
  taskId: string;
  agentType: string;
  status: TaskStatus;
}

interface WorkflowResult {
  workflowType: string;
  tasks: WorkflowTask[];
}

const WORKFLOW_OPTIONS: { type: WorkflowType; label: string; description: string; agents: string }[] = [
  {
    type: 'full_campaign',
    label: 'Full Campaign',
    description: 'End-to-end campaign creation: Research → Strategy → Content → Social posts',
    agents: 'Research, Strategy, Content, Social',
  },
  {
    type: 'content_sprint',
    label: 'Content Sprint',
    description: 'Rapid content generation: Content → Social media posts across platforms',
    agents: 'Content, Social',
  },
  {
    type: 'research_then_strategy',
    label: 'Research + Strategy',
    description: 'Deep market research followed by strategic campaign planning',
    agents: 'Research, Strategy',
  },
];

function statusVariant(s: TaskStatus): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const map: Record<TaskStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    QUEUED: 'default',
    RUNNING: 'info',
    COMPLETED: 'success',
    FAILED: 'error',
    CANCELLED: 'default',
    PENDING_AGENT: 'warning',
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
    <div className="flex flex-col">
      <Header title="Workflows" />

      <div className="flex-1 space-y-6 p-6">
        {/* Workflow type picker */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Choose Workflow</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {WORKFLOW_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => setSelectedType(opt.type)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  selectedType === opt.type
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                <p className="mt-1 text-xs text-gray-500">{opt.description}</p>
                <p className="mt-2 text-xs font-medium text-blue-600">Agents: {opt.agents}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div>
          <label htmlFor="workflow-message" className="mb-1.5 block text-sm font-medium text-gray-700">
            Goal / Context
          </label>
          <textarea
            id="workflow-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your marketing goal or campaign context… e.g. 'Launch Q4 holiday campaign targeting 25-35 year old fitness enthusiasts'"
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Button
          onClick={handleTrigger}
          disabled={loading || !message.trim()}
          className="w-full sm:w-auto"
        >
          {loading ? 'Launching Workflow…' : 'Launch Workflow'}
        </Button>

        {/* Result */}
        {result && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Queued Tasks</h2>
            <Card className="divide-y divide-gray-100">
              {result.tasks.map((task) => (
                <div key={task.taskId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{task.agentType}</p>
                    <p className="font-mono text-xs text-gray-400">{task.taskId}</p>
                  </div>
                  <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                </div>
              ))}
            </Card>
            <p className="mt-2 text-xs text-gray-400">
              Tasks are processed asynchronously. Check the Content and Approvals pages for output.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type AiConfig = {
  defaultModel?: string;
  monthlyBudgetUsd?: number;
  maxExecutionCostUsd?: number;
  approvalRequired?: boolean;
};

export default function SettingsPage() {
  const { user, accessToken } = useAuth();
  const [aiConfig, setAiConfig] = useState<AiConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  useEffect(() => {
    if (!companyId || !token) return;
    api.company.get(companyId, token)
      .then((data) => setAiConfig((data.aiConfig as AiConfig) ?? {}))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, [user, accessToken]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.company.updateAiConfig(companyId, token, aiConfig as Record<string, unknown>);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Settings" />

      <div className="flex-1 p-6 max-w-2xl">
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Account</h2>
          <p className="mb-4 text-xs text-gray-500">Your profile and account information.</p>
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Company ID</p>
              <p className="font-mono text-xs text-gray-400">{companyId.slice(0, 8)}…</p>
            </div>
          </Card>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold text-gray-900">AI Configuration</h2>
          <p className="mb-4 text-xs text-gray-500">Configure AI agent behaviour and cost limits.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Settings saved.</div>
          )}

          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <Card className="p-4">
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="Default Model"
                  placeholder="claude-opus-5"
                  value={aiConfig.defaultModel ?? ''}
                  onChange={(e) => setAiConfig((c) => ({ ...c, defaultModel: e.target.value || undefined }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Monthly Budget (USD)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="100"
                    value={aiConfig.monthlyBudgetUsd ?? ''}
                    onChange={(e) => setAiConfig((c) => ({ ...c, monthlyBudgetUsd: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                  <Input
                    label="Max Cost Per Execution (USD)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5"
                    value={aiConfig.maxExecutionCostUsd ?? ''}
                    onChange={(e) => setAiConfig((c) => ({ ...c, maxExecutionCostUsd: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="approvalRequired"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={aiConfig.approvalRequired ?? false}
                    onChange={(e) => setAiConfig((c) => ({ ...c, approvalRequired: e.target.checked }))}
                  />
                  <label htmlFor="approvalRequired" className="text-sm text-gray-700">
                    Require approval for all write operations
                  </label>
                </div>
                <Button type="submit" loading={saving} size="sm">Save Settings</Button>
              </form>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

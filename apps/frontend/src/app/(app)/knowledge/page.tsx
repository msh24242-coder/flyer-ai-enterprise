'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type KnowledgeEntry = { id: string; category: string; key: string; value: unknown };

export default function KnowledgePage() {
  const { user, accessToken } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ category: '', key: '', value: '' });
  const [saving, setSaving] = useState(false);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  async function loadEntries() {
    if (!companyId || !token) return;
    try {
      const data = await api.knowledge.list(companyId, token);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEntries(); }, [user, accessToken]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category.trim() || !form.key.trim() || !form.value.trim()) return;
    setSaving(true);
    try {
      let value: unknown = form.value.trim();
      try { value = JSON.parse(form.value.trim()); } catch { /* keep as string */ }
      await api.knowledge.upsert(companyId, token, {
        category: form.category.trim(),
        key: form.key.trim(),
        value,
      });
      setForm({ category: '', key: '', value: '' });
      setCreating(false);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save knowledge');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.knowledge.delete(companyId, token, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  }

  const grouped = entries.reduce<Record<string, KnowledgeEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});

  return (
    <div className="flex flex-col">
      <Header title="Knowledge" />

      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">Structured knowledge your AI agents use to personalize outputs.</p>
          <Button onClick={() => setCreating(true)} size="sm">+ Add Entry</Button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {creating && (
          <Card className="mb-6">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-gray-900">New Knowledge Entry</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Category"
                  required
                  placeholder="e.g. brand"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
                <Input
                  label="Key"
                  required
                  placeholder="e.g. voice"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Value</label>
                <textarea
                  required
                  rows={3}
                  placeholder='Text value or JSON (e.g. "Professional and empathetic")'
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={saving} size="sm">Save</Button>
                <Button variant="secondary" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-4xl">📚</p>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No knowledge entries</h3>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Add company knowledge like brand voice, target audience, products, and positioning.
              Agents use this to personalize all outputs.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{category}</h3>
                <div className="space-y-2">
                  {items.map((entry) => (
                    <Card key={entry.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{entry.key}</p>
                          <p className="mt-0.5 truncate text-sm text-gray-500">
                            {typeof entry.value === 'string'
                              ? entry.value
                              : JSON.stringify(entry.value)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="shrink-0 text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

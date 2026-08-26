'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { BookOpen, Plus, Trash2, Tag } from 'lucide-react';

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

  const loadEntries = useCallback(async () => {
    if (!companyId || !token) return;
    try {
      const data = await api.knowledge.list(companyId, token);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category.trim() || !form.key.trim() || !form.value.trim()) return;
    setSaving(true);
    try {
      let value: unknown = form.value.trim();
      try { value = JSON.parse(form.value.trim()); } catch { /* keep as string */ }
      await api.knowledge.upsert(companyId, token, { category: form.category.trim(), key: form.key.trim(), value });
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

  const categoryColors = ['var(--info-bg)', 'var(--success-bg)', 'var(--warning-bg)', 'var(--bg-muted)'];
  const categoryTextColors = ['var(--info-text)', 'var(--success-text)', 'var(--warning-text)', 'var(--text-secondary)'];

  return (
    <div className="flex flex-col h-full">
      <Header title="Knowledge" />
      <PageHeader
        title="Company Knowledge"
        description="Structured knowledge your AI agents use to personalize all outputs"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> Add Entry
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {creating && (
          <div className="rounded-xl border p-5 animate-fade-in"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-sm)' }}>
            <form onSubmit={handleCreate} className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Knowledge Entry</h3>
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
                <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Value</label>
                <textarea
                  required
                  rows={3}
                  placeholder='Text value or JSON, e.g. "Professional and empathetic"'
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={saving} size="sm">{saving ? 'Saving…' : 'Save Entry'}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setCreating(false); setForm({ category: '', key: '', value: '' }); }}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No knowledge entries"
            description="Add company knowledge like brand voice, target audience, products, and positioning to help your AI agents personalize all outputs."
            action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> Add First Entry</Button>}
          />
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, items], catIdx) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      background: categoryColors[catIdx % categoryColors.length],
                      color: categoryTextColors[catIdx % categoryTextColors.length],
                    }}
                  >
                    <Tag size={10} />
                    {category}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{items.length} entries</span>
                </div>
                <div className="space-y-2">
                  {items.map((entry) => (
                    <div
                      key={entry.id}
                      className="group flex items-start gap-3 rounded-xl border px-5 py-4 transition-all duration-150 hover:shadow-sm"
                      style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{entry.key}</p>
                        <p className="mt-0.5 text-sm line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                          {typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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

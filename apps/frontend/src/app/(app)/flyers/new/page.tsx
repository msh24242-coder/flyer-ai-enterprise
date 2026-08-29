'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { api, friendlyMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const GRID_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default function NewFlyerPage() {
  const { user, accessToken } = useAuth();
  const { t } = usePreferences();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [grid, setGrid] = useState<(typeof GRID_OPTIONS)[number]>(6);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  useEffect(() => {
    if (!companyId || !token) return;
    api.campaigns.list(companyId, token).then(setCampaigns).catch(() => setCampaigns([]));
  }, [companyId, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const flyer = await api.flyers.create(token, {
        title: title.trim(),
        campaignId: campaignId || undefined,
        designData: { layout: { grid } },
      });
      router.push(`/flyers/${flyer.id}/edit` as never);
    } catch (err) {
      setError(friendlyMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.flyers.new.title)} />
      <PageHeader title={t((d) => d.flyers.new.title)} description={t((d) => d.flyers.new.subtitle)} />

      <div className="flex-1 p-6">
        <form onSubmit={handleSubmit} className="max-w-lg space-y-5 rounded-xl border p-6" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
          <Input
            label={t((d) => d.flyers.new.nameLabel)}
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t((d) => d.flyers.new.namePlaceholder)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t((d) => d.flyers.new.campaignLabel)}</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            >
              <option value="">{t((d) => d.flyers.new.campaignNone)}</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t((d) => d.flyers.new.gridLabel)}</label>
            <select
              value={grid}
              onChange={(e) => setGrid(Number(e.target.value) as typeof grid)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            >
              {GRID_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t((d) => d.flyers.new.gridHint)}</p>
          </div>

          {error && (
            <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={saving} size="sm">{saving ? t((d) => d.flyers.new.creating) : t((d) => d.flyers.new.create)}</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/flyers' as never)}>{t((d) => d.common.cancel)}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

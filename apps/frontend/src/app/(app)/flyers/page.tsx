'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { useToast } from '@/context/toast';
import { api, friendlyMessage, type FlyerListItem } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Newspaper, Plus, Search, Copy, Archive, ArchiveRestore, Trash2, Eye, Pencil, Download } from 'lucide-react';

function statusVariant(status: FlyerListItem['status']): BadgeVariant {
  const map: Record<FlyerListItem['status'], BadgeVariant> = {
    DRAFT: 'default',
    IN_REVIEW: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    ARCHIVED: 'default',
  };
  return map[status];
}

export default function FlyersPage() {
  const { accessToken } = useAuth();
  const { t, formatDate } = usePreferences();
  const { show } = useToast();
  const router = useRouter();

  const [flyers, setFlyers] = useState<FlyerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FlyerListItem['status']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const token = accessToken ?? '';

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await api.flyers.list(token);
      setFlyers(data);
      setError(null);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const visible = flyers
    .filter((f) => statusFilter === 'all' || f.status === statusFilter)
    .filter((f) => !search || f.title.toLowerCase().includes(search.toLowerCase()));

  async function handleDuplicate(id: string) {
    setBusyId(id);
    try {
      const dup = await api.flyers.duplicate(token, id);
      setFlyers((prev) => [{ ...dup, campaign: dup.campaign }, ...prev]);
      show(t((d) => d.flyers.actionDuplicate), 'success');
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(flyer: FlyerListItem) {
    const next = window.prompt(t((d) => d.flyers.renamePrompt), flyer.title);
    if (!next || !next.trim() || next.trim() === flyer.title) return;
    setBusyId(flyer.id);
    try {
      const updated = await api.flyers.update(token, flyer.id, { title: next.trim() });
      setFlyers((prev) => prev.map((f) => (f.id === flyer.id ? { ...f, title: updated.title, slug: updated.slug } : f)));
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchiveToggle(flyer: FlyerListItem) {
    const archiving = flyer.status !== 'ARCHIVED';
    if (archiving && !window.confirm(t((d) => d.flyers.archiveConfirm))) return;
    setBusyId(flyer.id);
    try {
      const updated = archiving ? await api.flyers.archive(token, flyer.id) : await api.flyers.unarchive(token, flyer.id);
      setFlyers((prev) => prev.map((f) => (f.id === flyer.id ? { ...f, status: updated.status } : f)));
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t((d) => d.flyers.deleteConfirm))) return;
    setBusyId(id);
    try {
      await api.flyers.delete(token, id);
      setFlyers((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport(id: string) {
    setBusyId(id);
    try {
      const blob = await api.flyers.exportPdf(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flyer.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.nav.flyers)} />
      <PageHeader
        title={t((d) => d.flyers.title)}
        description={t((d) => d.flyers.subtitle)}
        actions={
          <Button size="sm" onClick={() => router.push('/flyers/new' as never)}>
            <Plus size={14} /> {t((d) => d.flyers.newFlyer)}
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t((d) => d.flyers.searchPlaceholder)}
              className="w-full rounded-lg border ps-9 pe-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
          >
            <option value="all">{t((d) => d.flyers.statusAll)}</option>
            {(['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const).map((s) => (
              <option key={s} value={s}>{t((d) => d.flyers.status[s])}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={search ? t((d) => d.flyers.noSearchResults, { search }) : t((d) => d.flyers.noFlyersYet)}
            description={t((d) => d.flyers.emptyHint)}
            action={!search ? <Button size="sm" onClick={() => router.push('/flyers/new' as never)}><Plus size={14} /> {t((d) => d.flyers.newFlyer)}</Button> : undefined}
          />
        ) : (
          <div className="space-y-2">
            {visible.map((flyer) => (
              <div
                key={flyer.id}
                className="group flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all duration-150 hover:shadow-sm"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden" style={{ background: 'var(--info-bg)' }}>
                  {flyer.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flyer.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Newspaper size={16} style={{ color: 'var(--info-text)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/flyers/${flyer.id}/edit` as never} className="font-medium truncate hover:underline" style={{ color: 'var(--text-primary)' }}>
                    {flyer.title}
                  </Link>
                  <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {flyer.campaign?.title ?? t((d) => d.flyers.noCampaign)}
                  </p>
                </div>
                <Badge variant={statusVariant(flyer.status)}>{t((d) => d.flyers.status[flyer.status])}</Badge>
                <p className="hidden sm:block text-xs whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                  {formatDate(flyer.updatedAt)}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconButton title={t((d) => d.flyers.actionPreview)} onClick={() => router.push(`/flyers/${flyer.id}/preview` as never)} disabled={busyId === flyer.id}><Eye size={14} /></IconButton>
                  <IconButton title={t((d) => d.flyers.actionEdit)} onClick={() => router.push(`/flyers/${flyer.id}/edit` as never)} disabled={busyId === flyer.id}><Pencil size={14} /></IconButton>
                  <IconButton title={t((d) => d.flyers.actionExport)} onClick={() => void handleExport(flyer.id)} disabled={busyId === flyer.id}><Download size={14} /></IconButton>
                  <IconButton title={t((d) => d.flyers.actionRename)} onClick={() => void handleRename(flyer)} disabled={busyId === flyer.id}>Aa</IconButton>
                  <IconButton title={t((d) => d.flyers.actionDuplicate)} onClick={() => void handleDuplicate(flyer.id)} disabled={busyId === flyer.id}><Copy size={14} /></IconButton>
                  <IconButton title={t((d) => d.flyers.actionArchive)} onClick={() => void handleArchiveToggle(flyer)} disabled={busyId === flyer.id}>
                    {flyer.status === 'ARCHIVED' ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </IconButton>
                  <IconButton title={t((d) => d.flyers.actionDelete)} danger onClick={() => void handleDelete(flyer.id)} disabled={busyId === flyer.id}><Trash2 size={13} /></IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50 ${danger ? 'text-red-400 hover:bg-red-50 hover:text-red-600' : 'hover:bg-[var(--bg-muted)]'}`}
      style={{ color: danger ? undefined : 'var(--text-secondary)' }}
    >
      {children}
    </button>
  );
}

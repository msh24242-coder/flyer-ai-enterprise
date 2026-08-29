'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { useToast } from '@/context/toast';
import { api, friendlyMessage, type FlyerDetail } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RefreshCw, Download } from 'lucide-react';

export default function FlyerPreviewPage() {
  const params = useParams<{ id: string }>();
  const flyerId = params.id;
  const { accessToken } = useAuth();
  const { t } = usePreferences();
  const { show } = useToast();
  const token = accessToken ?? '';

  const [flyer, setFlyer] = useState<FlyerDetail | null>(null);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [detail, previewHtml] = await Promise.all([
        api.flyers.get(token, flyerId),
        api.flyers.previewHtml(token, flyerId),
      ]);
      setFlyer(detail);
      setHtml(previewHtml);
      setError(null);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, flyerId]);

  useEffect(() => { void load(); }, [load]);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.flyers.exportPdf(token, flyerId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${flyer?.slug ?? 'flyer'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.flyers.preview.title)} />
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-1)' }}>
        <div>
          <Link href={`/flyers/${flyerId}/edit` as never} className="mb-1 inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            <ArrowLeft size={12} className="rtl:-scale-x-100" /> {t((d) => d.flyers.preview.backToEdit)}
          </Link>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{flyer?.title ?? t((d) => d.flyers.preview.title)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} /> {t((d) => d.flyers.preview.refresh)}
          </Button>
          <Button size="sm" loading={exporting} onClick={handleExport}>
            <Download size={14} /> {exporting ? t((d) => d.flyers.exporting) : t((d) => d.flyers.preview.exportPdf)}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6" style={{ background: 'var(--surface-2)' }}>
        {error ? (
          <div className="rounded-xl border px-4 py-3 text-sm max-w-md mx-auto" style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        ) : loading ? (
          <Skeleton className="h-[900px] max-w-3xl mx-auto w-full" />
        ) : (
          <iframe title="flyer-preview-full" srcDoc={html} className="mx-auto block w-full max-w-3xl rounded-lg border bg-white shadow-sm" style={{ borderColor: 'var(--surface-border)', height: '80vh' }} />
        )}
      </div>
    </div>
  );
}

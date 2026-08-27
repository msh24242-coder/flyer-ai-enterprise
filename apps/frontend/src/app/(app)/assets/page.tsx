'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Images, Trash2, Upload } from 'lucide-react';

type Asset = {
  id: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  publicUrl: string;
  tags: string[];
  createdAt: string;
};

export default function AssetsPage() {
  const { user, accessToken } = useAuth();
  const { t } = usePreferences();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const loadAssets = useCallback(async () => {
    if (!companyId || !token) return;
    try {
      const data = await api.assets.list(companyId, token);
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.assets.failedToLoad));
    } finally {
      setLoading(false);
    }
  }, [companyId, token, t]);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const created = await api.assets.upload(companyId, token, file);
        setAssets((prev) => [
          { id: created.id, filename: created.filename, mimeType: file.type, fileSizeBytes: file.size, publicUrl: created.publicUrl, tags: [], createdAt: new Date().toISOString() },
          ...prev,
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.assets.failedToUpload));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(assetId: string) {
    if (!confirm(t((d) => d.assets.deleteConfirm))) return;
    setDeletingId(assetId);
    try {
      await api.assets.delete(companyId, token, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.assets.failedToDelete));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.nav.assets)} />
      <PageHeader
        title={t((d) => d.assets.title)}
        description={t((d) => d.assets.subtitle)}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <Button size="sm" loading={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> {uploading ? t((d) => d.assets.uploading) : t((d) => d.assets.uploadAsset)}
            </Button>
          </>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t((d) => d.assets.sizeLimitHint)}</p>

        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : assets.length === 0 ? (
          <EmptyState
            icon={Images}
            title={t((d) => d.assets.noAssetsYet)}
            description={t((d) => d.assets.emptyHint)}
            action={<Button size="sm" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> {t((d) => d.assets.uploadAsset)}</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group relative overflow-hidden rounded-xl border"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
              >
                <div className="flex h-24 items-center justify-center" style={{ background: 'var(--bg-muted)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.publicUrl} alt={asset.filename} className="h-full w-full object-contain" />
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>{Math.round(asset.fileSizeBytes / 1024)}KB</p>
                </div>
                <button
                  onClick={() => void handleDelete(asset.id)}
                  disabled={deletingId === asset.id}
                  className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-red-500 hover:bg-white disabled:opacity-50"
                  title={t((d) => d.assets.deleteTooltip)}
                >
                  {deletingId === asset.id ? <span className="text-xs">…</span> : <Trash2 size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

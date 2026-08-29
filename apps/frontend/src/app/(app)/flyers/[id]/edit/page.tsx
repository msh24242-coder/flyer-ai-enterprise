'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { useToast } from '@/context/toast';
import { api, friendlyMessage, type FlyerDetail, type Product } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Search, Plus, Trash2, ArrowUp, ArrowDown, FileSpreadsheet, Images,
  Download, Eye, RefreshCw, X, Upload,
} from 'lucide-react';

const GRID_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
function gridColumns(grid: number): number {
  return Math.ceil(Math.sqrt(grid));
}

type Tab = 'items' | 'layout' | 'branding';

export default function FlyerEditorPage() {
  const params = useParams<{ id: string }>();
  const flyerId = params.id;
  const { user, accessToken } = useAuth();
  const { t } = usePreferences();
  const router = useRouter();
  const token = accessToken ?? '';
  const companyId = user?.companyId ?? '';

  const [flyer, setFlyer] = useState<FlyerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('items');

  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.flyers.get(token, flyerId);
      setFlyer(data);
      setError(null);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, flyerId]);

  const refreshPreview = useCallback(async () => {
    if (!token) return;
    setPreviewLoading(true);
    try {
      const html = await api.flyers.previewHtml(token, flyerId);
      setPreviewHtml(html);
    } catch {
      // preview is a convenience panel — a failure here doesn't block editing
    } finally {
      setPreviewLoading(false);
    }
  }, [token, flyerId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (flyer) void refreshPreview(); }, [flyer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshAll() {
    await load();
    await refreshPreview();
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title={t((d) => d.flyers.title)} />
        <div className="p-6 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !flyer) {
    return (
      <div className="flex flex-col h-full">
        <Header title={t((d) => d.flyers.title)} />
        <div className="p-6">
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error ?? t((d) => d.flyers.failedToLoad)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={flyer.title} />
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-1)' }}>
        <div>
          <Link href={'/flyers' as never} className="mb-1 inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            <ArrowLeft size={12} className="rtl:-scale-x-100" /> {t((d) => d.flyers.editor.backToFlyers)}
          </Link>
          <TitleEditor flyer={flyer} token={token} onSaved={(f) => setFlyer(f)} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/flyers/${flyerId}/preview` as never)}>
            <Eye size={14} /> {t((d) => d.flyers.actionPreview)}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex gap-1 border-b" style={{ borderColor: 'var(--surface-border)' }}>
            {(['items', 'layout', 'branding'] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
                style={{
                  borderColor: tab === tabKey ? 'var(--brand-primary, #2563eb)' : 'transparent',
                  color: tab === tabKey ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                {t((d) => d.flyers.editor[tabKey === 'items' ? 'tabItems' : tabKey === 'layout' ? 'tabLayout' : 'tabBranding'])}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
              {error}
            </div>
          )}

          {tab === 'items' && (
            <ItemsTab flyer={flyer} token={token} companyId={companyId} onChanged={refreshAll} />
          )}
          {tab === 'layout' && (
            <LayoutTab flyer={flyer} token={token} onSaved={(f) => { setFlyer(f); void refreshPreview(); }} />
          )}
          {tab === 'branding' && (
            <BrandingTab flyer={flyer} token={token} companyId={companyId} onSaved={(f) => { setFlyer(f); void refreshPreview(); }} />
          )}
        </div>

        {/* Live preview panel — same canonical HTML the PDF export renders */}
        <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col border-s" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--surface-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.flyers.editor.previewPanelTitle)}</p>
            <button onClick={() => void refreshPreview()} title={t((d) => d.flyers.editor.refreshPreview)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--bg-muted)]">
              <RefreshCw size={13} className={previewLoading ? 'animate-spin' : ''} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {previewHtml ? (
              <iframe title="flyer-preview" srcDoc={previewHtml} className="w-full rounded-lg border bg-white" style={{ borderColor: 'var(--surface-border)', height: 900 }} />
            ) : (
              <Skeleton className="h-96 w-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Title (rename) ───────────────────────────────────────────────────────────

function TitleEditor({ flyer, token, onSaved }: { flyer: FlyerDetail; token: string; onSaved: (f: FlyerDetail) => void }) {
  const [value, setValue] = useState(flyer.title);
  const [editing, setEditing] = useState(false);
  const { show } = useToast();

  useEffect(() => setValue(flyer.title), [flyer.title]);

  async function commit() {
    setEditing(false);
    if (!value.trim() || value.trim() === flyer.title) { setValue(flyer.title); return; }
    try {
      const updated = await api.flyers.update(token, flyer.id, { title: value.trim() });
      onSaved(updated);
    } catch (err) {
      show(friendlyMessage(err), 'error');
      setValue(flyer.title);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setValue(flyer.title); setEditing(false); } }}
        className="text-lg font-semibold rounded-lg border px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-500"
        style={{ color: 'var(--text-primary)', borderColor: 'var(--surface-border)', background: 'var(--surface-1)' }}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="text-lg font-semibold hover:underline text-start" style={{ color: 'var(--text-primary)' }}>
      {flyer.title}
    </button>
  );
}

// ── Items tab ─────────────────────────────────────────────────────────────────

function ItemsTab({ flyer, token, companyId, onChanged }: { flyer: FlyerDetail; token: string; companyId: string; onChanged: () => Promise<void> }) {
  const { t } = usePreferences();
  const { show } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: Array<{ row: number; message: string }> } | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageResult, setImageResult] = useState<{ matched: string[]; unmatched: string[] } | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const items = [...flyer.flyerProducts].sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.flyers.importExcel(token, flyer.id, file);
      setImportResult(result);
      show(t((d) => d.flyers.editor.importResultSummary, { imported: result.imported }), 'success');
      await onChanged();
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  async function handleImagesSelected(files: FileList) {
    setUploadingImages(true);
    setImageResult(null);
    try {
      const result = await api.flyers.uploadImages(token, flyer.id, Array.from(files));
      setImageResult(result);
      show(t((d) => d.flyers.editor.imageMatchSummary, { matched: result.matched.length, unmatched: result.unmatched.length }), 'success');
      await onChanged();
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setUploadingImages(false);
      if (imagesInputRef.current) imagesInputRef.current.value = '';
    }
  }

  async function handlePriceChange(productId: string, field: 'displayPrice' | 'originalPrice', value: string) {
    const num = value === '' ? undefined : Number(value);
    if (value !== '' && Number.isNaN(num)) return;
    setBusyProductId(productId);
    try {
      await api.flyers.updateProduct(token, flyer.id, productId, { [field]: num } as never);
      await onChanged();
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleRemove(productId: string) {
    setBusyProductId(productId);
    try {
      await api.flyers.removeProduct(token, flyer.id, productId);
      await onChanged();
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const order = items.map((i) => i.product.id);
    [order[index], order[target]] = [order[target], order[index]];
    try {
      await api.flyers.reorderProducts(token, flyer.id, order);
      await onChanged();
    } catch (err) {
      show(friendlyMessage(err), 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setPickerOpen(true)}><Plus size={14} /> {t((d) => d.flyers.editor.addProduct)}</Button>
        <Button size="sm" variant="secondary" loading={importing} onClick={() => importInputRef.current?.click()}>
          <FileSpreadsheet size={14} /> {importing ? t((d) => d.flyers.editor.importing) : t((d) => d.flyers.editor.importExcel)}
        </Button>
        <input ref={importInputRef} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && void handleImportFile(e.target.files[0])} />
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              const blob = await api.flyers.downloadTemplate(token);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'flyer-catalog-template.xlsx';
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
            } catch (err) { show(friendlyMessage(err), 'error'); }
          }}
        >
          <Download size={14} /> {t((d) => d.flyers.editor.downloadTemplate)}
        </Button>
        <Button size="sm" variant="secondary" loading={uploadingImages} onClick={() => imagesInputRef.current?.click()}>
          <Images size={14} /> {uploadingImages ? t((d) => d.flyers.editor.uploadingImages) : t((d) => d.flyers.editor.uploadImages)}
        </Button>
        <input ref={imagesInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => e.target.files?.length && void handleImagesSelected(e.target.files)} />
      </div>

      {importResult && importResult.errors.length > 0 && (
        <div className="rounded-lg border px-4 py-3 text-xs" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', color: 'var(--warning-text)' }}>
          <p className="font-semibold mb-1">{t((d) => d.flyers.editor.importErrorsTitle)}</p>
          <ul className="list-disc ps-4 space-y-0.5">
            {importResult.errors.map((e, idx) => <li key={idx}>#{e.row}: {e.message}</li>)}
          </ul>
        </div>
      )}
      {imageResult && imageResult.unmatched.length > 0 && (
        <div className="rounded-lg border px-4 py-3 text-xs" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', color: 'var(--warning-text)' }}>
          {t((d) => d.flyers.editor.imageUnmatchedHint, { files: imageResult.unmatched.join(', ') })}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>{t((d) => d.flyers.editor.itemsEmptyHint)}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.product.id} className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                {item.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.product.imageUrl} alt="" className="h-full w-full object-contain" />
                ) : <Images size={14} style={{ color: 'var(--text-tertiary)' }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.product.name}</p>
                {item.product.nameAr && <p className="text-xs truncate" dir="rtl" style={{ color: 'var(--text-tertiary)' }}>{item.product.nameAr}</p>}
                <p className="text-xs font-mono" dir="ltr" style={{ color: 'var(--text-tertiary)' }}>{item.product.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <PriceInput label={t((d) => d.flyers.editor.displayPriceLabel)} value={item.displayPrice} onCommit={(v) => handlePriceChange(item.product.id, 'displayPrice', v)} />
                <PriceInput label={t((d) => d.flyers.editor.originalPriceLabel)} value={item.originalPrice} onCommit={(v) => handlePriceChange(item.product.id, 'originalPrice', v)} />
              </div>
              <div className="flex items-center gap-1">
                <button disabled={index === 0} onClick={() => void handleMove(index, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--bg-muted)] disabled:opacity-30" title={t((d) => d.flyers.editor.moveUp)}>
                  <ArrowUp size={13} className="rtl:-scale-x-100" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button disabled={index === items.length - 1} onClick={() => void handleMove(index, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--bg-muted)] disabled:opacity-30" title={t((d) => d.flyers.editor.moveDown)}>
                  <ArrowDown size={13} className="rtl:-scale-x-100" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button
                  disabled={busyProductId === item.product.id}
                  onClick={() => void handleRemove(item.product.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50"
                  title={t((d) => d.flyers.editor.removeItem)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <ProductPicker
          token={token}
          companyId={companyId}
          flyerId={flyer.id}
          existingProductIds={new Set(items.map((i) => i.product.id))}
          onClose={() => setPickerOpen(false)}
          onAdded={async () => { await onChanged(); }}
        />
      )}
    </div>
  );
}

function PriceInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => setDraft(value == null ? '' : String(value)), [value]);
  return (
    <div className="flex flex-col">
      <label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (value == null ? '' : String(value))) onCommit(draft); }}
        className="w-20 rounded-lg border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

function ProductPicker({ token, companyId, flyerId, existingProductIds, onClose, onAdded }: {
  token: string; companyId: string; flyerId: string; existingProductIds: Set<string>; onClose: () => void; onAdded: () => Promise<void>;
}) {
  const { t, formatCurrency } = usePreferences();
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      api.products.list(companyId, token, search || undefined)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, companyId, token]);

  async function handleAdd(productId: string) {
    setAddingId(productId);
    try {
      await api.flyers.addProduct(token, flyerId, { productId });
      await onAdded();
      setResults((prev) => [...prev]); // keep list, just refresh "already added" state via existingProductIds on re-render
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'var(--bg-overlay)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t((d) => d.flyers.editor.productPickerTitle)} className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border shadow-xl animate-fade-in" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--surface-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.flyers.editor.productPickerTitle)}</h3>
          <button onClick={onClose} aria-label={t((d) => d.flyers.editor.close)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--bg-muted)]"><X size={14} /></button>
        </div>
        <div className="px-5 py-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t((d) => d.flyers.editor.productPickerSearchPlaceholder)}
              className="w-full rounded-lg border ps-9 pe-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-1.5">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>{t((d) => d.flyers.editor.productPickerNoResults)}</p>
          ) : (
            results.map((product) => {
              const already = existingProductIds.has(product.id);
              return (
                <div key={product.id} className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--surface-border)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
                    <p className="text-xs font-mono" dir="ltr" style={{ color: 'var(--text-tertiary)' }}>{product.sku} · {formatCurrency(product.basePrice, product.currency)}</p>
                  </div>
                  <Button size="sm" variant={already ? 'secondary' : 'primary'} disabled={already} loading={addingId === product.id} onClick={() => void handleAdd(product.id)}>
                    {already ? t((d) => d.flyers.editor.productPickerAlreadyAdded) : t((d) => d.flyers.editor.productPickerAdd)}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Layout tab ────────────────────────────────────────────────────────────────

function LayoutTab({ flyer, token, onSaved }: { flyer: FlyerDetail; token: string; onSaved: (f: FlyerDetail) => void }) {
  const { t } = usePreferences();
  const { show } = useToast();
  const [grid, setGrid] = useState<(typeof GRID_OPTIONS)[number]>(flyer.designData.layout?.grid ?? 6);
  const [saving, setSaving] = useState(false);

  useEffect(() => setGrid(flyer.designData.layout?.grid ?? 6), [flyer.designData.layout?.grid]);

  const dirty = grid !== (flyer.designData.layout?.grid ?? 6);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.flyers.update(token, flyer.id, {
        designData: { ...flyer.designData, layout: { grid } },
      });
      onSaved(updated);
      show(t((d) => d.flyers.editor.saved), 'success');
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-4 rounded-xl border p-5" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.flyers.editor.layoutTitle)}</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">{t((d) => d.flyers.editor.gridLabel)}</label>
        <select
          value={grid}
          onChange={(e) => setGrid(Number(e.target.value) as typeof grid)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
        >
          {GRID_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t((d) => d.flyers.editor.gridColumnsHint, { columns: gridColumns(grid) })}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" loading={saving} disabled={!dirty} onClick={handleSave}>{saving ? t((d) => d.flyers.editor.saving) : t((d) => d.flyers.editor.saveLayout)}</Button>
        {dirty && !saving && <span className="text-xs" style={{ color: 'var(--warning-text)' }}>{t((d) => d.flyers.editor.unsavedChanges)}</span>}
      </div>
    </div>
  );
}

// ── Branding tab ──────────────────────────────────────────────────────────────

function BrandingTab({ flyer, token, companyId, onSaved }: { flyer: FlyerDetail; token: string; companyId: string; onSaved: (f: FlyerDetail) => void }) {
  const { t } = usePreferences();
  const { show } = useToast();
  const branding = flyer.designData.branding ?? {};
  const [primary, setPrimary] = useState(branding.colors?.primary ?? '#111827');
  const [secondary, setSecondary] = useState(branding.colors?.secondary ?? '#dc2626');
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl ?? '');
  const [backgroundUrl, setBackgroundUrl] = useState(branding.backgroundUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrimary(flyer.designData.branding?.colors?.primary ?? '#111827');
    setSecondary(flyer.designData.branding?.colors?.secondary ?? '#dc2626');
    setLogoUrl(flyer.designData.branding?.logoUrl ?? '');
    setBackgroundUrl(flyer.designData.branding?.backgroundUrl ?? '');
  }, [flyer.designData.branding]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.flyers.update(token, flyer.id, {
        designData: {
          ...flyer.designData,
          branding: { colors: { primary, secondary }, logoUrl: logoUrl || undefined, backgroundUrl: backgroundUrl || undefined },
        },
      });
      onSaved(updated);
      show(t((d) => d.flyers.editor.saved), 'success');
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File, kind: 'logo' | 'background') {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingBg;
    setUploading(true);
    try {
      const asset = await api.assets.upload(companyId, token, file, ['flyer-branding']);
      if (kind === 'logo') setLogoUrl(asset.publicUrl); else setBackgroundUrl(asset.publicUrl);
    } catch (err) {
      show(friendlyMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-md space-y-5 rounded-xl border p-5" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.flyers.editor.brandingTitle)}</h3>

      <div className="grid grid-cols-2 gap-3">
        <ColorField label={t((d) => d.flyers.editor.primaryColorLabel)} value={primary} onChange={setPrimary} />
        <ColorField label={t((d) => d.flyers.editor.secondaryColorLabel)} value={secondary} onChange={setSecondary} />
      </div>

      <AssetField
        label={t((d) => d.flyers.editor.logoLabel)}
        url={logoUrl}
        uploading={uploadingLogo}
        uploadLabel={t((d) => d.flyers.editor.uploadLogo)}
        removeLabel={t((d) => d.flyers.editor.removeLogo)}
        onPick={() => logoInputRef.current?.click()}
        onRemove={() => setLogoUrl('')}
      />
      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0], 'logo')} />

      <AssetField
        label={t((d) => d.flyers.editor.backgroundLabel)}
        url={backgroundUrl}
        uploading={uploadingBg}
        uploadLabel={t((d) => d.flyers.editor.uploadBackground)}
        removeLabel={t((d) => d.flyers.editor.removeBackground)}
        onPick={() => bgInputRef.current?.click()}
        onRemove={() => setBackgroundUrl('')}
      />
      <input ref={bgInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0], 'background')} />

      <Button size="sm" loading={saving} onClick={handleSave}>{saving ? t((d) => d.flyers.editor.saving) : t((d) => d.flyers.editor.saveBranding)}</Button>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 rounded border cursor-pointer" style={{ borderColor: 'var(--surface-border)' }} />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
      </div>
    </div>
  );
}

function AssetField({ label, url, uploading, uploadLabel, removeLabel, onPick, onRemove }: {
  label: string; url: string; uploading: boolean; uploadLabel: string; removeLabel: string; onPick: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-2)' }}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : <Upload size={16} style={{ color: 'var(--text-tertiary)' }} />}
        </div>
        <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={onPick}>{uploadLabel}</Button>
        {url && <Button type="button" size="sm" variant="ghost" onClick={onRemove}>{removeLabel}</Button>}
      </div>
    </div>
  );
}

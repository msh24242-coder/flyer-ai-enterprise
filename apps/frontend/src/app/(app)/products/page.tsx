'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Package, Trash2, Plus, Search } from 'lucide-react';

type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  basePrice: number;
  costPrice?: number;
  currency: string;
  stockQuantity?: number;
  category?: string;
  tags: string[];
  isActive: boolean;
};

export default function ProductsPage() {
  const { user, accessToken } = useAuth();
  const { t, formatCurrency } = usePreferences();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ sku: '', name: '', description: '', basePrice: '', costPrice: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const loadProducts = useCallback(async (searchTerm?: string) => {
    if (!companyId || !token) return;
    try {
      const data = await api.products.list(companyId, token, searchTerm);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.products.failedToLoad));
    } finally {
      setLoading(false);
    }
  }, [companyId, token, t]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  useEffect(() => {
    const timeout = setTimeout(() => { void loadProducts(search || undefined); }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim() || !form.basePrice) return;
    setSaving(true);
    setError(null);
    try {
      const product = await api.products.create(companyId, token, {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        basePrice: Number(form.basePrice),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        category: form.category.trim() || undefined,
      });
      setProducts((prev) => [product as Product, ...prev]);
      setForm({ sku: '', name: '', description: '', basePrice: '', costPrice: '', category: '' });
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.products.failedToCreate));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm(t((d) => d.products.deleteConfirm))) return;
    setDeletingId(productId);
    try {
      await api.products.delete(companyId, token, productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.products.failedToDelete));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.nav.products)} />
      <PageHeader
        title={t((d) => d.products.title)}
        description={t((d) => d.products.subtitle)}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> {t((d) => d.products.newProduct)}
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t((d) => d.products.searchPlaceholder)}
            className="w-full rounded-lg border ps-9 pe-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
          />
        </div>

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
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.products.newProduct)}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t((d) => d.products.skuLabel)} required value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder={t((d) => d.products.skuPlaceholder)} />
                <Input label={t((d) => d.products.nameLabel)} required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t((d) => d.products.namePlaceholder)} />
              </div>
              <Input label={t((d) => d.products.descriptionLabel)} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t((d) => d.products.descriptionPlaceholder)} />
              <div className="grid grid-cols-3 gap-3">
                <Input label={t((d) => d.products.basePriceLabel)} type="number" min="0" step="0.01" required value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))} />
                <Input label={t((d) => d.products.costPriceLabel)} type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))} />
                <Input label={t((d) => d.products.categoryLabel)} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder={t((d) => d.products.categoryPlaceholder)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={saving} size="sm">{saving ? t((d) => d.products.creating) : t((d) => d.products.create)}</Button>
                <Button variant="secondary" size="sm" onClick={() => setCreating(false)}>{t((d) => d.common.cancel)}</Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title={search ? t((d) => d.products.noSearchResults, { search }) : t((d) => d.products.noProductsYet)}
            description={t((d) => d.products.emptyHint)}
            action={!search ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> {t((d) => d.products.newProduct)}</Button> : undefined}
          />
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="group flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all duration-150 hover:shadow-sm"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--info-bg)' }}>
                  <Package size={16} style={{ color: 'var(--info-text)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
                    {!product.isActive && <Badge variant="default">{t((d) => d.products.inactiveBadge)}</Badge>}
                  </div>
                  <p className="text-xs font-mono" dir="ltr" style={{ color: 'var(--text-tertiary)' }}>{product.sku}</p>
                </div>
                {product.category && (
                  <span className="hidden sm:inline text-xs rounded-full px-2.5 py-1" style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                    {product.category}
                  </span>
                )}
                <p className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(product.basePrice, product.currency)}
                </p>
                <button
                  onClick={() => void handleDelete(product.id)}
                  disabled={deletingId === product.id}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50"
                  title={t((d) => d.products.deleteTooltip)}
                >
                  {deletingId === product.id ? <span className="text-xs">…</span> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

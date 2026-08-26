'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { FileText, ChevronDown, ChevronUp, Trash2, Copy, Check } from 'lucide-react';
import type { BadgeVariant } from '@/components/ui/badge';

type ContentItem = { id: string; agentType: string; contentType: string; title?: string; content: string; createdAt: string };

const CONTENT_TYPE_LABELS: Record<string, string> = {
  social_post: 'Social Post', email_brief: 'Email Brief', blog_outline: 'Blog Outline',
  ad_copy: 'Ad Copy', content_calendar: 'Content Calendar', strategy: 'Strategy',
  campaign_plan: 'Campaign Plan', copy: 'Copy',
};

function agentBadgeVariant(agentType: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = { CONTENT: 'info', SOCIAL: 'success', STRATEGY: 'warning', DIRECTOR: 'default' };
  return map[agentType] ?? 'default';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs font-medium transition-colors"
      style={{ color: copied ? 'var(--success-text)' : 'var(--text-tertiary)' }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function ContentPage() {
  const { user, accessToken } = useAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  useEffect(() => {
    if (!companyId || !token) return;
    setLoading(true);
    api.content.list(companyId, token, filter !== 'all' ? filter : undefined)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load content'))
      .finally(() => setLoading(false));
  }, [user, accessToken, filter]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this content?')) return;
    setDeletingId(id);
    try {
      await api.content.delete(companyId, token, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  const contentTypes = [...new Set(items.map((i) => i.contentType))];

  return (
    <div className="flex flex-col h-full">
      <Header title="Content" />
      <PageHeader title="Content Studio" description="AI-generated content — social posts, copy, strategies, and more" />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {['all', ...contentTypes].map((ct) => (
            <button
              key={ct}
              onClick={() => setFilter(ct)}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
              style={
                filter === ct
                  ? { background: 'var(--brand-600)', color: '#fff', border: '1px solid transparent' }
                  : { background: 'var(--surface-1)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }
              }
            >
              {ct === 'all' ? 'All' : (CONTENT_TYPE_LABELS[ct] ?? ct)}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border px-4 py-3 text-sm animate-fade-in"
            style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No content yet"
            description="Ask the AI Director to generate content — social posts, email briefs, ad copy, and more will appear here."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isExpanded = expanded === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border overflow-hidden transition-all duration-150 hover:shadow-sm"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
                >
                  <div
                    className="flex cursor-pointer items-start gap-4 px-5 py-4"
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                  >
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--info-bg)' }}>
                      <FileText size={14} style={{ color: 'var(--info-text)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {item.title ?? (CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType)}
                        </p>
                        <Badge variant={agentBadgeVariant(item.agentType)}>{item.agentType}</Badge>
                        <Badge variant="default">{CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType}</Badge>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {!isExpanded && (
                        <p className="mt-1.5 line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.content}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(item.id); }}
                        disabled={deletingId === item.id}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingId === item.id ? <span className="text-xs">…</span> : <Trash2 size={13} />}
                      </button>
                      {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-5 py-4" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)' }}>
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {item.content}
                      </pre>
                      <div className="mt-3">
                        <CopyButton text={item.content} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

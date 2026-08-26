'use client';

import { useState, useRef, useEffect, useMemo, KeyboardEvent } from 'react';
import { useAuth } from '@/context/auth';
import { api, friendlyMessage } from '@/lib/api';
import {
  BrainCircuit, Plus, Trash2, Send, ChevronLeft, ChevronRight,
  Sparkles, Target, Megaphone, BookOpen, Search, Pencil, Archive,
  Square, RotateCcw, Wrench, CheckCircle2, XCircle, Loader2, ShieldAlert, Check, X,
} from 'lucide-react';

interface ToolActivity {
  toolName: string;
  status: 'running' | 'done' | 'error';
  durationMs?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
  toolActivity?: ToolActivity[];
  isStreaming?: boolean;
  failed?: boolean;
  pendingApprovalId?: string;
}

interface Conversation {
  id: string;
  title?: string;
  status: string;
  agentType: string;
  createdAt: string;
  updatedAt: string;
  totalCostUsd?: number;
}

interface ApprovalDetail {
  id: string;
  toolName: string;
  agentType: string;
  toolInput: unknown;
  reason?: string;
  status: string;
}

const SUGGESTIONS = [
  { icon: Target, text: 'What should our marketing focus be this quarter?' },
  { icon: Megaphone, text: 'Create a Q4 lead generation campaign for us' },
  { icon: BookOpen, text: 'What do you know about our brand voice?' },
  { icon: Sparkles, text: 'Analyze our current marketing performance' },
];

const TOOL_VERB_LABELS: Record<string, string> = {
  list: 'Listing', create: 'Creating', update: 'Updating', search: 'Searching',
  store: 'Storing', analyze: 'Analyzing', get: 'Getting', review: 'Reviewing',
  delete: 'Deleting', generate: 'Generating', find: 'Finding',
};

function humanizeToolName(toolName: string): string {
  const [verb, ...rest] = toolName.split('_');
  const label = TOOL_VERB_LABELS[verb] ?? (verb.charAt(0).toUpperCase() + verb.slice(1));
  const subject = rest.join(' ');
  return subject ? `${label} ${subject}…` : `${label}…`;
}

function Bubble({ msg, onOpenApproval }: { msg: Message; onOpenApproval: (id: string) => void }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 mb-5 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
          <BrainCircuit size={14} className="text-white" />
        </div>
      )}
      <div className={`flex flex-col gap-2 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && msg.toolActivity && msg.toolActivity.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {msg.toolActivity.map((activity, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}
              >
                {activity.status === 'running' ? (
                  <Loader2 size={12} className="animate-spin text-blue-500" />
                ) : activity.status === 'error' ? (
                  <XCircle size={12} className="text-red-500" />
                ) : (
                  <CheckCircle2 size={12} className="text-green-500" />
                )}
                <Wrench size={11} className="opacity-50" />
                <span>{humanizeToolName(activity.toolName)}</span>
              </div>
            ))}
          </div>
        )}

        {(msg.content || !msg.isStreaming) && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${msg.failed ? 'opacity-60' : ''}`}
            style={
              isUser
                ? { background: 'var(--brand-600)', color: '#ffffff' }
                : { background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }
            }
          >
            <p className="whitespace-pre-wrap">
              {msg.content}
              {msg.isStreaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />}
            </p>
            {msg.meta && <p className="mt-2 text-xs opacity-60">{msg.meta}</p>}
          </div>
        )}

        {msg.pendingApprovalId && (
          <button
            onClick={() => onOpenApproval(msg.pendingApprovalId!)}
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition-colors hover:brightness-95"
            style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', color: 'var(--warning-text)' }}
          >
            <ShieldAlert size={14} />
            This action needs your approval — review
          </button>
        )}
      </div>
    </div>
  );
}

function ApprovalModal({
  approval, loading, error, onApprove, onDeny, onClose,
}: {
  approval: ApprovalDetail | null;
  loading: boolean;
  error: string | null;
  onApprove: (note?: string) => void;
  onDeny: (note?: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'var(--bg-overlay)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-xl animate-fade-in"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--warning-bg)' }}>
            <ShieldAlert size={18} style={{ color: 'var(--warning-text)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Approval required</h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>An agent wants to perform a sensitive action</p>
          </div>
        </div>

        {loading ? (
          <div className="skeleton h-24 rounded-lg" />
        ) : error ? (
          <p className="text-sm" style={{ color: 'var(--error-text)' }}>{error}</p>
        ) : approval ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Agent</p>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{approval.agentType}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Tool</p>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{approval.toolName}</p>
              {approval.reason && (
                <>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Reason</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{approval.reason}</p>
                </>
              )}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note…"
              rows={2}
              className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2">
              <button
                disabled={submitting !== null}
                onClick={() => { setSubmitting('deny'); onDeny(note || undefined); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-muted)] disabled:opacity-50"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}
              >
                <X size={14} /> Deny
              </button>
              <button
                disabled={submitting !== null}
                onClick={() => { setSubmitting('approve'); onApprove(note || undefined); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                style={{ background: 'var(--brand-600)' }}
              >
                <Check size={14} /> Approve
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConvItem({
  conv, active, onSelect, onDelete, onRename, onArchive,
}: {
  conv: Conversation; active: boolean; onSelect: () => void; onDelete: () => void;
  onRename: (title: string) => void; onArchive: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title ?? '');
  const label = conv.title ?? `Chat ${conv.id.slice(0, 8)}`;
  const date = new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) { onRename(draft.trim()); setEditing(false); }
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-full rounded-md border px-2 py-1 text-sm outline-none"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--brand-500)', color: 'var(--text-primary)' }}
        />
        <button onClick={() => { if (draft.trim()) onRename(draft.trim()); setEditing(false); }} className="flex-shrink-0">
          <Check size={14} className="text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-all duration-100"
      style={{
        background: active ? 'var(--info-bg)' : 'transparent',
        border: active ? '1px solid var(--info-border)' : '1px solid transparent',
      }}
      onClick={onSelect}
    >
      <span className="flex-1 truncate text-sm font-medium" style={{ color: active ? 'var(--info-text)' : 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className="flex-shrink-0 text-xs group-hover:hidden" style={{ color: 'var(--text-tertiary)' }}>{date}</span>
      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
        <button
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--bg-muted)] transition-colors"
          onClick={(e) => { e.stopPropagation(); setDraft(conv.title ?? ''); setEditing(true); }}
          title="Rename"
        >
          <Pencil size={11} style={{ color: 'var(--text-tertiary)' }} />
        </button>
        <button
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--bg-muted)] transition-colors"
          onClick={(e) => { e.stopPropagation(); onArchive(); }}
          title="Archive"
        >
          <Archive size={11} style={{ color: 'var(--text-tertiary)' }} />
        </button>
        <button
          className="flex h-5 w-5 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user, accessToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [openApprovalId, setOpenApprovalId] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalDetail | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFailedRef = useRef<string | null>(null);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!companyId || !token) return;
    setLoadingConvs(true);
    api.agent.listConversations(companyId, token)
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, [companyId, token]);

  function refreshConversations() {
    if (!companyId || !token) return;
    api.agent.listConversations(companyId, token).then(setConversations).catch(() => {});
  }

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => (c.title ?? `Chat ${c.id.slice(0, 8)}`).toLowerCase().includes(q));
  }, [conversations, search]);

  function newConversation() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setError(null);
    textareaRef.current?.focus();
  }

  async function deleteConversation(conv: Conversation) {
    if (!companyId || !token) return;
    try {
      await api.agent.deleteConversation(companyId, token, conv.id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (conversationId === conv.id) newConversation();
    } catch (err) {
      setError(friendlyMessage(err));
    }
  }

  async function renameConversation(conv: Conversation, title: string) {
    if (!companyId || !token) return;
    const previous = conversations;
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, title } : c)));
    try {
      await api.agent.renameConversation(companyId, token, conv.id, title);
    } catch (err) {
      setConversations(previous);
      setError(friendlyMessage(err));
    }
  }

  async function archiveConversation(conv: Conversation) {
    if (!companyId || !token) return;
    try {
      await api.agent.archiveConversation(companyId, token, conv.id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (conversationId === conv.id) newConversation();
    } catch (err) {
      setError(friendlyMessage(err));
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setLoading(false);
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === 'assistant' && last.isStreaming) {
        next[next.length - 1] = { ...last, isStreaming: false, meta: 'Stopped' };
      }
      return next;
    });
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading || !user || !accessToken) return;

    lastFailedRef.current = null;
    setMessages((prev) => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: '', isStreaming: true, toolActivity: [] }]);
    setInput('');
    setLoading(true);
    setError(null);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const controller = new AbortController();
    abortRef.current = controller;
    let sawConversationId = conversationId;

    const updateAssistant = (fn: (m: Message) => Message) => {
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (next[idx]?.role === 'assistant') next[idx] = fn(next[idx]);
        return next;
      });
    };

    await api.agent.stream(
      companyId, token, msg, conversationId ?? undefined, undefined,
      {
        onConversationId: (id) => {
          if (!sawConversationId) {
            sawConversationId = id;
            setConversationId(id);
          }
        },
        onToken: (delta) => updateAssistant((m) => ({ ...m, content: m.content + delta })),
        onToolStart: (toolName) => updateAssistant((m) => ({
          ...m, toolActivity: [...(m.toolActivity ?? []), { toolName, status: 'running' }],
        })),
        onToolResult: (toolName, durationMs, isError) => updateAssistant((m) => {
          const activity = [...(m.toolActivity ?? [])];
          const idx = activity.map((a) => a.toolName).lastIndexOf(toolName);
          if (idx !== -1) activity[idx] = { ...activity[idx], status: isError ? 'error' : 'done', durationMs };
          return { ...m, toolActivity: activity };
        }),
        onDone: (result) => {
          const metaParts = [
            result.traceResult?.iterations != null ? `${result.traceResult.iterations} steps` : null,
            result.traceResult?.estimatedCostUsd != null ? `$${Number(result.traceResult.estimatedCostUsd).toFixed(4)}` : null,
          ].filter(Boolean);
          updateAssistant((m) => ({
            ...m,
            content: result.response,
            isStreaming: false,
            meta: metaParts.join(' · ') || undefined,
            pendingApprovalId: result.pendingApprovalId,
          }));
          refreshConversations();
        },
        onError: (message) => {
          lastFailedRef.current = msg;
          setError(message);
          setMessages((prev) => prev.slice(0, -2));
          setInput(msg);
        },
      },
      controller.signal,
    );

    setLoading(false);
    abortRef.current = null;
  }

  function retryLastMessage() {
    const failed = lastFailedRef.current;
    if (failed) sendMessage(failed);
  }

  async function openApproval(id: string) {
    setOpenApprovalId(id);
    setApproval(null);
    setApprovalError(null);
    setApprovalLoading(true);
    try {
      const detail = await api.approvals.getOne(companyId, token, id);
      setApproval(detail as ApprovalDetail);
    } catch (err) {
      setApprovalError(friendlyMessage(err));
    } finally {
      setApprovalLoading(false);
    }
  }

  async function resolveApproval(decision: 'approve' | 'deny', note?: string) {
    if (!openApprovalId) return;
    try {
      if (decision === 'approve') await api.approvals.approve(companyId, token, openApprovalId, note);
      else await api.approvals.deny(companyId, token, openApprovalId, note);
      setOpenApprovalId(null);
      setMessages((prev) => prev.map((m) => (m.pendingApprovalId === openApprovalId ? { ...m, pendingApprovalId: undefined } : m)));
    } catch (err) {
      setApprovalError(friendlyMessage(err));
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-subtle)' }}>
      {/* Conversation sidebar */}
      {sidebarOpen && (
        <div
          className="flex w-60 flex-shrink-0 flex-col border-r"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
        >
          <div className="flex items-center justify-between border-b px-3 py-3" style={{ borderColor: 'var(--surface-border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Conversations
            </span>
            <button
              onClick={newConversation}
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-muted)]"
              title="New conversation"
            >
              <Plus size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <div className="border-b px-2 py-2" style={{ borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)' }}>
              <Search size={12} style={{ color: 'var(--text-tertiary)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {loadingConvs ? (
              <div className="space-y-1.5 px-1 py-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-9 skeleton rounded-lg" />)}
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {search ? 'No matching conversations.' : 'No conversations yet'}
              </p>
            ) : (
              filteredConversations.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === conversationId}
                  onSelect={() => {
                    if (conv.id !== conversationId) {
                      abortRef.current?.abort();
                      setConversationId(conv.id);
                      setMessages([]);
                      setError(null);
                    }
                  }}
                  onDelete={() => deleteConversation(conv)}
                  onRename={(title) => renameConversation(conv, title)}
                  onArchive={() => archiveConversation(conv)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Chat toolbar */}
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-muted)]"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700">
              <BrainCircuit size={12} className="text-white" />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Marketing Director</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
              Live AI
            </span>
          </div>
          <div className="flex-1" />
          <button
            onClick={newConversation}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-muted)]"
            style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}
          >
            <Plus size={12} /> New chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
                <BrainCircuit size={28} className="text-white" />
              </div>
              <h3 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Meet your Marketing Director
              </h3>
              <p className="mb-8 max-w-md text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Your AI marketing expert with access to goals, campaigns, content, and company knowledge.
                Ask anything about your marketing strategy.
              </p>
              <div className="grid max-w-lg gap-2 sm:grid-cols-2 text-left w-full">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => sendMessage(text)}
                    className="flex items-start gap-3 rounded-xl border p-4 text-left text-sm transition-all duration-150 hover:shadow-sm hover:-translate-y-px"
                    style={{
                      background: 'var(--surface-1)',
                      borderColor: 'var(--surface-border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={16} className="mt-0.5 flex-shrink-0 text-blue-500" />
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <Bubble key={i} msg={msg} onOpenApproval={openApproval} />
          ))}

          {error && (
            <div
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in"
              style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}
            >
              <span>{error}</span>
              {lastFailedRef.current && (
                <button
                  onClick={retryLastMessage}
                  className="flex flex-shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-white/40"
                  style={{ borderColor: 'var(--error-border)' }}
                >
                  <RotateCcw size={11} /> Try again
                </button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="border-t px-4 py-3"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
        >
          <div
            className="flex items-end gap-2 rounded-xl border px-4 py-2.5 transition-colors focus-within:border-blue-500"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--surface-border)' }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Marketing Director… (Enter to send, Shift+Enter for newline)"
              disabled={loading}
              aria-label="Message the Marketing Director"
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--text-primary)', maxHeight: 120 }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            {loading ? (
              <button
                onClick={stopGeneration}
                title="Stop generating"
                aria-label="Stop generating"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white transition-all hover:bg-red-700"
                style={{ background: 'var(--error-text)' }}
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                title="Send message"
                aria-label="Send message"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Real AI responses, streamed live · Shift+Enter for newline
          </p>
        </div>
      </div>

      {openApprovalId && (
        <ApprovalModal
          approval={approval}
          loading={approvalLoading}
          error={approvalError}
          onApprove={(note) => resolveApproval('approve', note)}
          onDeny={(note) => resolveApproval('deny', note)}
          onClose={() => setOpenApprovalId(null)}
        />
      )}
    </div>
  );
}

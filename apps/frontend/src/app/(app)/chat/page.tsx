'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import {
  BrainCircuit, Plus, Trash2, Send, ChevronLeft, ChevronRight,
  Sparkles, Target, Megaphone, BookOpen,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
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

const SUGGESTIONS = [
  { icon: Target, text: 'What should our marketing focus be this quarter?' },
  { icon: Megaphone, text: 'Create a Q4 lead generation campaign for us' },
  { icon: BookOpen, text: 'What do you know about our brand voice?' },
  { icon: Sparkles, text: 'Analyze our current marketing performance' },
];

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 mb-5 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
          <BrainCircuit size={14} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        style={
          isUser
            ? { background: 'var(--brand-600)', color: '#ffffff' }
            : { background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }
        }
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.meta && (
          <p className="mt-2 text-xs opacity-60">{msg.meta}</p>
        )}
      </div>
    </div>
  );
}

function ConvItem({
  conv, active, onSelect, onDelete,
}: {
  conv: Conversation; active: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const label = conv.title ?? `Chat ${conv.id.slice(0, 8)}`;
  const date = new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

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
      <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-tertiary)' }}>{date}</span>
      <button
        className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  function newConversation() {
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
    } catch {}
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading || !user || !accessToken) return;

    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    setError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const data = await api.agent.run(companyId, token, msg, conversationId ?? undefined);
      if (!conversationId) setConversationId(data.conversationId);

      const metaParts = [
        data.iterations != null ? `${data.iterations} steps` : null,
        data.estimatedCostUsd != null ? `$${Number(data.estimatedCostUsd).toFixed(4)}` : null,
      ].filter(Boolean);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, meta: metaParts.join(' · ') || undefined },
      ]);
      refreshConversations();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Request failed';
      setError(errMsg);
      setMessages((prev) => prev.slice(0, -1));
      setInput(msg);
    } finally {
      setLoading(false);
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
          className="flex w-56 flex-shrink-0 flex-col border-r"
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

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {loadingConvs ? (
              <div className="space-y-1.5 px-1 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 skeleton rounded-lg" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                No conversations yet
              </p>
            ) : (
              conversations.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === conversationId}
                  onSelect={() => {
                    if (conv.id !== conversationId) {
                      setConversationId(conv.id);
                      setMessages([]);
                      setError(null);
                    }
                  }}
                  onDelete={() => deleteConversation(conv)}
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
                Marketing Director Agent
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
            <Bubble key={i} msg={msg} />
          ))}

          {loading && (
            <div className="flex gap-3 mb-5 animate-fade-in">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
                <BrainCircuit size={14} className="text-white" />
              </div>
              <div
                className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-5 py-3"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-border)' }}
              >
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {error && (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm animate-fade-in"
              style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}
            >
              <span className="font-medium">Error: </span>{error}
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
              placeholder="Ask the Marketing Director… (Enter to send)"
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--text-primary)', maxHeight: 120 }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="mt-2 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Real AI responses · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}

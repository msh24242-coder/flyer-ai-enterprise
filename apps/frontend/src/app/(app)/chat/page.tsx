'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';

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

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          MD
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-blue-600 text-white'
            : 'rounded-tl-sm bg-gray-100 text-gray-900'
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.meta && (
          <p className={`mt-1 text-xs ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
            {msg.meta}
          </p>
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conv,
  active,
  onSelect,
  onDelete,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const label = conv.title ?? `Chat ${conv.id.slice(0, 8)}`;
  const date = new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div
      className={`group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
      }`}
      onClick={onSelect}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <span className="flex-1 truncate">{label}</span>
      <span className="flex-shrink-0 text-xs text-gray-400">{date}</span>
      {showDelete && (
        <button
          className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-600"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete conversation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
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

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!companyId || !token) return;
    setLoadingConvs(true);
    api.agent
      .listConversations(companyId, token)
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
  }

  async function selectConversation(conv: Conversation) {
    if (conv.id === conversationId) return;
    setConversationId(conv.id);
    setMessages([]);
    setError(null);
  }

  async function deleteConversation(conv: Conversation) {
    if (!companyId || !token) return;
    try {
      await api.agent.deleteConversation(companyId, token, conv.id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (conversationId === conv.id) newConversation();
    } catch {
      // silently ignore
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !user || !accessToken) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const data = await api.agent.run(companyId, token, text, conversationId ?? undefined);

      const isNew = !conversationId;
      if (isNew) setConversationId(data.conversationId);

      const meta = [
        data.iterations != null ? `${data.iterations} iter` : null,
        data.estimatedCostUsd != null ? `$${Number(data.estimatedCostUsd).toFixed(4)}` : null,
        data.agentExecutionId ? `exec:${data.agentExecutionId.slice(0, 8)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, meta: meta || undefined },
      ]);

      // Refresh sidebar to show new/updated conversation
      refreshConversations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
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

  const SUGGESTIONS = [
    'What should our marketing focus be this quarter?',
    'Create a Q4 lead generation goal for us',
    'List our current marketing campaigns',
    'What do you know about our brand voice?',
  ];

  return (
    <div className="flex h-screen flex-col">
      <Header title="AI Director" />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="flex w-60 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversations</span>
              <button
                onClick={newConversation}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                title="New chat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {loadingConvs ? (
                <div className="space-y-1.5 px-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-200" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-gray-400">No conversations yet</p>
              ) : (
                conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    active={conv.id === conversationId}
                    onSelect={() => selectConversation(conv)}
                    onDelete={() => deleteConversation(conv)}
                  />
                ))
              )}
            </div>
          </aside>
        )}

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Sub-header */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title={sidebarOpen ? 'Hide history' : 'Show history'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {conversationId && (
                <span className="font-mono text-xs text-gray-400">conv:{conversationId.slice(0, 8)}</span>
              )}
            </div>
            <button
              onClick={newConversation}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              New chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-white px-4 py-6">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white">
                  🎯
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Marketing Director Agent</h3>
                <p className="mb-6 max-w-sm text-sm text-gray-500">
                  Ask about your marketing strategy, goals, campaigns, or tasks. The agent has access to your
                  company knowledge and can create and update records.
                </p>
                <div className="grid max-w-sm gap-2 text-left">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <Bubble key={i} msg={msg} />
            ))}

            {loading && (
              <div className="mb-4 flex justify-start">
                <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  MD
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span className="font-medium">Error: </span>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the Marketing Director… (Enter to send, Shift+Enter for newline)"
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
                style={{ maxHeight: '120px' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-xs text-gray-400">
              Real AI · No fake responses · Connected to {user?.companyId?.slice(0, 8)}…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

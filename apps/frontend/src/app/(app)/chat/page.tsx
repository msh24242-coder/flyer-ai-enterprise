'use client';

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
}

interface DevConfig {
  backendUrl: string;
  companyId: string;
  accessToken: string;
}

const DEFAULT_CONFIG: DevConfig = {
  backendUrl: 'http://localhost:3001',
  companyId: '',
  accessToken: '',
};

// ── Config modal ──────────────────────────────────────────────────────────────

function ConfigModal({
  initial,
  onSave,
}: {
  initial: DevConfig;
  onSave: (c: DevConfig) => void;
}) {
  const [draft, setDraft] = useState(initial);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(draft);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          Marketing Director — Dev Config
        </h2>
        <p className="mb-5 text-sm text-gray-500">
          These credentials are saved to your browser only and never sent anywhere except the
          backend URL you specify.
        </p>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Backend URL</span>
          <input
            type="url"
            required
            value={draft.backendUrl}
            onChange={(e) => setDraft({ ...draft, backendUrl: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Company UUID</span>
          <input
            type="text"
            required
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={draft.companyId}
            onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Run <code className="rounded bg-gray-100 px-1">SELECT id FROM "Company" LIMIT 5;</code> to find it.
          </p>
        </label>

        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            JWT Access Token
          </span>
          <textarea
            required
            rows={3}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={draft.accessToken}
            onChange={(e) => setDraft({ ...draft, accessToken: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Obtain via <code className="rounded bg-gray-100 px-1">POST /auth/login</code>. Token expires in 15 min.
          </p>
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Save &amp; Connect
        </button>
      </form>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [config, setConfig] = useState<DevConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load saved config from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('md_dev_config');
      if (saved) {
        const parsed: DevConfig = JSON.parse(saved);
        setConfig(parsed);
        if (!parsed.companyId || !parsed.accessToken) setShowConfig(true);
      } else {
        setShowConfig(true);
      }
    } catch {
      setShowConfig(true);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleSaveConfig(c: DevConfig) {
    setConfig(c);
    try {
      localStorage.setItem('md_dev_config', JSON.stringify(c));
    } catch {
      // ignore storage errors
    }
    setShowConfig(false);
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    if (!config.accessToken || !config.companyId) {
      setShowConfig(true);
      return;
    }

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${config.backendUrl}/companies/${config.companyId}/agents/marketing-director/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.accessToken}`,
          },
          body: JSON.stringify({
            message: text,
            ...(conversationId ? { conversationId } : {}),
          }),
        },
      );

      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body.message ?? JSON.stringify(body);
        } catch {
          detail = await res.text();
        }
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }

      const data = await res.json();

      if (!conversationId) setConversationId(data.conversationId);

      const meta = [
        data.iterations != null ? `${data.iterations} iter` : null,
        data.estimatedCostUsd != null
          ? `$${Number(data.estimatedCostUsd).toFixed(4)}`
          : null,
        data.agentExecutionId ? `exec:${data.agentExecutionId.slice(0, 8)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, meta: meta || undefined },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
      // Remove the optimistic user message on error
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

  const isConfigured = Boolean(config.companyId && config.accessToken);

  return (
    <>
      {showConfig && (
        <ConfigModal initial={config} onSave={handleSaveConfig} />
      )}

      <div className="flex h-screen flex-col bg-white">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              MD
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Marketing Director</p>
              {conversationId && (
                <p className="font-mono text-xs text-gray-400">
                  conv:{conversationId.slice(0, 8)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConfigured && (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            )}
            <button
              onClick={newConversation}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              New chat
            </button>
            <button
              onClick={() => setShowConfig(true)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Config
            </button>
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white">
                🎯
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                Marketing Director Agent
              </h3>
              <p className="mb-6 max-w-sm text-sm text-gray-500">
                Ask about your marketing strategy, goals, campaigns, or tasks. The agent
                has access to your company knowledge and can create and update records.
              </p>
              <div className="grid max-w-sm gap-2 text-left">
                {[
                  'What should our marketing focus be this quarter?',
                  'Create a Q4 lead generation goal for us',
                  'List our current marketing campaigns',
                  'What do you know about our brand voice?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); }}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {suggestion}
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

        {/* Input area */}
        <div className="border-t border-gray-200 px-4 py-3">
          {!isConfigured && (
            <p className="mb-2 text-center text-xs text-amber-600">
              Configure your backend credentials to start chatting.{' '}
              <button
                onClick={() => setShowConfig(true)}
                className="font-medium underline"
              >
                Open config
              </button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isConfigured
                  ? 'Ask the Marketing Director… (Enter to send, Shift+Enter for newline)'
                  : 'Configure credentials first'
              }
              disabled={!isConfigured || loading}
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
              disabled={!isConfigured || loading || !input.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-gray-400">
            Real AI · No fake responses · Phase 2 developer preview
          </p>
        </div>
      </div>
    </>
  );
}

'use client';

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
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

export default function ChatPage() {
  const { user, accessToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function newConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
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
      const data = await api.agent.run(user.companyId, accessToken, text, conversationId ?? undefined);

      if (!conversationId) setConversationId(data.conversationId);

      const meta = [
        data.iterations != null ? `${data.iterations} iter` : null,
        data.estimatedCostUsd != null ? `$${Number(data.estimatedCostUsd).toFixed(4)}` : null,
        data.agentExecutionId ? `exec:${data.agentExecutionId.slice(0, 8)}` : null,
      ].filter(Boolean).join(' · ');

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, meta: meta || undefined },
      ]);
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

      {/* Sub-header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
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

        {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}

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
            <span className="font-medium">Error: </span>{error}
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
  );
}

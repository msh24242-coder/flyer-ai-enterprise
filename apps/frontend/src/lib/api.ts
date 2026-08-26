const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turns any error thrown by this module into a short, user-safe sentence. Never leaks stack traces. */
function friendlyMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0:
        return 'SH Marketing services are temporarily unavailable. Please check your connection and try again.';
      case 401:
        return 'Your session expired. Please sign in again.';
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return err.message || 'Not found.';
      case 409:
        return err.message || 'This conflicts with existing data.';
      case 422:
        return err.message || 'Some fields need attention.';
      case 429:
        return "You're temporarily rate-limited. Please try again shortly.";
      default:
        return err.status >= 500
          ? 'Marketing Director is temporarily unavailable. Please try again in a moment.'
          : err.message || 'Something went wrong.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

// ── Session handlers ─────────────────────────────────────────────────────────
// AuthProvider registers these once on mount so this module can trigger a
// refresh (and, if that fails, a full logout) without importing auth.tsx
// directly (which would create a circular import: auth.tsx -> api.ts -> auth.tsx).
interface SessionHandlers {
  getRefreshToken: () => string | null;
  onTokensRefreshed: (accessToken: string, refreshToken: string) => void;
  onSessionExpired: () => void;
}
let sessionHandlers: SessionHandlers | null = null;
function setSessionHandlers(handlers: SessionHandlers | null): void {
  sessionHandlers = handlers;
}

// Requests never trigger a refresh for these paths, otherwise a failing
// refresh call could try to refresh itself forever.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

// Single-flight: if 3 requests all get a 401 at once, only one refresh call
// goes out; the other two wait on the same promise.
let inFlightRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!sessionHandlers) return null;
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const refreshToken = sessionHandlers?.getRefreshToken();
      if (!refreshToken) return null;
      try {
        const res = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        sessionHandlers?.onTokensRefreshed(res.accessToken, res.refreshToken);
        return res.accessToken;
      } catch {
        sessionHandlers?.onSessionExpired();
        return null;
      }
    })();
  }
  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}

async function parseErrorBody(res: Response): Promise<{ message: string; code?: string; details?: unknown }> {
  try {
    const body = await res.json();
    const rawMessage = body?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(' ') : (rawMessage ?? `HTTP ${res.status}`);
    return { message, code: body?.error, details: Array.isArray(rawMessage) ? rawMessage : undefined };
  } catch {
    return { message: `HTTP ${res.status}` };
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; skipAuthRetry?: boolean } = {},
): Promise<T> {
  const { token, skipAuthRetry, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Network request failed', 'NETWORK_ERROR');
  }

  const isExemptFromRefresh = NO_REFRESH_PATHS.some((p) => path.startsWith(p));
  if (res.status === 401 && token && !skipAuthRetry && !isExemptFromRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, { ...options, token: newToken, skipAuthRetry: true });
    }
  }

  if (!res.ok) {
    const { message, code, details } = await parseErrorBody(res);
    throw new ApiError(res.status, message, code, details);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; firstName: string; lastName: string; companyId: string };
}

export type RegisterResponse = LoginResponse;

// ── SSE streaming (Marketing Director) ──────────────────────────────────────
// Matches the backend's actual event contract exactly (see
// agent-engine.types.ts AgentStreamEventType and marketing-agent.controller.ts):
// agent_start (carries conversationId), tool_start, tool_result, token,
// agent_done (result.pendingApprovalId set when approval is required),
// agent_error. There is no separate "approval_required" event.

export type AgentStreamEvent =
  | { type: 'agent_start'; agentType: string; conversationId?: string }
  | { type: 'tool_start'; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; durationMs: number; isError: boolean }
  | { type: 'token'; delta: string }
  | {
      type: 'agent_done';
      result: {
        response: string;
        pendingApprovalId?: string;
        traceResult?: { estimatedCostUsd?: number; iterations?: number };
      };
    }
  | { type: 'agent_error'; message: string };

type AgentDoneResult = Extract<AgentStreamEvent, { type: 'agent_done' }>['result'];

export interface AgentStreamHandlers {
  onConversationId?: (conversationId: string) => void;
  onToken?: (delta: string) => void;
  onToolStart?: (toolName: string, input: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, durationMs: number, isError: boolean) => void;
  onDone?: (result: AgentDoneResult) => void;
  onError?: (message: string) => void;
}

function parseSseFrame(frame: string): AgentStreamEvent | null {
  const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice('data: '.length)) as AgentStreamEvent;
  } catch {
    return null;
  }
}

async function streamAgentRun(
  companyId: string,
  token: string,
  message: string,
  conversationId: string | undefined,
  model: string | undefined,
  handlers: AgentStreamHandlers,
  signal?: AbortSignal,
  _skipAuthRetry = false,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/companies/${companyId}/agents/marketing-director/run/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, conversationId, model }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    handlers.onError?.(friendlyMessage(new ApiError(0, 'Network request failed')));
    return;
  }

  if (!res.ok) {
    if (res.status === 401 && !_skipAuthRetry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return streamAgentRun(companyId, newToken, message, conversationId, model, handlers, signal, true);
      }
    }
    const { message: rawMessage } = await parseErrorBody(res);
    handlers.onError?.(friendlyMessage(new ApiError(res.status, rawMessage)));
    return;
  }

  if (!res.body) {
    handlers.onError?.('Marketing Director is temporarily unavailable. Please try again in a moment.');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const event = parseSseFrame(frame);
        if (!event) continue;

        switch (event.type) {
          case 'agent_start':
            if (event.conversationId) handlers.onConversationId?.(event.conversationId);
            break;
          case 'token':
            handlers.onToken?.(event.delta);
            break;
          case 'tool_start':
            handlers.onToolStart?.(event.toolName, event.input);
            break;
          case 'tool_result':
            handlers.onToolResult?.(event.toolName, event.durationMs, event.isError);
            break;
          case 'agent_done':
            handlers.onDone?.(event.result);
            break;
          case 'agent_error':
            handlers.onError?.(event.message);
            break;
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    handlers.onError?.('Connection to Marketing Director was interrupted.');
  }
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    register: (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      companyName: string;
    }) =>
      request<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    refresh: (refreshToken: string) =>
      request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),

    logout: (token: string, refreshToken: string) =>
      request<void>('/auth/logout', {
        method: 'POST',
        token,
        body: JSON.stringify({ refreshToken }),
      }),
  },

  company: {
    get: (companyId: string, token: string) =>
      request<{ id: string; name: string; slug: string; industry?: string; website?: string; aiConfig?: unknown }>(`/companies/${companyId}`, { token }),

    update: (companyId: string, token: string, data: { name?: string; industry?: string; website?: string }) =>
      request<{ id: string; name: string; slug: string; industry?: string; website?: string }>(`/companies/${companyId}`, { method: 'PATCH', token, body: JSON.stringify(data) }),

    getMembers: (companyId: string, token: string) =>
      request<Array<{ id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean }>>(`/companies/${companyId}/members`, { token }),

    updateMemberRole: (companyId: string, token: string, memberId: string, role: string) =>
      request<{ id: string; role: string }>(`/companies/${companyId}/members/${memberId}/role`, { method: 'PATCH', token, body: JSON.stringify({ role }) }),

    removeMember: (companyId: string, token: string, memberId: string) =>
      request<void>(`/companies/${companyId}/members/${memberId}`, { method: 'DELETE', token }),

    getAiConfig: (companyId: string, token: string) =>
      request<Record<string, unknown>>(`/companies/${companyId}/ai/config`, { token }),

    updateAiConfig: (companyId: string, token: string, config: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/companies/${companyId}/ai/config`, { method: 'PUT', token, body: JSON.stringify(config) }),

    getAiUsage: (companyId: string, token: string, from?: string, to?: string) => {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      return request<unknown>(`/companies/${companyId}/ai/usage?${qs}`, { token });
    },

    getAuditLogs: (companyId: string, token: string, resource?: string, limit?: number) => {
      const qs = new URLSearchParams();
      if (resource) qs.set('resource', resource);
      if (limit) qs.set('limit', String(limit));
      return request<Array<{ id: string; action: string; resource: string; resourceId?: string; userId?: string; createdAt: string }>>(`/companies/${companyId}/audit?${qs}`, { token });
    },
  },

  goals: {
    list: (companyId: string, token: string, status?: string) => {
      const qs = status ? `?status=${status}` : '';
      return request<Array<{ id: string; title: string; status: string; description?: string; targetDate?: string }>>(`/companies/${companyId}/marketing/goals${qs}`, { token });
    },
    create: (companyId: string, token: string, data: { title: string; description?: string; status?: string; targetDate?: string }) =>
      request<{ id: string; title: string; status: string; description?: string; targetDate?: string }>(`/companies/${companyId}/marketing/goals`, { method: 'POST', token, body: JSON.stringify(data) }),
    update: (companyId: string, token: string, goalId: string, data: { title?: string; description?: string; status?: string; targetDate?: string }) =>
      request<{ id: string; title: string; status: string; description?: string; targetDate?: string }>(`/companies/${companyId}/marketing/goals/${goalId}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (companyId: string, token: string, goalId: string) =>
      request<void>(`/companies/${companyId}/marketing/goals/${goalId}`, { method: 'DELETE', token }),
  },

  campaigns: {
    list: (companyId: string, token: string, status?: string, goalId?: string) => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (goalId) qs.set('goalId', goalId);
      return request<Array<{ id: string; title: string; status: string; budget?: number; startDate?: string; endDate?: string }>>(`/companies/${companyId}/marketing/campaigns?${qs}`, { token });
    },
    create: (companyId: string, token: string, data: { title: string; description?: string; goalId?: string; status?: string; budget?: number; startDate?: string; endDate?: string }) =>
      request<{ id: string; title: string; status: string; budget?: number; startDate?: string; endDate?: string }>(`/companies/${companyId}/marketing/campaigns`, { method: 'POST', token, body: JSON.stringify(data) }),
    update: (companyId: string, token: string, campaignId: string, data: { title?: string; description?: string; status?: string; budget?: number; startDate?: string; endDate?: string }) =>
      request<{ id: string; title: string; status: string; budget?: number }>(`/companies/${companyId}/marketing/campaigns/${campaignId}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (companyId: string, token: string, campaignId: string) =>
      request<void>(`/companies/${companyId}/marketing/campaigns/${campaignId}`, { method: 'DELETE', token }),
  },

  tasks: {
    list: (companyId: string, token: string, campaignId?: string) => {
      const qs = campaignId ? `?campaignId=${campaignId}` : '';
      return request<Array<{ id: string; title: string; status: string; priority: string; dueDate?: string }>>(`/companies/${companyId}/marketing/tasks${qs}`, { token });
    },
    create: (companyId: string, token: string, data: { title: string; description?: string; campaignId?: string; status?: string; priority?: string; dueDate?: string }) =>
      request<{ id: string; title: string; status: string; priority: string; dueDate?: string }>(`/companies/${companyId}/marketing/tasks`, { method: 'POST', token, body: JSON.stringify(data) }),
    update: (companyId: string, token: string, taskId: string, data: { title?: string; status?: string; priority?: string; dueDate?: string }) =>
      request<{ id: string; title: string; status: string; priority: string }>(`/companies/${companyId}/marketing/tasks/${taskId}`, { method: 'PATCH', token, body: JSON.stringify(data) }),
    delete: (companyId: string, token: string, taskId: string) =>
      request<void>(`/companies/${companyId}/marketing/tasks/${taskId}`, { method: 'DELETE', token }),
  },

  knowledge: {
    list: (companyId: string, token: string, category?: string) => {
      const qs = category ? `?category=${encodeURIComponent(category)}` : '';
      return request<Array<{ id: string; category: string; key: string; value: unknown }>>(`/companies/${companyId}/knowledge${qs}`, { token });
    },
    upsert: (companyId: string, token: string, data: { category: string; key: string; value: unknown }) =>
      request<{ id: string; category: string; key: string; value: unknown }>(`/companies/${companyId}/knowledge`, { method: 'POST', token, body: JSON.stringify(data) }),
    delete: (companyId: string, token: string, knowledgeId: string) =>
      request<void>(`/companies/${companyId}/knowledge/${knowledgeId}`, { method: 'DELETE', token }),
  },

  content: {
    list: (companyId: string, token: string, contentType?: string, agentType?: string) => {
      const qs = new URLSearchParams();
      if (contentType) qs.set('contentType', contentType);
      if (agentType) qs.set('agentType', agentType);
      return request<Array<{ id: string; agentType: string; contentType: string; title?: string; content: string; createdAt: string }>>(`/companies/${companyId}/content?${qs}`, { token });
    },
    getOne: (companyId: string, token: string, id: string) =>
      request<{ id: string; agentType: string; contentType: string; title?: string; content: string; createdAt: string }>(`/companies/${companyId}/content/${id}`, { token }),
    delete: (companyId: string, token: string, id: string) =>
      request<void>(`/companies/${companyId}/content/${id}`, { method: 'DELETE', token }),
  },

  approvals: {
    list: (companyId: string, token: string, status?: string) => {
      const qs = status ? `?status=${status}` : '';
      return request<Array<{ id: string; toolName: string; status: string; agentType: string; toolInput: unknown; reason?: string; reviewNote?: string; createdAt: string }>>(`/companies/${companyId}/approvals${qs}`, { token });
    },
    getOne: (companyId: string, token: string, id: string) =>
      request<{ id: string; toolName: string; status: string; agentType: string; toolInput: unknown; reason?: string; reviewNote?: string; createdAt: string }>(`/companies/${companyId}/approvals/${id}`, { token }),
    approve: (companyId: string, token: string, id: string, reviewNote?: string) =>
      request<unknown>(`/companies/${companyId}/approvals/${id}/approve`, { method: 'PATCH', token, body: JSON.stringify({ reviewNote }) }),
    deny: (companyId: string, token: string, id: string, reviewNote?: string) =>
      request<unknown>(`/companies/${companyId}/approvals/${id}/deny`, { method: 'PATCH', token, body: JSON.stringify({ reviewNote }) }),
  },

  agent: {
    run: (companyId: string, token: string, message: string, conversationId?: string) =>
      request<{ conversationId: string; response: string; iterations?: number; estimatedCostUsd?: number; agentExecutionId?: string }>(`/companies/${companyId}/agents/marketing-director/run`, {
        method: 'POST',
        token,
        body: JSON.stringify({ message, conversationId }),
      }),

    stream: streamAgentRun,

    listConversations: (companyId: string, token: string) =>
      request<Array<{ id: string; title?: string; status: string; agentType: string; createdAt: string; updatedAt: string; totalCostUsd?: number }>>(`/companies/${companyId}/agents/marketing-director/conversations`, { token }),

    renameConversation: (companyId: string, token: string, conversationId: string, title: string) =>
      request<{ id: string; title: string }>(`/companies/${companyId}/agents/marketing-director/conversations/${conversationId}`, { method: 'PATCH', token, body: JSON.stringify({ title }) }),

    archiveConversation: (companyId: string, token: string, conversationId: string) =>
      request<{ id: string; status: string }>(`/companies/${companyId}/agents/marketing-director/conversations/${conversationId}/archive`, { method: 'POST', token, body: '{}' }),

    deleteConversation: (companyId: string, token: string, conversationId: string) =>
      request<void>(`/companies/${companyId}/agents/marketing-director/conversations/${conversationId}`, { method: 'DELETE', token }),
  },

  workflows: {
    trigger: (
      companyId: string,
      token: string,
      workflowType: 'full_campaign' | 'content_sprint' | 'research_then_strategy',
      message: string,
      conversationId?: string,
    ) =>
      request<{
        workflowType: string;
        tasks: Array<{ taskId: string; agentType: string; status: string }>;
      }>(`/companies/${companyId}/workflows`, {
        method: 'POST',
        token,
        body: JSON.stringify({ workflowType, message, conversationId }),
      }),

    getTaskStatus: (companyId: string, token: string, taskId: string) =>
      request<{ id: string; status: string; result?: unknown; errorMessage?: string } | null>(
        `/companies/${companyId}/workflows/tasks/${taskId}`,
        { token },
      ),
  },
};

export { ApiError, friendlyMessage, setSessionHandlers };

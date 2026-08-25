const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? JSON.stringify(body);
    } catch {
      message = await res.text().catch(() => message);
    }
    throw new ApiError(res.status, message);
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

export interface RegisterResponse extends LoginResponse {}

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
    list: (companyId: string, token: string) =>
      request<Array<{ id: string; title: string; status: string; description?: string; targetDate?: string }>>(`/companies/${companyId}/marketing/goals`, { token }),
  },

  campaigns: {
    list: (companyId: string, token: string) =>
      request<Array<{ id: string; title: string; status: string; budget?: number; startDate?: string; endDate?: string }>>(`/companies/${companyId}/marketing/campaigns`, { token }),
  },

  tasks: {
    list: (companyId: string, token: string) =>
      request<Array<{ id: string; title: string; status: string; priority: string; dueDate?: string }>>(`/companies/${companyId}/marketing/tasks`, { token }),
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

    listConversations: (companyId: string, token: string) =>
      request<Array<{ id: string; title?: string; status: string; agentType: string; createdAt: string; updatedAt: string; totalCostUsd?: number }>>(`/companies/${companyId}/agents/marketing-director/conversations`, { token }),

    renameConversation: (companyId: string, token: string, conversationId: string, title: string) =>
      request<{ id: string; title: string }>(`/companies/${companyId}/agents/marketing-director/conversations/${conversationId}`, { method: 'PATCH', token, body: JSON.stringify({ title }) }),

    archiveConversation: (companyId: string, token: string, conversationId: string) =>
      request<{ id: string; status: string }>(`/companies/${companyId}/agents/marketing-director/conversations/${conversationId}/archive`, { method: 'POST', token, body: '{}' }),

    deleteConversation: (companyId: string, token: string, conversationId: string) =>
      request<void>(`/companies/${companyId}/agents/marketing-director/conversations/${conversationId}`, { method: 'DELETE', token }),
  },
};

export { ApiError };

'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'mkt_os_session';

interface StoredSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setState({ user: session.user, accessToken: session.accessToken, isLoading: false });
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    const session: StoredSession = {
      user: res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    };
    saveSession(session);
    setState({ user: res.user, accessToken: res.accessToken, isLoading: false });
    router.push('/dashboard');
  }, [router]);

  const register = useCallback(async (data: Parameters<typeof api.auth.register>[0]) => {
    const res = await api.auth.register(data);
    const session: StoredSession = {
      user: res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    };
    saveSession(session);
    setState({ user: res.user, accessToken: res.accessToken, isLoading: false });
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(async () => {
    const session = loadSession();
    if (session?.accessToken) {
      try {
        await api.auth.logout(session.accessToken, session.refreshToken);
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
      }
    }
    clearSession();
    setState({ user: null, accessToken: null, isLoading: false });
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { MobileNavProvider } from '@/context/mobile-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Zap } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
            <Zap size={20} className="text-white animate-pulse" />
          </div>
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileNavProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}

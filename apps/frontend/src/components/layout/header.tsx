'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth';
import { useMobileNav } from '@/context/mobile-nav';
import { LogOut, ChevronDown, User, Menu } from 'lucide-react';

export function Header({ title }: { title?: string }) {
  const { user, logout } = useAuth();
  const { toggle } = useMobileNav();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b px-4 sm:px-6"
      style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-1)' }}
    >
      <button
        onClick={toggle}
        aria-label="Toggle navigation menu"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-muted)] md:hidden"
      >
        <Menu size={18} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {title && (
        <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
      )}

      <div className="ml-auto relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-[var(--bg-muted)] focus:outline-none"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-semibold text-white shadow-sm">
            {initials}
          </span>
          <span className="hidden text-sm font-medium sm:block" style={{ color: 'var(--text-primary)' }}>
            {user ? `${user.firstName} ${user.lastName}` : 'Account'}
          </span>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 z-20 mt-2 w-56 rounded-xl border py-1 shadow-xl animate-fade-in"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
            >
              {user && (
                <div className="border-b px-4 py-3" style={{ borderColor: 'var(--surface-border)' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="py-1">
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    setMenuOpen(false);
                    window.location.href = '/settings';
                  }}
                >
                  <User size={14} />
                  Profile & Settings
                </button>
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
                  onClick={() => { setMenuOpen(false); logout(); }}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

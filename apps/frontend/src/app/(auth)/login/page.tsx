'use client';

import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { usePreferences } from '@/context/preferences';
import { friendlyMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, BarChart3, Target, BrainCircuit, Info } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const { t } = usePreferences();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const features = [
    { icon: BrainCircuit, label: t((d) => d.auth.login.feature1Title), desc: t((d) => d.auth.login.feature1Desc) },
    { icon: Target, label: t((d) => d.auth.login.feature2Title), desc: t((d) => d.auth.login.feature2Desc) },
    { icon: BarChart3, label: t((d) => d.auth.login.feature3Title), desc: t((d) => d.auth.login.feature3Desc) },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-subtle)' }}>
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#0f1117]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{t((d) => d.sidebar.productName)}</p>
            <p className="text-[10px] text-slate-500">{t((d) => d.auth.login.brandTagline)}</p>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            {t((d) => d.auth.login.brandHeadlineLine1)}<br />
            <span className="text-blue-400">{t((d) => d.auth.login.brandHeadlineLine2)}</span>
          </h2>
          <p className="text-slate-400 text-base mb-10 max-w-sm">
            {t((d) => d.auth.login.brandDescription)}
          </p>
          <div className="space-y-4">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e2433]">
                  <Icon size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600">{t((d) => d.auth.login.footer, { year: 2026 })}</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.sidebar.productName)}</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t((d) => d.auth.login.title)}</h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t((d) => d.auth.login.subtitle)}
            </p>
          </div>

          {sessionExpired && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm animate-fade-in"
              style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)', color: 'var(--info-text)' }}
            >
              <Info size={16} className="mt-0.5 flex-shrink-0" />
              <span>{t((d) => d.auth.login.sessionExpired)}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t((d) => d.auth.login.emailLabel)}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t((d) => d.auth.login.emailPlaceholder)}
            />
            <Input
              label={t((d) => d.auth.login.passwordLabel)}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t((d) => d.auth.login.passwordPlaceholder)}
            />

            {error && (
              <div
                className="rounded-lg border px-4 py-3 text-sm animate-fade-in"
                style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}
              >
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-2">
              {t((d) => d.auth.login.submit)}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t((d) => d.auth.login.noAccount)}{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:underline">
              {t((d) => d.auth.login.createAccount)}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

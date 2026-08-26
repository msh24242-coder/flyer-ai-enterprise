'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Check } from 'lucide-react';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number or symbol', pass: /[\d\W]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const colors = ['var(--error-text)', 'var(--warning-text)', 'var(--warning-text)', 'var(--success-text)'];

  if (!password) return null;

  return (
    <div className="space-y-2 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score] : 'var(--surface-border)' }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(({ label, pass }) => (
          <span key={label} className="flex items-center gap-1 text-xs" style={{ color: pass ? 'var(--success-text)' : 'var(--text-tertiary)' }}>
            <Check size={10} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    companyName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: 'var(--bg-subtle)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Create your workspace</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Start your AI marketing journey
          </p>
        </div>

        <form onSubmit={handleSubmit}
          className="rounded-2xl border p-8 shadow-sm space-y-4"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={update('firstName')}
            />
            <Input
              label="Last name"
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={update('lastName')}
            />
          </div>

          <Input
            label="Company name"
            required
            value={form.companyName}
            onChange={update('companyName')}
            placeholder="Acme Inc."
          />

          <Input
            label="Work email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@company.com"
          />

          <div>
            <Input
              label="Password"
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              placeholder="Min. 8 characters"
              minLength={8}
            />
            <PasswordStrength password={form.password} />
          </div>

          {error && (
            <div
              className="rounded-lg border px-4 py-3 text-sm animate-fade-in"
              style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}
            >
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Create account →
          </Button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

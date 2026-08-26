'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Client-side only; no stack traces are ever rendered to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: 'var(--bg-subtle)' }}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--error-bg)' }}>
        <AlertTriangle size={24} style={{ color: 'var(--error-text)' }} />
      </div>
      <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Something went wrong</h1>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text-tertiary)' }}>
        SH Marketing hit an unexpected error. This has been logged — please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

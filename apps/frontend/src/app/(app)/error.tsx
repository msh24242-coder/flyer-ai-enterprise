'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--error-bg)' }}>
        <AlertTriangle size={24} style={{ color: 'var(--error-text)' }} />
      </div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Something went wrong</h2>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text-tertiary)' }}>
        This page hit an unexpected error. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

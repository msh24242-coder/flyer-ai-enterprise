'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success-text)', Icon: CheckCircle2 },
  error: { bg: 'var(--error-bg)', border: 'var(--error-border)', text: 'var(--error-text)', Icon: XCircle },
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning-text)', Icon: AlertTriangle },
  info: { bg: 'var(--info-bg)', border: 'var(--info-border)', text: 'var(--info-text)', Icon: Info },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const { bg, border, text, Icon } = VARIANT_STYLES[toast.variant];
          return (
            <div
              key={toast.id}
              className="flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg animate-slide-in max-w-sm"
              style={{ background: bg, borderColor: border, color: text }}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

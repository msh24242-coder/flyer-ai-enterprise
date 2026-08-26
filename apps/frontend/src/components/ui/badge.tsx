import { HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: 'var(--bg-muted)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' },
  success: { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  warning: { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
  error:   { background: 'var(--error-bg)',   color: 'var(--error-text)',   border: '1px solid var(--error-border)' },
  info:    { background: 'var(--info-bg)',     color: 'var(--info-text)',    border: '1px solid var(--info-border)' },
};

export function Badge({ variant = 'default', className, style, children, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', className)}
      style={{ ...variantStyles[variant], ...style }}
      {...props}
    >
      {children}
    </span>
  );
}

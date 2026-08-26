import { HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, style, children, ...props }: CardProps) {
  return (
    <div
      className={twMerge('rounded-xl border p-6', className)}
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--surface-border)',
        boxShadow: 'var(--shadow-xs)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={twMerge('mb-4 flex items-center justify-between', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, style, children, ...props }: CardProps) {
  return (
    <h3
      className={twMerge('text-base font-semibold', className)}
      style={{ color: 'var(--text-primary)', ...style }}
      {...props}
    >
      {children}
    </h3>
  );
}

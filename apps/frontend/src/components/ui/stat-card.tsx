import { LucideIcon } from 'lucide-react';
import { Skeleton } from './skeleton';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, iconColor, iconBg, trend, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border p-5" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-xs)' }}>
        <Skeleton className="mb-3 h-10 w-10 rounded-xl" />
        <Skeleton className="mb-1.5 h-7 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-5 transition-all duration-150 hover:shadow-md"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-xs)' }}
    >
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: iconBg ?? 'var(--info-bg)', color: iconColor ?? 'var(--info-text)' }}
      >
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      {trend && (
        <p className="mt-2 text-xs font-medium" style={{ color: trend.value >= 0 ? 'var(--success-text)' : 'var(--error-text)' }}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}

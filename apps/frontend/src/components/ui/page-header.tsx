interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b px-6 py-5"
      style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-1)' }}
    >
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { useTheme, ThemeChoice } from '@/context/theme';
import { usePreferences } from '@/context/preferences';
import { Locale, TimeFormat, LOCALE_LABELS, LOCALES, AVAILABLE_TIMEZONES } from '@/i18n/config';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { User, BrainCircuit, DollarSign, Shield, Check, Monitor, Sun, Moon, Globe, ArrowRight } from 'lucide-react';

type AiConfig = {
  defaultModel?: string;
  monthlyBudgetUsd?: number;
  maxExecutionCostUsd?: number;
  approvalRequired?: boolean;
};

function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-border)' }}>
      <div className="flex items-start gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--surface-border)' }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--info-bg)' }}>
          <Icon size={16} style={{ color: 'var(--info-text)' }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--surface-border)' }}>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function SelectField({ id, label, value, onChange, children }: {
  id: string; label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
      >
        {children}
      </select>
    </div>
  );
}

export default function SettingsPage() {
  const { user, accessToken } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    t, locale, setLocale, timezone, setTimezone, timeFormat, setTimeFormat,
  } = usePreferences();
  const [aiConfig, setAiConfig] = useState<AiConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const companyId = user?.companyId ?? '';
  const token = accessToken ?? '';

  const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string; icon: React.ElementType }> = [
    { value: 'system', label: t((d) => d.settings.themeSystem), icon: Monitor },
    { value: 'light', label: t((d) => d.settings.themeLight), icon: Sun },
    { value: 'dark', label: t((d) => d.settings.themeDark), icon: Moon },
  ];

  useEffect(() => {
    if (!companyId || !token) return;
    api.company.get(companyId, token)
      .then((data) => setAiConfig((data.aiConfig as AiConfig) ?? {}))
      .catch((err) => setError(err instanceof Error ? err.message : t((d) => d.settings.failedToLoad)))
      .finally(() => setLoading(false));
  }, [companyId, token, t]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.company.updateAiConfig(companyId, token, aiConfig as Record<string, unknown>);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t((d) => d.settings.failedToSave));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={t((d) => d.settings.title)} />
      <PageHeader title={t((d) => d.settings.title)} description={t((d) => d.settings.subtitle)} />

      <div className="flex-1 p-6 max-w-2xl space-y-5">
        {/* Account info */}
        <Section icon={User} title={t((d) => d.settings.accountTitle)} description={t((d) => d.settings.accountDesc)}>
          {user ? (
            <div>
              <Row label={t((d) => d.settings.nameLabel)} value={`${user.firstName} ${user.lastName}`} />
              <Row label={t((d) => d.settings.emailLabel)} value={user.email} />
              <Row label={t((d) => d.settings.roleLabel)} value={user.role ?? 'Member'} />
              <Row label={t((d) => d.settings.companyIdLabel)} value={`${companyId.slice(0, 8)}…`} />
            </div>
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </Section>

        {/* Appearance */}
        <Section icon={Monitor} title={t((d) => d.settings.appearanceTitle)} description={t((d) => d.settings.appearanceDesc)}>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className="flex flex-col items-center gap-2 rounded-xl border py-4 text-sm font-medium transition-colors"
                style={{
                  background: theme === value ? 'var(--info-bg)' : 'var(--surface-2)',
                  borderColor: theme === value ? 'var(--info-border)' : 'var(--surface-border)',
                  color: theme === value ? 'var(--info-text)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </Section>

        {/* Preferences: language, timezone, time format */}
        <Section icon={Globe} title={t((d) => d.settings.preferencesTitle)} description={t((d) => d.settings.preferencesDesc)}>
          <div className="space-y-4">
            <SelectField
              id="pref-language"
              label={t((d) => d.settings.languageLabel)}
              value={locale}
              onChange={(v) => setLocale(v as Locale)}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
              ))}
            </SelectField>

            <SelectField
              id="pref-timezone"
              label={t((d) => d.settings.timezoneLabel)}
              value={timezone}
              onChange={setTimezone}
            >
              {AVAILABLE_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </SelectField>

            <SelectField
              id="pref-time-format"
              label={t((d) => d.settings.timeFormatLabel)}
              value={timeFormat}
              onChange={(v) => setTimeFormat(v as TimeFormat)}
            >
              <option value="24h">{t((d) => d.settings.timeFormat24)}</option>
              <option value="12h">{t((d) => d.settings.timeFormat12)}</option>
            </SelectField>
          </div>
        </Section>

        {/* AI Config */}
        <Section icon={BrainCircuit} title={t((d) => d.settings.aiConfigTitle)} description={t((d) => d.settings.aiConfigDesc)}>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="default-model" className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t((d) => d.settings.defaultModelLabel)}</label>
                <select
                  id="default-model"
                  value={aiConfig.defaultModel ?? 'claude-opus-5'}
                  onChange={(e) => setAiConfig((c) => ({ ...c, defaultModel: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }}
                >
                  <option value="claude-opus-5">Claude Opus 5 (Most capable)</option>
                  <option value="claude-sonnet-5">Claude Sonnet 5 (Balanced)</option>
                  <option value="claude-haiku-4-5">Claude Haiku 4.5 (Fast)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t((d) => d.settings.monthlyBudgetLabel)}
                  type="number" step="0.01" min="0" placeholder="100"
                  value={aiConfig.monthlyBudgetUsd ?? ''}
                  onChange={(e) => setAiConfig((c) => ({ ...c, monthlyBudgetUsd: e.target.value ? Number(e.target.value) : undefined }))}
                />
                <Input
                  label={t((d) => d.settings.maxCostLabel)}
                  type="number" step="0.01" min="0" placeholder="5"
                  value={aiConfig.maxExecutionCostUsd ?? ''}
                  onChange={(e) => setAiConfig((c) => ({ ...c, maxExecutionCostUsd: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>

              {/* Approval toggle */}
              <div
                className="flex items-center justify-between rounded-xl border p-4 cursor-pointer"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-border)' }}
                onClick={() => setAiConfig((c) => ({ ...c, approvalRequired: !c.approvalRequired }))}
              >
                <div className="flex items-center gap-3">
                  <Shield size={16} style={{ color: 'var(--text-secondary)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t((d) => d.settings.approvalRequiredLabel)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t((d) => d.settings.approvalRequiredDesc)}</p>
                  </div>
                </div>
                <div
                  className="relative flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{ background: aiConfig.approvalRequired ? 'var(--brand-600)' : 'var(--surface-border)' }}
                >
                  <span
                    className="absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                    style={{ insetInlineStart: aiConfig.approvalRequired ? '24px' : '4px' }}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border px-4 py-3 text-sm"
                  style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error-text)' }}>
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
                  style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }}>
                  <Check size={14} /> {t((d) => d.settings.settingsSaved)}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" loading={saving} size="sm">
                  {saving ? t((d) => d.common.saving) : t((d) => d.settings.saveSettings)}
                </Button>
              </div>
            </form>
          )}
        </Section>

        {/* Billing info */}
        <Section icon={DollarSign} title={t((d) => d.settings.billingTitle)} description={t((d) => d.settings.billingDesc)}>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t((d) => d.settings.billingHint)}
          </p>
          <Link
            href="/usage"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {t((d) => d.nav.aiUsage)} <ArrowRight size={12} className="rtl:rotate-180" />
          </Link>
        </Section>
      </div>
    </div>
  );
}

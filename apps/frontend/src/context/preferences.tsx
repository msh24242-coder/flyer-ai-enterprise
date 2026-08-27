'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import en, { Translations } from '@/i18n/en';
import ar from '@/i18n/ar';
import {
  Locale,
  TimeFormat,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  DEFAULT_TIME_FORMAT,
  dirForLocale,
} from '@/i18n/config';
import {
  formatDate as formatDateBase,
  formatDateLong as formatDateLongBase,
  formatTime as formatTimeBase,
  formatDateTime as formatDateTimeBase,
  formatRelativeTime as formatRelativeTimeBase,
  formatNumber as formatNumberBase,
  formatCompactNumber as formatCompactNumberBase,
  formatCurrency as formatCurrencyBase,
  formatPercent as formatPercentBase,
  pluralize as pluralizeBase,
} from '@/lib/format';

const DICTIONARIES: Record<Locale, Translations> = { en, ar };

interface StoredPreferences {
  locale: Locale;
  timezone: string;
  timeFormat: TimeFormat;
}

const STORAGE_KEY = 'sh_marketing_preferences';

function loadStored(): StoredPreferences {
  const fallback: StoredPreferences = {
    locale: DEFAULT_LOCALE,
    timezone: DEFAULT_TIMEZONE,
    timeFormat: DEFAULT_TIME_FORMAT,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
    return {
      locale: parsed.locale === 'ar' || parsed.locale === 'en' ? parsed.locale : fallback.locale,
      timezone: typeof parsed.timezone === 'string' && parsed.timezone ? parsed.timezone : fallback.timezone,
      timeFormat: parsed.timeFormat === '12h' || parsed.timeFormat === '24h' ? parsed.timeFormat : fallback.timeFormat,
    };
  } catch {
    return fallback;
  }
}

function applyDocumentAttrs(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirForLocale(locale);
}

type Selector<T> = (dict: Translations) => T;
type InterpolateParams = Record<string, string | number>;

interface PreferencesContextValue {
  locale: Locale;
  timezone: string;
  timeFormat: TimeFormat;
  setLocale: (locale: Locale) => void;
  setTimezone: (timezone: string) => void;
  setTimeFormat: (timeFormat: TimeFormat) => void;
  t: <T>(selector: Selector<T>, params?: InterpolateParams) => T;
  formatDate: (value: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
  formatDateLong: (value: Date | string | number) => string;
  formatTime: (value: Date | string | number) => string;
  formatDateTime: (value: Date | string | number) => string;
  formatRelativeTime: (value: Date | string | number) => string;
  formatNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatCompactNumber: (value: number) => string;
  formatCurrency: (value: number, currency?: string, opts?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number) => string;
  pluralize: (count: number, forms: { one: string; other: string }) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function interpolate(value: unknown, params?: InterpolateParams): unknown {
  if (typeof value !== 'string' || !params) return value;
  return Object.entries(params).reduce(
    (acc, [key, val]) => acc.replace(`{${key}}`, String(val)),
    value,
  );
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [timezone, setTimezoneState] = useState<string>(DEFAULT_TIMEZONE);
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(DEFAULT_TIME_FORMAT);

  useEffect(() => {
    const stored = loadStored();
    setLocaleState(stored.locale);
    setTimezoneState(stored.timezone);
    setTimeFormatState(stored.timeFormat);
    applyDocumentAttrs(stored.locale);
  }, []);

  const persist = useCallback((next: Partial<StoredPreferences>) => {
    try {
      const current = loadStored();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...next }));
    } catch {
      // ignore quota errors
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    applyDocumentAttrs(next);
    persist({ locale: next });
  }, [persist]);

  const setTimezone = useCallback((next: string) => {
    setTimezoneState(next);
    persist({ timezone: next });
  }, [persist]);

  const setTimeFormat = useCallback((next: TimeFormat) => {
    setTimeFormatState(next);
    persist({ timeFormat: next });
  }, [persist]);

  const dict = DICTIONARIES[locale];

  const t = useCallback(<T,>(selector: Selector<T>, params?: InterpolateParams): T => {
    return interpolate(selector(dict), params) as T;
  }, [dict]);

  const ctx = useMemo(() => ({ locale, timezone, timeFormat }), [locale, timezone, timeFormat]);
  const formatDate = useCallback((value: Date | string | number, opts?: Intl.DateTimeFormatOptions) => formatDateBase(value, ctx, opts), [ctx]);
  const formatDateLong = useCallback((value: Date | string | number) => formatDateLongBase(value, ctx), [ctx]);
  const formatTime = useCallback((value: Date | string | number) => formatTimeBase(value, ctx), [ctx]);
  const formatDateTime = useCallback((value: Date | string | number) => formatDateTimeBase(value, ctx), [ctx]);
  const formatRelativeTime = useCallback((value: Date | string | number) => formatRelativeTimeBase(value, ctx), [ctx]);
  const formatNumber = useCallback((value: number, opts?: Intl.NumberFormatOptions) => formatNumberBase(value, ctx, opts), [ctx]);
  const formatCompactNumber = useCallback((value: number) => formatCompactNumberBase(value, ctx), [ctx]);
  const formatCurrency = useCallback((value: number, currency?: string, opts?: Intl.NumberFormatOptions) => formatCurrencyBase(value, ctx, currency, opts), [ctx]);
  const formatPercent = useCallback((value: number) => formatPercentBase(value, ctx), [ctx]);
  const pluralize = useCallback((count: number, forms: { one: string; other: string }) => pluralizeBase(count, locale, forms), [locale]);

  return (
    <PreferencesContext.Provider
      value={{
        locale, timezone, timeFormat,
        setLocale, setTimezone, setTimeFormat,
        t,
        formatDate, formatDateLong, formatTime, formatDateTime, formatRelativeTime,
        formatNumber, formatCompactNumber, formatCurrency, formatPercent, pluralize,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}

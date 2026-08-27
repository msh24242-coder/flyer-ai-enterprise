import { Locale, TimeFormat, INTL_LOCALE_TAG, DEFAULT_TIMEZONE, DEFAULT_CURRENCY } from '@/i18n/config';

export interface FormatContext {
  locale: Locale;
  timezone?: string;
  timeFormat?: TimeFormat;
}

function tag(locale: Locale): string {
  return INTL_LOCALE_TAG[locale];
}

/** Always render Western (Latin) digits, even for Arabic, so numbers stay
 *  readable next to currency codes, URLs, SKUs, and English brand names —
 *  per the mixed-content readability requirement. Arabic script/month names
 *  are unaffected; only the digit glyphs are pinned to latn. */
const NUMBERING_SYSTEM = 'latn' as const;

export function formatDate(
  value: Date | string | number,
  ctx: FormatContext,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(tag(ctx.locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: ctx.timezone ?? DEFAULT_TIMEZONE,
    numberingSystem: NUMBERING_SYSTEM,
    ...opts,
  }).format(date);
}

export function formatDateLong(value: Date | string | number, ctx: FormatContext): string {
  return formatDate(value, ctx, { month: 'long' });
}

export function formatTime(value: Date | string | number, ctx: FormatContext): string {
  const date = value instanceof Date ? value : new Date(value);
  const hour12 = (ctx.timeFormat ?? '24h') === '12h';
  return new Intl.DateTimeFormat(tag(ctx.locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
    timeZone: ctx.timezone ?? DEFAULT_TIMEZONE,
    numberingSystem: NUMBERING_SYSTEM,
  }).format(date);
}

export function formatDateTime(value: Date | string | number, ctx: FormatContext): string {
  return `${formatDate(value, ctx)}, ${formatTime(value, ctx)}`;
}

export function formatRelativeTime(value: Date | string | number, ctx: FormatContext): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(tag(ctx.locale), { numeric: 'auto' });

  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

export function formatNumber(
  value: number,
  ctx: FormatContext,
  opts: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(tag(ctx.locale), {
    numberingSystem: NUMBERING_SYSTEM,
    ...opts,
  }).format(value);
}

export function formatCompactNumber(value: number, ctx: FormatContext): string {
  return formatNumber(value, ctx, { notation: 'compact', maximumFractionDigits: 1 });
}

export function formatCurrency(
  value: number,
  ctx: FormatContext,
  currency: string = DEFAULT_CURRENCY,
  opts: Intl.NumberFormatOptions = {},
): string {
  return formatNumber(value, ctx, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  });
}

export function formatPercent(value: number, ctx: FormatContext): string {
  return formatNumber(value, ctx, { style: 'percent', maximumFractionDigits: 1 });
}

/**
 * Locale-aware singular/plural selection. Simplified to the "one" vs "other"
 * boundary (which Intl.PluralRules correctly resolves as count===1 for both
 * en and ar) rather than Arabic's full zero/one/two/few/many/other system —
 * a deliberate, documented scope simplification, not a bug.
 */
export function pluralize(
  count: number,
  locale: Locale,
  forms: { one: string; other: string },
): string {
  const rule = new Intl.PluralRules(tag(locale)).select(count);
  const template = rule === 'one' ? forms.one : forms.other;
  return template.replace('{count}', formatNumber(count, { locale }));
}

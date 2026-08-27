export type Locale = 'en' | 'ar';

export const LOCALES: Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

/** Intl locale tag per UI locale. en-GB (not en-US) so dates read "27 Aug 2026" —
 *  day-month-year, matching the Gulf/international convention this product targets. */
export const INTL_LOCALE_TAG: Record<Locale, string> = {
  en: 'en-GB',
  ar: 'ar-QA',
};

export function dirForLocale(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export type TimeFormat = '12h' | '24h';
export const DEFAULT_TIME_FORMAT: TimeFormat = '24h';

/** IANA identifier only — never store/display vague abbreviations like "GMT+3". */
export const DEFAULT_TIMEZONE = 'Asia/Qatar';

export const AVAILABLE_TIMEZONES = [
  'Asia/Qatar',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Africa/Cairo',
  'Europe/London',
  'UTC',
] as const;

export const DEFAULT_CURRENCY = 'QAR';

import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateLong,
  formatTime,
  formatDateTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  pluralize,
} from './format';
import type { FormatContext } from './format';

const KNOWN_TIMESTAMP = '2026-08-27T14:35:00Z'; // 17:35 in Asia/Qatar (UTC+3)

const enCtx: FormatContext = { locale: 'en', timezone: 'Asia/Qatar', timeFormat: '24h' };
const arCtx: FormatContext = { locale: 'ar', timezone: 'Asia/Qatar', timeFormat: '24h' };

describe('formatDate', () => {
  it('renders English dates as "27 Aug 2026" (day-month-year, en-GB order)', () => {
    expect(formatDate(KNOWN_TIMESTAMP, enCtx)).toBe('27 Aug 2026');
  });

  it('renders Arabic dates with Arabic month names but Western digits', () => {
    const result = formatDate(KNOWN_TIMESTAMP, arCtx);
    expect(result).toBe('27 أغسطس 2026');
    // Never Arabic-Indic digits (٢٧ etc.) — only Latin digits are allowed.
    expect(result).not.toMatch(/[٠-٩]/);
  });

  it('uses Asia/Qatar by default when no timezone is passed', () => {
    const utcMidnight = '2026-08-27T22:30:00Z'; // next day in Asia/Qatar (+3h)
    const withDefault = formatDate(utcMidnight, { locale: 'en' });
    const withExplicitQatar = formatDate(utcMidnight, { locale: 'en', timezone: 'Asia/Qatar' });
    expect(withDefault).toBe(withExplicitQatar);
    expect(withDefault).toBe('28 Aug 2026');
  });

  it('respects a non-default IANA timezone when explicitly set', () => {
    const result = formatDate(KNOWN_TIMESTAMP, { locale: 'en', timezone: 'UTC' });
    expect(result).toBe('27 Aug 2026');
  });
});

describe('formatDateLong', () => {
  it('spells out the full month name in English', () => {
    expect(formatDateLong(KNOWN_TIMESTAMP, enCtx)).toBe('27 August 2026');
  });
});

describe('formatTime', () => {
  it('renders 24-hour time by default', () => {
    expect(formatTime(KNOWN_TIMESTAMP, enCtx)).toBe('17:35');
  });

  it('renders 12-hour time with am/pm when timeFormat is 12h', () => {
    const result = formatTime(KNOWN_TIMESTAMP, { ...enCtx, timeFormat: '12h' });
    expect(result).toMatch(/5:35/);
    expect(result.toLowerCase()).toMatch(/pm/);
  });

  it('renders Arabic time with Western digits', () => {
    const result = formatTime(KNOWN_TIMESTAMP, arCtx);
    expect(result).toBe('17:35');
  });
});

describe('formatDateTime', () => {
  it('combines date and time', () => {
    expect(formatDateTime(KNOWN_TIMESTAMP, enCtx)).toBe('27 Aug 2026, 17:35');
  });
});

describe('formatNumber', () => {
  it('formats English numbers with comma group separators', () => {
    expect(formatNumber(1234567.891, enCtx)).toBe('1,234,567.891');
  });

  it('formats Arabic numbers with Western digits, not Arabic-Indic', () => {
    const result = formatNumber(1234567.891, arCtx);
    expect(result).toBe('1,234,567.891');
    expect(result).not.toMatch(/[٠-٩]/);
  });
});

describe('formatCurrency', () => {
  it('formats QAR currency by default', () => {
    expect(formatCurrency(1500, enCtx)).toContain('1,500.00');
    expect(formatCurrency(1500, enCtx)).toMatch(/QAR/);
  });

  it('formats USD currency when explicitly requested (AI cost figures)', () => {
    const result = formatCurrency(4.1234, enCtx, 'USD', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    expect(result).toContain('4.1234');
    expect(result).toMatch(/\$|USD/);
  });

  it('never uses Arabic-Indic digits for Arabic currency output', () => {
    const result = formatCurrency(1500, arCtx);
    expect(result).not.toMatch(/[٠-٩]/);
  });
});

describe('formatPercent', () => {
  it('formats percentages with at most one decimal', () => {
    expect(formatPercent(0.256, enCtx)).toBe('25.6%');
  });
});

describe('pluralize', () => {
  const forms = { one: '{count} task', other: '{count} tasks' };

  it('selects the singular form for count === 1 in English', () => {
    expect(pluralize(1, 'en', forms)).toBe('1 task');
  });

  it('selects the plural form for count !== 1 in English', () => {
    expect(pluralize(0, 'en', forms)).toBe('0 tasks');
    expect(pluralize(5, 'en', forms)).toBe('5 tasks');
  });

  it('selects the singular form for count === 1 in Arabic', () => {
    const arForms = { one: '{count} مهمة', other: '{count} مهام' };
    expect(pluralize(1, 'ar', arForms)).toBe('1 مهمة');
  });

  it('formats the interpolated count using locale-aware number formatting', () => {
    expect(pluralize(1234, 'en', { one: '{count} item', other: '{count} items' })).toBe('1,234 items');
  });
});

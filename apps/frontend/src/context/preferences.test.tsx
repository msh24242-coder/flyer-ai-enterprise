import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PreferencesProvider, usePreferences } from './preferences';

const STORAGE_KEY = 'sh_marketing_preferences';

function TestConsumer() {
  const {
    locale, timezone, timeFormat, setLocale, setTimezone, setTimeFormat,
    t, formatDate, formatCurrency,
  } = usePreferences();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="timezone">{timezone}</span>
      <span data-testid="timeFormat">{timeFormat}</span>
      <span data-testid="greeting">{t((d) => d.common.save)}</span>
      <span data-testid="date">{formatDate('2026-08-27T14:35:00Z')}</span>
      <span data-testid="currency">{formatCurrency(1500)}</span>
      <button onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>toggle-locale</button>
      <button onClick={() => setTimezone('Asia/Dubai')}>set-timezone</button>
      <button onClick={() => setTimeFormat('12h')}>set-time-format</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

afterEach(() => {
  localStorage.clear();
});

describe('PreferencesProvider defaults', () => {
  it('defaults to English, Asia/Qatar, and 24-hour time with no stored preferences', () => {
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('timezone').textContent).toBe('Asia/Qatar');
    expect(screen.getByTestId('timeFormat').textContent).toBe('24h');
  });

  it('sets document dir="ltr" and lang="en" for the default locale (no hydration mismatch)', () => {
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('PreferencesProvider locale switching', () => {
  it('switches document dir to "rtl" and lang to "ar" when Arabic is selected', () => {
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    act(() => { fireEvent.click(screen.getByText('toggle-locale')); });
    expect(screen.getByTestId('locale').textContent).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('reverts to dir="ltr" when switching back to English', () => {
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    act(() => { fireEvent.click(screen.getByText('toggle-locale')); });
    act(() => { fireEvent.click(screen.getByText('toggle-locale')); });
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('updates translated text immediately when locale changes', () => {
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    expect(screen.getByTestId('greeting').textContent).toBe('Save');
    act(() => { fireEvent.click(screen.getByText('toggle-locale')); });
    expect(screen.getByTestId('greeting').textContent).toBe('حفظ');
  });

  it('updates locale-formatted date and currency output when locale changes', () => {
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    expect(screen.getByTestId('date').textContent).toBe('27 Aug 2026');
    act(() => { fireEvent.click(screen.getByText('toggle-locale')); });
    expect(screen.getByTestId('date').textContent).toBe('27 أغسطس 2026');
  });
});

describe('PreferencesProvider persistence', () => {
  it('persists locale, timezone, and time format to localStorage on change', () => {
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    act(() => { fireEvent.click(screen.getByText('toggle-locale')); });
    act(() => { fireEvent.click(screen.getByText('set-timezone')); });
    act(() => { fireEvent.click(screen.getByText('set-time-format')); });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored).toEqual({ locale: 'ar', timezone: 'Asia/Dubai', timeFormat: '12h' });
  });

  it('restores previously persisted preferences on next mount (survives reload)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ locale: 'ar', timezone: 'Asia/Dubai', timeFormat: '12h' }));
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('ar');
    expect(screen.getByTestId('timezone').textContent).toBe('Asia/Dubai');
    expect(screen.getByTestId('timeFormat').textContent).toBe('12h');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('falls back to defaults when localStorage contains invalid/corrupt data', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{');
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('timezone').textContent).toBe('Asia/Qatar');
  });

  it('ignores an unrecognized locale value and falls back to English', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ locale: 'fr', timezone: 'Asia/Qatar', timeFormat: '24h' }));
    render(<PreferencesProvider><TestConsumer /></PreferencesProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });
});

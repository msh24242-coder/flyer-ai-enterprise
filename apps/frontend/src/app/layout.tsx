import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/auth';
import { ThemeProvider } from '@/context/theme';
import { ToastProvider } from '@/context/toast';
import { PreferencesProvider } from '@/context/preferences';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-arabic',
});

export const metadata: Metadata = {
  title: { default: 'SH Marketing', template: '%s · SH Marketing' },
  description: 'SH Marketing — enterprise AI-powered marketing operations platform',
  robots: { index: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f1117',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${notoSansArabic.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <PreferencesProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

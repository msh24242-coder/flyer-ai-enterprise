import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth';

export const metadata: Metadata = {
  title: 'AI Marketing OS',
  description: 'Intelligent marketing operations platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '../auth/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spend Buddy — Identity & Access',
  description: 'The authentication foundation for Spend Buddy.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#overview">
          Skip to content
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { fontVariables } from '@/components/chrome/fonts';

export const metadata: Metadata = {
  metadataBase: new URL('https://nowhenceclothings.com'),
  title: { default: 'Nowhence', template: '%s · Nowhence' },
  description: 'Premium unisex clothing.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}

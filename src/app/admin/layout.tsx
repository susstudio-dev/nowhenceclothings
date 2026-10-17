import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: { default: 'Studio', template: '%s · Nowhence Studio' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-paper font-sans text-ink antialiased">{children}</div>
    </ToastProvider>
  );
}

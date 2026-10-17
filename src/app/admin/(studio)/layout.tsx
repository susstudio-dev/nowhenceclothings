import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { AdminNav } from '@/components/admin/AdminNav';
import { Callout } from '@/components/admin/kit';

export const dynamic = 'force-dynamic';

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#studio-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-xs focus:text-paper"
      >
        Skip to content
      </a>
      <AdminNav admin={admin} />
      <main id="studio-main" className="min-w-0 bg-paper">
        <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-10 md:py-10">
          {admin.mustChangePassword && (
            <div className="mb-8">
              <Callout tone="alert" title="You are using a temporary password.">
                <Link className="underline underline-offset-2" href="/admin/account">
                  Change it now
                </Link>{' '}
                before you continue.
              </Callout>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

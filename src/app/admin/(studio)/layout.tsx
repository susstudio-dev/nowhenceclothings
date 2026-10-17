import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/guard';
import { AdminNav } from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="grid min-h-screen md:grid-cols-[14rem_1fr]">
      <AdminNav admin={admin} />
      <main className="min-w-0 p-6 md:p-10">
        {admin.mustChangePassword && (
          <p role="alert" className="mb-6 border border-accent p-3 text-sm">
            You are using a temporary password. <a className="underline" href="/admin/account">Change it now.</a>
          </p>
        )}
        {children}
      </main>
    </div>
  );
}

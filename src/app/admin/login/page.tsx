import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/guard';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      <section aria-hidden className="relative hidden overflow-hidden bg-ink text-paper lg:flex lg:flex-col lg:justify-between lg:p-12">
        <span className="font-display text-[13px] font-medium tracking-mark">NOWHENCE</span>
        <svg viewBox="0 0 200 200" className="absolute -right-24 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 text-paper/[0.07]">
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="82" cy="100" r="5" fill="currentColor" />
          <circle cx="100" cy="100" r="5" fill="currentColor" />
          <circle cx="118" cy="100" r="5" fill="currentColor" />
        </svg>
        <div className="relative max-w-sm space-y-3">
          <p className="text-[10px] uppercase tracking-label text-paper/60">Studio</p>
          <p className="font-display text-[40px] font-light leading-[1.1]">Quiet work, made carefully.</p>
          <p className="text-sm text-paper/60">Orders, launches, pre-bookings and the catalogue, in one place.</p>
        </div>
      </section>
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <span className="font-display text-[13px] font-medium tracking-mark lg:invisible">NOWHENCE</span>
        <div className="mx-auto w-full max-w-sm space-y-8 py-12">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-label text-muted">Nowhence Studio</p>
            <h1 className="font-display text-[32px] font-light leading-tight">Sign in</h1>
            <p className="text-sm text-muted">Use the email your owner invited you with.</p>
          </div>
          <LoginForm />
        </div>
        <p className="text-xs text-muted">Trouble signing in? Ask the store owner to reset your password from Team.</p>
      </section>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/guard';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <div>
        <p className="font-display text-2xl tracking-wide">NOWHENCE</p>
        <h1 className="text-sm text-muted">Studio sign in</h1>
      </div>
      <LoginForm />
    </main>
  );
}

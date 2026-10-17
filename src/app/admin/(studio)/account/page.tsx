import { requireAdmin } from '@/lib/guard';
import { ROLE_LABELS } from '@/lib/roles';
import { ChangePasswordForm } from '@/components/admin/TeamManager';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const admin = await requireAdmin();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Account</h1>
      <p className="text-sm">
        {admin.email} · {ROLE_LABELS[admin.role]}
      </p>
      {admin.breakGlass ? (
        <p className="text-sm text-muted">The env owner password is managed with `wrangler secret put`.</p>
      ) : (
        <ChangePasswordForm />
      )}
    </div>
  );
}

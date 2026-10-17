import { requireAdmin } from '@/lib/guard';
import { ROLE_LABELS } from '@/lib/roles';
import { ChangePasswordForm } from '@/components/admin/TeamManager';
import { PageHeader } from '@/components/admin/kit';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const admin = await requireAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Account" description={<>{admin.email} · {ROLE_LABELS[admin.role]}</>} />
      {admin.breakGlass ? (
        <p className="text-sm text-muted">The env owner password is managed with `wrangler secret put`.</p>
      ) : (
        <ChangePasswordForm />
      )}
    </div>
  );
}

import { requireAdmin } from '@/lib/guard';
import { readUsers } from '@/lib/users';
import { TeamManager } from '@/components/admin/TeamManager';
import { PageHeader, Callout } from '@/components/admin/kit';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
  const admin = await requireAdmin('owner');
  const users = ((await readUsers()) ?? []).map(({ passwordHash: _p, ...u }) => u);
  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Who can sign in to the studio, and what each role can do." />
      {admin.breakGlass && (
        <Callout>
          You are signed in as the env owner account, which is not listed here and cannot be removed.
        </Callout>
      )}
      <TeamManager initial={users} selfId={admin.uid} />
    </div>
  );
}

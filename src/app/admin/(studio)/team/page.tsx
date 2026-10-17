import { requireAdmin } from '@/lib/guard';
import { readUsers } from '@/lib/users';
import { TeamManager } from '@/components/admin/TeamManager';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
  const admin = await requireAdmin('owner');
  const users = ((await readUsers()) ?? []).map(({ passwordHash: _p, ...u }) => u);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Team</h1>
      {admin.breakGlass && (
        <p className="text-sm text-muted">
          You are signed in as the env owner account, which is not listed here and cannot be removed.
        </p>
      )}
      <TeamManager initial={users} selfId={admin.uid} />
    </div>
  );
}

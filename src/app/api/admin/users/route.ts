import { hashPassword } from '@/lib/password';
import { readUsers, updateUsers } from '@/lib/users';
import { adminRoute, json, readBody } from '@/lib/admin/api';
import { InviteInput } from '@/lib/admin/inputs';
import { addUser, tempPassword } from '@/lib/admin/team';
import type { User } from '@/lib/schemas/users';

export const dynamic = 'force-dynamic';

const publicUser = ({ passwordHash: _p, ...u }: User) => u;

export async function GET() {
  return adminRoute({ role: 'owner', cap: 'users.manage' }, async () =>
    json({ users: ((await readUsers()) ?? []).map(publicUser) }),
  );
}

/**
 * A7 invite: creates the user with a one-time temporary password that must be
 * changed on first login. The password is returned ONCE for the owner to share.
 */
export async function POST(req: Request) {
  return adminRoute({ role: 'owner', cap: 'users.manage' }, async ({ admin, log }) => {
    const body = await readBody(req, InviteInput);
    const password = tempPassword();
    const user: User = {
      id: crypto.randomUUID(),
      email: body.email,
      name: body.name,
      role: body.role,
      passwordHash: await hashPassword(password),
      status: 'active',
      mustChangePassword: true,
      sessionVersion: 0,
      createdAt: new Date().toISOString(),
      createdBy: admin.email,
      lastLoginAt: '',
    };
    const users = await updateUsers((list) => addUser(list, user));
    await log('user_invite', `users.json#${user.id}`, `${user.email} as ${user.role}`);
    return json({ user: publicUser(user), tempPassword: password, users: users.map(publicUser) }, 201);
  });
}

import { hashPassword } from '@/lib/password';
import { updateUsers } from '@/lib/users';
import { adminRoute, json, readBody } from '@/lib/admin/api';
import { UserPatchInput } from '@/lib/admin/inputs';
import { removeUser, setPassword, tempPassword, updateUser } from '@/lib/admin/team';
import type { User } from '@/lib/schemas/users';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const publicUser = ({ passwordHash: _p, ...u }: User) => u;

/** Change role / status / name, or reset the password (returns a new temp one). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'owner', cap: 'users.manage' }, async ({ log }) => {
    const { resetPassword, ...patch } = await readBody(req, UserPatchInput);
    let temp: string | undefined;
    let hash: string | undefined;
    if (resetPassword) {
      temp = tempPassword();
      hash = await hashPassword(temp);
    }
    const users = await updateUsers((list) => {
      let next = Object.keys(patch).length ? updateUser(list, id, patch) : list;
      if (hash) next = setPassword(next, id, hash, true);
      return next;
    });
    const detail = [patch.role && `role=${patch.role}`, patch.status && `status=${patch.status}`, resetPassword && 'password_reset']
      .filter(Boolean)
      .join(', ');
    await log('user_update', `users.json#${id}`, detail);
    return json({ users: users.map(publicUser), ...(temp ? { tempPassword: temp } : {}) });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'owner', cap: 'users.manage' }, async ({ admin, log }) => {
    const users = await updateUsers((list) => removeUser(list, id, admin.uid));
    await log('user_remove', `users.json#${id}`);
    return json({ users: users.map(publicUser) });
  });
}

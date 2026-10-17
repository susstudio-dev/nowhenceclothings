import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { getUserById, updateUsers } from '@/lib/users';
import { adminRoute, HttpError, json, readBody, sameOrigin } from '@/lib/admin/api';
import { ChangePasswordInput } from '@/lib/admin/inputs';
import { setPassword } from '@/lib/admin/team';

export const dynamic = 'force-dynamic';

/** Change your own password. Re-issues the session (sessionVersion bumps). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  return adminRoute({}, async ({ admin, log }) => {
    if (admin.breakGlass) throw new HttpError(400, 'The env owner password is set with wrangler secrets');
    const body = await readBody(req, ChangePasswordInput);
    const user = await getUserById(admin.uid);
    if (!user || !(await verifyPassword(body.current, user.passwordHash))) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    const hash = await hashPassword(body.next);
    const users = await updateUsers((list) => setPassword(list, admin.uid, hash, false));
    const me = users.find((u) => u.id === admin.uid)!;
    await setSessionCookie(await createSessionToken({ uid: me.id, email: me.email, role: me.role, sv: me.sessionVersion }));
    await log('password_changed', `users.json#${me.id}`);
    return json({ ok: true });
  });
}

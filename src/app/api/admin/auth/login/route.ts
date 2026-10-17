import { clearAttempts, createSessionToken, recordAttempt, setSessionCookie, verifyCredentials } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { updateUsers } from '@/lib/users';
import { errorResponse, json, readBody, sameOrigin } from '@/lib/admin/api';
import { LoginInput } from '@/lib/admin/inputs';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const gate = recordAttempt(ip);
  if (!gate.allowed) {
    return json({ error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} min.` }, 429);
  }
  try {
    const { email, password } = await readBody(req, LoginInput);
    const p = await verifyCredentials(email, password);
    if (!p) {
      await audit({ actor: email.toLowerCase().slice(0, 64), action: 'login_failed' });
      return json({ error: 'Email or password is incorrect' }, 401);
    }
    clearAttempts(ip);
    await setSessionCookie(
      await createSessionToken({ uid: p.uid, email: p.email, role: p.role, sv: p.sessionVersion, brk: p.breakGlass }),
    );
    if (!p.breakGlass) {
      const at = new Date().toISOString();
      await updateUsers((users) => users.map((u) => (u.id === p.uid ? { ...u, lastLoginAt: at } : u))).catch(() => {});
    }
    await audit({ actor: p.email, action: 'login' });
    return json({ ok: true, mustChangePassword: p.mustChangePassword });
  } catch (err) {
    return errorResponse(err);
  }
}

import { clearSessionCookie } from '@/lib/auth';
import { getAdmin } from '@/lib/guard';
import { audit } from '@/lib/audit';
import { json, sameOrigin } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  const admin = await getAdmin();
  await clearSessionCookie();
  if (admin) await audit({ actor: admin.email, action: 'logout' });
  return json({ ok: true });
}

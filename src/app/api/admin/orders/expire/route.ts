import { expireStaleOrders } from '@/lib/commerce/lifecycle';
import { timingSafeEqualStr } from '@/lib/commerce/lifecycle-auth';

export const dynamic = 'force-dynamic';

/**
 * F6 cron target: cancels pending_payment orders past the payment window.
 * Called by the Worker's scheduled() handler (worker/cron.mjs) through the
 * WORKER_SELF_REFERENCE binding with `x-cron-secret: $CRON_SECRET`.
 * Disabled (404) when CRON_SECRET is not set.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('x-cron-secret') ?? '';
  if (!secret || !timingSafeEqualStr(got, secret)) return new Response('Not found', { status: 404 });
  const cancelled = await expireStaleOrders();
  return Response.json({ cancelled });
}

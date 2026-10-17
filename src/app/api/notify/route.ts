import { z } from 'zod';
import { findVariant } from '@/lib/catalogue';
import { subscribeNotify } from '@/lib/commerce/subscriptions';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { Email } from '@/lib/schemas/common';

export const dynamic = 'force-dynamic';

const Body = z.object({
  sku: z.string().min(1).max(40),
  email: Email,
  kind: z.enum(['restock', 'drop']).default('restock'),
  /** Honeypot: bots fill it, humans never see it. */
  website: z.string().max(0).optional(),
});

/** Back-in-stock / drop alert signup. */
export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.response;
  try {
    if (!(await findVariant(body.data.sku))) return jsonError(404, 'Unknown item.');
    const added = await subscribeNotify(body.data.sku, body.data.email, body.data.kind);
    return jsonOk({ ok: true, added });
  } catch (err) {
    console.error('notify failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Could not save that. Please try again.');
  }
}

import { z } from 'zod';
import { subscribeNewsletter } from '@/lib/commerce/subscriptions';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { Email } from '@/lib/schemas/common';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: Email,
  source: z.string().trim().max(32).default('footer'),
  /** Honeypot. */
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.response;
  try {
    const added = await subscribeNewsletter(body.data.email, body.data.source);
    return jsonOk({ ok: true, added });
  } catch (err) {
    console.error('newsletter failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Could not sign you up. Please try again.');
  }
}

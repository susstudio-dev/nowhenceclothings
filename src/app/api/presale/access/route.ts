import { z } from 'zod';
import { getCatalogue } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { codeMatches, resolveLaunch } from '@/lib/launches';

export const dynamic = 'force-dynamic';

const Body = z.object({ productId: z.string().min(1).max(64), code: z.string().trim().min(1).max(64) });

/** A11: check a pre-order access code. Never reveals the code; checkout re-verifies it. */
export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.response;
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const product = cat.products.find((p) => p.id === body.data.productId && p.status === 'active');
  if (!product) return jsonError(404, 'Unknown item.');
  const r = resolveLaunch(product, cat.drops, settings.launches);
  if (r.state !== 'presale' || r.presale?.access !== 'code') return jsonError(400, 'This piece does not need a code.');
  if (!codeMatches(r.presale.accessCode, body.data.code)) return jsonError(403, 'That code is not valid.');
  return jsonOk({ ok: true });
}

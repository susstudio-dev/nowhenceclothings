import { z } from 'zod';
import { findVariant, getProductById } from '@/lib/catalogue';
import { subscribeNotify } from '@/lib/commerce/subscriptions';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { Email } from '@/lib/schemas/common';
import { productNotifyKey } from '@/lib/schemas/launches';

export const dynamic = 'force-dynamic';

const Body = z
  .object({
    sku: z.string().min(1).max(40).optional(),
    /** A10: whole-product notify list (coming soon / presale waitlist). */
    productId: z.string().min(1).max(64).optional(),
    email: Email,
    kind: z.enum(['restock', 'drop']).default('restock'),
    /** Honeypot: bots fill it, humans never see it. */
    website: z.string().max(0).optional(),
  })
  .refine((b) => b.sku || b.productId, { message: 'sku or productId required' });

/** Back-in-stock / drop / coming-soon alert signup. */
export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.response;
  try {
    const { sku, productId, email, kind } = body.data;
    if (productId) {
      const p = await getProductById(productId);
      if (!p || p.status !== 'active') return jsonError(404, 'Unknown item.');
      const added = await subscribeNotify(`product-${p.id}`, email, 'drop', productNotifyKey(p.id));
      return jsonOk({ ok: true, added });
    }
    if (!(await findVariant(sku!))) return jsonError(404, 'Unknown item.');
    const added = await subscribeNotify(sku!, email, kind);
    return jsonOk({ ok: true, added });
  } catch (err) {
    console.error('notify failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Could not save that. Please try again.');
  }
}

import { findOrderByNumber, toPublicOrder } from '@/lib/commerce/orders';
import { TrackRequest } from '@/lib/commerce/types';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';

export const dynamic = 'force-dynamic';

const NOT_FOUND = 'We could not find an order with those details.';

/** S7: order lookup by number + email. Same 404 for a wrong number or email. */
export async function POST(req: Request) {
  const body = await parseBody(req, TrackRequest);
  if (!body.ok) return jsonError(404, NOT_FOUND);
  try {
    const order = await findOrderByNumber(body.data.number, body.data.email);
    if (!order) return jsonError(404, NOT_FOUND);
    return jsonOk({ order: toPublicOrder(order) });
  } catch (err) {
    console.error('track failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Something went wrong. Please try again.');
  }
}

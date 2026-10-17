import { findOrderByNumber, readOrder, toPublicOrder } from '@/lib/commerce/orders';
import { expireIfStale } from '@/lib/commerce/lifecycle';
import { TrackRequest } from '@/lib/commerce/types';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { orderDocumentLinks } from '@/lib/invoices/links';

export const dynamic = 'force-dynamic';

const NOT_FOUND = 'We could not find an order with those details.';

/** S7: order lookup by number + email. Same 404 for a wrong number or email. */
export async function POST(req: Request) {
  const body = await parseBody(req, TrackRequest);
  if (!body.ok) return jsonError(404, NOT_FOUND);
  try {
    const found = await findOrderByNumber(body.data.number, body.data.email);
    if (!found) return jsonError(404, NOT_FOUND);
    // F6: lazily cancel an unpaid order past its payment window.
    let order = found;
    if (found.status === 'pending_payment') {
      await expireIfStale(found.id);
      order = (await readOrder(found.id)) ?? found;
    }
    const documents = await orderDocumentLinks(order).catch(() => []);
    return jsonOk({ order: { ...toPublicOrder(order), documents } });
  } catch (err) {
    console.error('track failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Something went wrong. Please try again.');
  }
}

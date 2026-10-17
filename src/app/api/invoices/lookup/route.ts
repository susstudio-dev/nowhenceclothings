import { findOrderByNumber } from '@/lib/commerce/orders';
import { TrackRequest } from '@/lib/commerce/types';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { orderDocumentLinks } from '@/lib/invoices/links';

export const dynamic = 'force-dynamic';

/** A14: invoice / credit-note links for an order, by order number + email. */
export async function POST(req: Request) {
  const body = await parseBody(req, TrackRequest);
  if (!body.ok) return jsonError(404, 'Not found.');
  const order = await findOrderByNumber(body.data.number, body.data.email).catch(() => null);
  if (!order) return jsonError(404, 'We could not find an order with those details.');
  return jsonOk({ documents: await orderDocumentLinks(order) });
}

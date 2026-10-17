import { buildQuote, loadQuoteContext } from '@/lib/commerce/quote';
import { QuoteRequest } from '@/lib/commerce/types';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';

export const dynamic = 'force-dynamic';

/** Server-priced cart for display (cart drawer, cart page, checkout summary). */
export async function POST(req: Request) {
  const body = await parseBody(req, QuoteRequest);
  if (!body.ok) return body.response;
  try {
    const ctx = await loadQuoteContext();
    return jsonOk(buildQuote(ctx, body.data.lines, body.data.couponCode));
  } catch (err) {
    console.error('quote failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Could not price your bag. Please try again.');
  }
}

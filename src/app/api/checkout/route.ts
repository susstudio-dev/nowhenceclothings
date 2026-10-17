import { CheckoutError, placeOrder } from '@/lib/commerce/checkout';
import { RazorpayError } from '@/lib/commerce/razorpay';
import { CheckoutRequest } from '@/lib/commerce/types';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';

export const dynamic = 'force-dynamic';

/** C5/C6: recompute, check stock, create the Razorpay order + our pending order. */
export async function POST(req: Request) {
  const body = await parseBody(req, CheckoutRequest);
  if (!body.ok) return body.response;
  try {
    return jsonOk(await placeOrder(body.data), 201);
  } catch (err) {
    if (err instanceof CheckoutError) return jsonError(err.status, err.message, { code: err.code, quote: err.quote });
    if (err instanceof RazorpayError) {
      console.error('razorpay order failed', err.status, err.message);
      return jsonError(502, 'Payment provider is unavailable. Please try again.');
    }
    console.error('checkout failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Checkout failed. Please try again.');
  }
}

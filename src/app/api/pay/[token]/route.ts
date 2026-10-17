import { z } from 'zod';
import { Address, Phone } from '@/lib/schemas/common';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { BookingError, startBalancePayment } from '@/lib/bookings-server';
import { RazorpayError } from '@/lib/commerce/razorpay';

export const dynamic = 'force-dynamic';

const PayRequest = z.object({ address: Address, phone: Phone });

/** A13: balance checkout for a booking. Amount is computed on the server. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await parseBody(req, PayRequest);
  if (!body.ok) return body.response;
  try {
    const res = await startBalancePayment(token, body.data);
    return jsonOk({ number: res.number, amount: res.balance.balance, razorpay: res.razorpay });
  } catch (err) {
    if (err instanceof BookingError) return jsonError(err.status, err.message, { code: err.code });
    if (err instanceof RazorpayError) return jsonError(502, 'The payment provider is unavailable. Please retry.');
    console.error('balance start failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Something went wrong. Please retry.');
  }
}

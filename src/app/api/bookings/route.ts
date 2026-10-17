import { z } from 'zod';
import { Email, Phone } from '@/lib/schemas/common';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { BookingError, createBooking } from '@/lib/bookings-server';
import { RazorpayError } from '@/lib/commerce/razorpay';

export const dynamic = 'force-dynamic';

const BookingRequest = z.object({
  slug: z.string().min(1).max(120),
  sku: z.string().min(1).max(40),
  qty: z.number().int().min(1).max(10),
  name: z.string().trim().min(1).max(100),
  email: Email,
  phone: Phone,
  code: z.string().max(64).optional(),
  acceptPolicy: z.literal(true),
});

/** A13: create a booking and its deposit Razorpay order. The server computes the deposit. */
export async function POST(req: Request) {
  const body = await parseBody(req, BookingRequest);
  if (!body.ok) return body.response;
  try {
    return jsonOk(await createBooking(body.data));
  } catch (err) {
    if (err instanceof BookingError) return jsonError(err.status, err.message, { code: err.code });
    if (err instanceof RazorpayError) return jsonError(502, 'The payment provider is unavailable. Please retry.');
    console.error('booking create failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Something went wrong. Please retry.');
  }
}

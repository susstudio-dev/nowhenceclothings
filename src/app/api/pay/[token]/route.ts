import { z } from 'zod';
import { Address, Phone } from '@/lib/schemas/common';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { BookingError, bookingByToken, startBalancePayment, updateBooking } from '@/lib/bookings-server';
import { validateGstin } from '@/lib/invoices/gst';
import { RazorpayError } from '@/lib/commerce/razorpay';

export const dynamic = 'force-dynamic';

const PayRequest = z.object({
  address: Address,
  phone: Phone,
  /** A15: separate billing address + optional GSTIN for the tax invoice. */
  billingAddress: Address.optional(),
  gstin: z.string().trim().toUpperCase().max(15).optional(),
});

/** A13: balance checkout for a booking. Amount is computed on the server. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await parseBody(req, PayRequest);
  if (!body.ok) return body.response;
  let gstin: string | undefined;
  if (body.data.gstin) {
    const g = validateGstin(body.data.gstin);
    if (!g.ok) return jsonError(400, g.error, { code: 'gstin' });
    gstin = g.gstin;
  }
  try {
    const found = await bookingByToken(token);
    if (found) {
      // Invoice details travel on the booking into the converted order.
      await updateBooking(found.id, (b) => {
        const next = { ...b, address: body.data.address };
        if (body.data.billingAddress) next.billingAddress = body.data.billingAddress;
        else delete next.billingAddress;
        if (gstin) next.buyerGstin = gstin;
        else delete next.buyerGstin;
        return next;
      });
    }
    const res = await startBalancePayment(token, { address: body.data.address, phone: body.data.phone });
    return jsonOk({ number: res.number, amount: res.balance.balance, razorpay: res.razorpay });
  } catch (err) {
    if (err instanceof BookingError) return jsonError(err.status, err.message, { code: err.code });
    if (err instanceof RazorpayError) return jsonError(502, 'The payment provider is unavailable. Please retry.');
    console.error('balance start failed', err instanceof Error ? err.message : '');
    return jsonError(500, 'Something went wrong. Please retry.');
  }
}

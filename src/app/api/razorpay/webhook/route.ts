import { confirmPayment, recordPaymentEvent } from '@/lib/commerce/orders';
import { verifyWebhookSignature } from '@/lib/commerce/razorpay';
import { jsonError, jsonOk } from '@/lib/commerce/http';
import { bookingRefForRazorpayOrder, confirmBookingPayment, isBookingPaymentNotes } from '@/lib/bookings-server';

export const dynamic = 'force-dynamic';

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string; notes?: unknown } };
  };
}

/**
 * Razorpay webhook (payment.captured, order.paid; others logged + ignored).
 * HMAC over the raw body; deduped by x-razorpay-event-id via payment events,
 * and confirmPayment itself is idempotent.
 */
export async function POST(req: Request) {
  const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!secret) return jsonError(503, 'webhook not configured');
  const raw = await req.text();
  if (raw.length > 256 * 1024) return jsonError(413, 'too large');
  if (!(await verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'), secret))) {
    return jsonError(400, 'invalid signature');
  }
  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return jsonError(400, 'invalid json');
  }
  const type = body.event ?? 'unknown';
  const payment = body.payload?.payment?.entity;
  const eventId = req.headers.get('x-razorpay-event-id') || `${type}:${payment?.id ?? 'none'}`;
  const at = new Date().toISOString();

  if ((type === 'payment.captured' || type === 'order.paid') && payment?.id && payment.order_id) {
    // A13: booking payments carry notes.kind = booking_*; the map is the fallback.
    if (isBookingPaymentNotes(payment.notes) || (await bookingRefForRazorpayOrder(payment.order_id))) {
      try {
        const res = await confirmBookingPayment({
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          amount: payment.amount,
          by: 'webhook',
        });
        await recordPaymentEvent({
          eventId,
          type: `booking:${type}`,
          at,
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          result: res.result,
        });
        if (res.result === 'amount_mismatch') console.error('booking webhook amount mismatch', payment.order_id);
        return jsonOk({ ok: true, result: res.result });
      } catch (err) {
        console.error('booking webhook failed', err instanceof Error ? err.message : '');
        return jsonError(500, 'retry');
      }
    }
    try {
      const res = await confirmPayment({
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amount: payment.amount,
        by: 'webhook',
      });
      await recordPaymentEvent({
        eventId,
        type,
        at,
        orderId: res.result === 'not_found' ? undefined : res.order.id,
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        result: res.result,
      });
      if (res.result === 'amount_mismatch') console.error('webhook amount mismatch', payment.order_id);
      return jsonOk({ ok: true, result: res.result });
    } catch (err) {
      console.error('webhook confirm failed', err instanceof Error ? err.message : '');
      return jsonError(500, 'retry'); // Razorpay retries non-2xx responses
    }
  }

  await recordPaymentEvent({
    eventId,
    type,
    at,
    razorpayOrderId: payment?.order_id,
    razorpayPaymentId: payment?.id,
    result: 'ignored',
  }).catch(() => false);
  return jsonOk({ ok: true, result: 'ignored' });
}

import { confirmPayment, recordPaymentEvent } from '@/lib/commerce/orders';
import { razorpayConfig, verifyPaymentSignature } from '@/lib/commerce/razorpay';
import { VerifyRequest } from '@/lib/commerce/types';
import { jsonError, jsonOk, parseBody } from '@/lib/commerce/http';
import { bookingRefForRazorpayOrder, confirmBookingPayment } from '@/lib/bookings-server';

export const dynamic = 'force-dynamic';

/** Checkout.js success callback. Signature-verified, idempotent with the webhook. */
export async function POST(req: Request) {
  const body = await parseBody(req, VerifyRequest);
  if (!body.ok) return body.response;
  const cfg = razorpayConfig();
  if (!cfg) return jsonError(503, 'Payments are not configured.');
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body.data;
  const valid = await verifyPaymentSignature(
    { razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, signature: razorpay_signature },
    cfg.keySecret,
  );
  if (!valid) return jsonError(400, 'Payment could not be verified.');
  // A13: booking deposits / balances have their own map and handler.
  if (await bookingRefForRazorpayOrder(razorpay_order_id)) {
    try {
      const res = await confirmBookingPayment({ razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, by: 'customer' });
      await recordPaymentEvent({
        eventId: `verify:${razorpay_payment_id}`,
        type: 'booking.verify',
        at: new Date().toISOString(),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        result: res.result,
      }).catch(() => false);
      if (res.result === 'not_found') return jsonError(404, 'Booking not found.');
      return jsonOk({
        result: res.result,
        booking: res.booking.number,
        status: res.booking.status,
        ...(res.order ? { number: res.order.number } : {}),
      });
    } catch (err) {
      console.error('booking verify failed', err instanceof Error ? err.message : '');
      return jsonError(500, 'We received your payment and are confirming it.');
    }
  }
  try {
    const res = await confirmPayment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      by: 'customer',
    });
    if (res.result === 'not_found') return jsonError(404, 'Order not found.');
    await recordPaymentEvent({
      eventId: `verify:${razorpay_payment_id}`,
      type: 'checkout.verify',
      at: new Date().toISOString(),
      orderId: res.order.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      result: res.result,
    }).catch(() => false);
    return jsonOk({ result: res.result, number: res.order.number, status: res.order.status });
  } catch (err) {
    console.error('verify failed', err instanceof Error ? err.message : '');
    // The webhook retries confirmation; tell the customer it is processing.
    return jsonError(500, 'We received your payment and are confirming it.');
  }
}

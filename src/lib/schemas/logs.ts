import { z } from 'zod';
import { Email, Id, IsoDate } from './common';

const monthOf = (d: Date | string) => new Date(d).toISOString().slice(0, 7);

// ---- notify/{sku}.json — back-in-stock / drop alerts -----------------------
export const notifyKey = (sku: string) => `notify/${sku}.json`;
export const NotifyDoc = z.object({
  subscribers: z
    .array(
      z.object({
        email: Email,
        at: IsoDate,
        /** Set when the alert email has been sent. */
        notifiedAt: IsoDate.optional(),
        kind: z.enum(['restock', 'drop']).default('restock'),
      }),
    )
    .default([]),
});
export type NotifyDoc = z.infer<typeof NotifyDoc>;

// ---- newsletter.json -------------------------------------------------------
export const NEWSLETTER_KEY = 'newsletter.json';
export const NewsletterDoc = z.object({
  signups: z
    .array(z.object({ email: Email, at: IsoDate, source: z.string().default('footer') }))
    .default([]),
});
export type NewsletterDoc = z.infer<typeof NewsletterDoc>;

// ---- audit/{yyyy-mm}.json --------------------------------------------------
export const auditKey = (at: Date | string = new Date()) => `audit/${monthOf(at)}.json`;
export const AuditEntry = z.object({
  ts: IsoDate,
  /** Admin email (or attempted email for login_failed). */
  actor: z.string().max(64),
  action: z.string().min(1).max(64),
  /** Affected doc/entity, e.g. 'catalogue.json#product:abc'. */
  target: z.string().max(128).optional(),
  detail: z.string().max(256).optional(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;
export const AuditDoc = z.object({ entries: z.array(AuditEntry).default([]) });
export type AuditDoc = z.infer<typeof AuditDoc>;

// ---- payment-events/{yyyy-mm}.json -----------------------------------------
export const paymentEventsKey = (at: Date | string = new Date()) => `payment-events/${monthOf(at)}.json`;
export const PaymentEvent = z.object({
  /** Razorpay event id (x-razorpay-event-id) — idempotency key. */
  eventId: z.string().min(1),
  type: z.string().min(1),
  at: IsoDate,
  orderId: Id.optional(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  /** Outcome of handling, e.g. 'applied', 'duplicate', 'ignored', 'oversell_refunded'. */
  result: z.string().default('applied'),
});
export type PaymentEvent = z.infer<typeof PaymentEvent>;
export const PaymentEventsDoc = z.object({ events: z.array(PaymentEvent).default([]) });
export type PaymentEventsDoc = z.infer<typeof PaymentEventsDoc>;

import { describe, expect, it } from 'vitest';
import { payLink, renderBookingEmail } from './bookings-email';
import { Booking, BOOKING_EMAILS } from './schemas/bookings';

const settings = { email: { from: 'orders@nowhenceclothings.com', senderName: 'Nowhence', replyTo: '' } } as never;

const b = Booking.parse({
  id: 'b1',
  number: 'NWB-261020-ABCD',
  status: 'balance_due',
  email: 'a@b.co',
  name: '<Asha> Rao',
  phone: '9876543210',
  productId: 'p1',
  productSlug: 'ring-polo',
  productTitle: 'Ring Polo',
  sku: 'PRE-BLK-M',
  colour: 'Black',
  size: 'M',
  qty: 1,
  lockedUnitPrice: 329900,
  deposit: 99900,
  balanceDueBy: '2026-11-22T04:30:00.000Z',
  terms: { priceLock: 'booking', depositRefundable: false, unpaidOutcome: 'forfeit', saleStartsAt: '2026-11-15T04:30:00.000Z', balanceWindowDays: 7 },
  tokenHashes: [],
  depositRazorpayOrderId: 'order_X',
  history: [{ at: '2026-10-20T00:00:00.000Z', status: 'deposit_pending', by: 'customer' }],
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
});

describe('booking emails', () => {
  it('deposit + balance emails carry the private /pay link', () => {
    const tok = 'T'.repeat(43);
    const dep = renderBookingEmail(b, 'deposit_paid', tok, settings);
    expect(dep.subject).toBe('Booking NWB-261020-ABCD confirmed');
    expect(dep.html).toContain(payLink(tok));
    expect(dep.html).toContain('₹999');
    const bal = renderBookingEmail(b, 'balance_due', tok, settings, 239900);
    expect(bal.html).toContain('/pay/' + tok);
    expect(bal.html).toContain('₹2,399');
    expect(bal.to).toBe('a@b.co');
  });
  it('escapes customer input and renders every kind', () => {
    for (const k of BOOKING_EMAILS) {
      const m = renderBookingEmail(b, k, null, settings);
      expect(m.html).not.toContain('<Asha>');
      expect(m.subject).toContain(b.number);
    }
    expect(renderBookingEmail(b, 'expired', null, settings).html).toContain('not refundable');
  });
});

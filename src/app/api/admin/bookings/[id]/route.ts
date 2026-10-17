import { z } from 'zod';
import { adminRoute, HttpError, json, readBody } from '@/lib/admin/api';
import { roleHas } from '@/lib/roles';
import { IsoDate } from '@/lib/schemas/common';
import {
  BookingError,
  advanceBooking,
  cancelBooking,
  extendBooking,
  readBooking,
  refundDeposit,
  resendBookingLink,
} from '@/lib/bookings-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async () => {
    const booking = (await advanceBooking(id)) ?? (await readBooking(id));
    if (!booking) return json({ error: 'Booking not found' }, 404);
    const { tokenHashes: _t, ...safe } = booking;
    return json({ booking: safe });
  });
}

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resend') }),
  z.object({ action: z.literal('extend'), until: IsoDate }),
  z.object({ action: z.literal('cancel'), refund: z.boolean().default(false), reason: z.string().max(200).optional() }),
  z.object({ action: z.literal('refund'), reason: z.string().max(200).optional() }),
]);

/** A13 admin actions: resend link, extend deadline, cancel (+ refund), refund. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'orders.write' }, async ({ admin, log }) => {
    const body = await readBody(req, Action);
    try {
      if ((body.action === 'refund' || (body.action === 'cancel' && body.refund)) && !roleHas(admin.role, 'orders.refund')) {
        return json({ error: 'forbidden' }, 403);
      }
      let result: unknown;
      switch (body.action) {
        case 'resend':
          result = { sent: await resendBookingLink(id) };
          break;
        case 'extend':
          result = { booking: await extendBooking(id, body.until, admin.email) };
          break;
        case 'cancel':
          result = { booking: await cancelBooking(id, { refund: body.refund, by: admin.email, reason: body.reason }) };
          break;
        case 'refund': {
          const b = await readBooking(id);
          if (!b) throw new HttpError(404, 'Booking not found');
          if (!b.depositPaymentId) throw new HttpError(409, 'No deposit payment to refund.');
          if (b.status === 'completed') throw new HttpError(409, 'Completed bookings are refunded from the order.');
          result = { booking: await refundDeposit(id, b.depositPaymentId, body.reason?.trim() || 'Refunded by the store', admin.email) };
          break;
        }
      }
      await log(`booking_${body.action}`, `bookings/${id}.json`, body.action === 'extend' ? `until ${body.until}` : undefined);
      return json(result);
    } catch (err) {
      if (err instanceof BookingError) return json({ error: err.message }, err.status);
      throw err;
    }
  });
}

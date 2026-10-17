import { adminRoute, json, readBody } from '@/lib/admin/api';
import { OrderPatchInput } from '@/lib/admin/inputs';
import { getOrder, patchOrder } from '@/lib/admin/store';
import { roleHas } from '@/lib/roles';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async () => {
    const order = await getOrder(id);
    return order ? json({ order }) : json({ error: 'Order not found' }, 404);
  });
}

/**
 * A4: status change (C9), tracking, internal notes, refund. Refunds need
 * `orders.refund`. The Razorpay refund itself is issued in the Razorpay
 * dashboard (or by WS-C's API); this records it and moves the status.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'orders.write' }, async ({ admin, log }) => {
    const patch = await readBody(req, OrderPatchInput);
    if (patch.refund && !roleHas(admin.role, 'orders.refund')) {
      return json({ error: 'forbidden' }, 403);
    }
    const order = await patchOrder(id, patch, admin.email);
    const what = [
      patch.status && `status=${patch.status}`,
      patch.refund && `refund=${patch.refund.amount}`,
      patch.tracking !== undefined && `tracking=${patch.tracking?.number ?? 'cleared'}`,
      patch.notes !== undefined && 'notes',
    ]
      .filter(Boolean)
      .join(', ');
    await log('order_update', `orders/${id}.json`, `${order.number}: ${what}`);
    return json({ order });
  });
}

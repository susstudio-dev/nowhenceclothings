import { adminRoute, json, readBody } from '@/lib/admin/api';
import { OrderPatchInput } from '@/lib/admin/inputs';
import { getOrder, patchOrder } from '@/lib/admin/store';
import { roleHas } from '@/lib/roles';
import { afterAdminStatusChange, expireIfStale } from '@/lib/commerce/lifecycle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async () => {
    await expireIfStale(id);
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
    const before = await getOrder(id);
    let order = await patchOrder(id, patch, admin.email);
    // F6: restock on cancel/refund of paid/packed orders; shipped/refunded emails.
    const effects = before ? await afterAdminStatusChange(before, order, admin.email) : null;
    if (effects?.restocked || effects?.emailed) order = (await getOrder(id)) ?? order;
    const what = [
      patch.status && `status=${patch.status}`,
      patch.refund && `refund=${patch.refund.amount}`,
      patch.tracking !== undefined && `tracking=${patch.tracking?.number ?? 'cleared'}`,
      patch.notes !== undefined && 'notes',
      effects?.restocked && 'restocked',
      effects?.emailed && `email=${effects.emailed}`,
    ]
      .filter(Boolean)
      .join(', ');
    await log('order_update', `orders/${id}.json`, `${order.number}: ${what}`);
    return json({ order });
  });
}

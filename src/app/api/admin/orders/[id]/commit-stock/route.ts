import { adminRoute, json } from '@/lib/admin/api';
import { retryCommitStock } from '@/lib/commerce/lifecycle';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** F8: retry the stock decrement for an order left paid without stockCommittedAt. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'orders.write' }, async ({ admin, log }) => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: 'Order not found' }, 404);
    const res = await retryCommitStock(id, admin.email);
    if (res.result === 'not_found') return json({ error: 'Order not found' }, 404);
    if (res.result === 'oversell') {
      return json({ error: `Not enough stock to commit: ${res.detail}. Refund or adjust inventory.` }, 409);
    }
    if (res.result === 'committed') await log('order_update', `orders/${id}.json`, `${res.order.number}: stock committed (retry)`);
    return json({ result: res.result, order: res.order });
  });
}

import { adminRoute } from '@/lib/admin/api';
import { filterOrders, ordersToCsv } from '@/lib/admin/orders';
import { listOrderSummaries, loadOrders } from '@/lib/admin/store';
import { OrderStatus } from '@/lib/schemas/order';

export const dynamic = 'force-dynamic';

/** A4 CSV export. Honours ?status= and ?q= like the list page. */
export async function GET(req: Request) {
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async ({ log }) => {
    const url = new URL(req.url);
    const st = OrderStatus.safeParse(url.searchParams.get('status'));
    const list = filterOrders(await listOrderSummaries(), {
      status: st.success ? st.data : 'all',
      q: url.searchParams.get('q') ?? undefined,
      kind: ((k) => (k === 'preorder' || k === 'instock' ? k : 'all'))(url.searchParams.get('kind')),
    });
    const csv = ordersToCsv(await loadOrders(list.map((o) => o.id)));
    await log('orders_export', 'orders-index/', `${list.length} orders`);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="nowhence-orders-${day}.csv"`,
        'cache-control': 'no-store',
      },
    });
  });
}

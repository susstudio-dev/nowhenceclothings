import { adminRoute, HttpError } from '@/lib/admin/api';
import { notifyCsv } from '@/lib/launches-admin';
import { readProductNotifyList } from '@/lib/launches-server';

export const dynamic = 'force-dynamic';

/** A10: notify list for one product as CSV. */
export async function GET(req: Request) {
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async ({ log }) => {
    const productId = new URL(req.url).searchParams.get('productId') ?? '';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(productId)) throw new HttpError(400, 'productId is required');
    const subs = await readProductNotifyList(productId);
    await log('notify_export', `notify/product-${productId}.json`, `${subs.length} emails`);
    return new Response(notifyCsv(subs), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="notify-${productId}.csv"`,
        'cache-control': 'no-store',
      },
    });
  });
}

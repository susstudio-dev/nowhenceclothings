import { adminRoute } from '@/lib/admin/api';
import { bookingsToCsv, filterBookings } from '@/lib/bookings';
import { listBookingSummaries } from '@/lib/bookings-server';
import { BookingStatus } from '@/lib/schemas/bookings';

export const dynamic = 'force-dynamic';

/** A13 bookings CSV. Honours ?status=, ?q= and ?product= like the list page. */
export async function GET(req: Request) {
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async ({ log }) => {
    const url = new URL(req.url);
    const st = BookingStatus.safeParse(url.searchParams.get('status'));
    const list = filterBookings(await listBookingSummaries(), {
      status: st.success ? st.data : 'all',
      q: url.searchParams.get('q') ?? undefined,
      productId: url.searchParams.get('product') || undefined,
    });
    await log('bookings_export', 'bookings-index/', `${list.length} bookings`);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(bookingsToCsv(list), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="nowhence-bookings-${day}.csv"`,
        'cache-control': 'no-store',
      },
    });
  });
}

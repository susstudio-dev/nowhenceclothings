import { getCatalogue } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { bookingUnitPrice, bookingWindow, depositAmount } from '@/lib/bookings';
import { jsonError, jsonOk } from '@/lib/commerce/http';

export const dynamic = 'force-dynamic';

/** A16: deposit + terms for one variant, for the quick-buy sheet. Display only; /api/bookings recomputes. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const slug = u.searchParams.get('slug') ?? '';
  const sku = u.searchParams.get('sku') ?? '';
  const qty = Math.min(10, Math.max(1, Number(u.searchParams.get('qty')) || 1));
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const product = cat.products.find((p) => p.slug === slug);
  if (!product) return jsonError(404, 'Not found.');
  const now = new Date();
  const win = bookingWindow(product, cat.drops, settings.launches, now);
  if (win.state === 'hidden') return jsonError(404, 'Not found.');
  if (win.state !== 'open') return jsonError(409, 'Bookings for this piece are not open.', { state: win.state });
  const variant = product.variants.find((v) => v.sku === sku);
  if (!variant) return jsonError(400, 'Choose a colour and size.');
  const unit = bookingUnitPrice(product, variant, win.pre, now);
  const { dep, pre } = win;
  return jsonOk({
    unitPrice: unit,
    deposit: depositAmount(unit, qty, dep),
    qty,
    perCustomerLimit: pre.perCustomerLimit,
    access: pre.access,
    ctaLabel: dep.bookCtaLabel,
    terms: {
      saleStartsAt: dep.saleStartsAt,
      balanceWindowDays: dep.balanceWindowDays,
      priceLock: dep.priceLock,
      depositRefundable: dep.depositRefundable,
      unpaidOutcome: dep.unpaidOutcome,
    },
  });
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Image } from '@/components/ui';
import { Markdown } from '@/components/shop/Markdown';
import { BookingForm } from '@/components/shop/booking/BookingForm';
import { getCatalogue } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { bookingUnitPrice, bookingWindow, depositPerUnit } from '@/lib/bookings';
import { depositLabel, toPublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string }> };

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';

async function load(slug: string) {
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const product = cat.products.find((p) => p.slug === slug);
  if (!product) return null;
  const now = new Date();
  const win = bookingWindow(product, cat.drops, settings.launches, now);
  // A10 secrecy: anything not bookable-and-public is a plain 404.
  if (win.state === 'hidden') return null;
  return { product, win, now, pub: toPublicProduct(product, cat.drops, settings.launches, now) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { robots: { index: false } };
  return { title: `Pre-book ${d.pub.title}`, robots: { index: false, follow: false } };
}

/** A13 booking link: /book/{slug}[?code=]. */
export default async function BookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { code } = await searchParams;
  const d = await load(slug);
  if (!d) notFound();
  const { product, win, now, pub } = d;
  const img = pub.colours[0]?.images[0];
  const dep = win.dep;

  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-2">
      <div>{img && <Image media={img} sizes="(min-width: 1024px) 50vw, 100vw" priority className="w-full" />}</div>
      <div className="space-y-6">
        <p className="text-xs uppercase tracking-widest">Pre-booking</p>
        <h1 className="font-display text-3xl">{pub.title}</h1>
        <p className="text-sm">
          Price {formatPaise(pub.price)} · {depositLabel(dep)} today, balance when the sale starts
          {dep.saleStartsAt ? ` on ${fmt(dep.saleStartsAt)}` : ''}.
        </p>

        {win.state === 'open' ? (
          <>
            <section className="space-y-2 border border-line p-4 text-sm">
              <h2 className="font-medium">Booking terms</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Pay the balance within {dep.balanceWindowDays} days of the sale start. We email you a private link.</li>
                <li>
                  {dep.priceLock === 'booking'
                    ? 'Your price is locked today.'
                    : 'The final price is the price on the day the sale starts.'}{' '}
                  Shipping is added to the balance.
                </li>
                <li>
                  Deposit is {dep.depositRefundable ? 'refundable' : 'non-refundable'}.{' '}
                  {dep.unpaidOutcome === 'refund'
                    ? 'If the balance is not paid in time, the deposit is refunded.'
                    : dep.unpaidOutcome === 'forfeit'
                      ? 'If the balance is not paid in time, the deposit is kept.'
                      : 'If the balance is not paid in time, we contact you about the deposit.'}
                </li>
                <li>Limit {win.pre.perCustomerLimit} per customer.</li>
              </ul>
              <Markdown source={dep.policyMarkdown} className="space-y-2 text-muted" />
            </section>
            <BookingForm
              slug={product.slug}
              colours={product.colours.map((c) => ({ id: c.id, name: c.name }))}
              variants={product.variants.map((v) => ({
                sku: v.sku,
                colourId: v.colourId,
                size: v.size,
                deposit: depositPerUnit(bookingUnitPrice(product, v, win.pre, now), dep),
              }))}
              perCustomerLimit={win.pre.perCustomerLimit}
              access={win.pre.access}
              initialCode={code?.slice(0, 64)}
              ctaLabel={dep.bookCtaLabel}
            />
          </>
        ) : win.state === 'not_open' ? (
          <p className="border border-line p-4 text-sm">
            Bookings open {win.opensAt ? `on ${fmt(win.opensAt)}` : 'soon'}.
          </p>
        ) : (
          <p className="border border-line p-4 text-sm">
            Bookings for this piece are closed.{' '}
            <Link href={`/products/${product.slug}`} className="underline">
              See the piece
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

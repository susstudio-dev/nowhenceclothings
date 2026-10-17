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
import { depositTodayLine } from '@/components/shop/presale-copy';

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
  const unitDeposit = depositPerUnit(pub.price, dep);
  const summary = { price: pub.price, deposit: unitDeposit, balance: pub.price - unitDeposit, priceLock: dep.priceLock, saleStartsAt: dep.saleStartsAt };

  const steps = [
    { t: 'Reserve today', d: `${pub.price ? formatPaise(unitDeposit) : depositLabel(dep)} holds your size.` },
    { t: dep.saleStartsAt ? `Sale opens ${fmt(dep.saleStartsAt)}` : 'Sale opens', d: 'We email you a private link.' },
    {
      t: 'Pay the balance',
      d: `${dep.priceLock === 'booking' && pub.price ? `${formatPaise(summary.balance)} within` : 'Within'} ${dep.balanceWindowDays} days, plus shipping if any. Then it ships.`,
    },
  ];

  return (
    <div className="container-page grid gap-10 pb-section pt-6 md:pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
      <div className="lg:sticky lg:top-[calc(var(--sticky-offset)+1.5rem)] lg:self-start">
        <div className="relative aspect-garment overflow-hidden bg-paper-deep">
          {img && <Image media={img} sizes="(min-width: 1024px) 58vw, 100vw" priority className="absolute inset-0 h-full w-full object-cover" />}
        </div>
      </div>
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="care-tag text-clay">Pre-booking</p>
          <h1 className="font-display text-display font-light text-ink">{pub.title}</h1>
          {pub.price > 0 && (
            <p className="text-body text-ink-soft">
              <span className="tabular-nums text-ink">{formatPaise(pub.price)}</span> · <span className="tabular-nums">{depositTodayLine(summary)}</span>
            </p>
          )}
        </header>

        <ol className="grid grid-cols-3 gap-4 border-y border-line py-5">
          {steps.map((s, i) => (
            <li key={i} className="space-y-1.5">
              <span className="block text-label tabular-nums text-muted">0{i + 1}</span>
              <span className="block text-small text-ink">{s.t}</span>
              <span className="block text-caption text-muted">{s.d}</span>
            </li>
          ))}
        </ol>

        {win.state === 'open' ? (
          <>
            <BookingForm
              slug={product.slug}
              colours={product.colours.map((c) => ({ id: c.id, name: c.name, hex: c.hex }))}
              sizes={product.sizes}
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
              analytics={{ productId: product.id, ...(pub.price > 0 ? { deposit: unitDeposit } : {}) }}
            />
            <details className="group border-t border-line pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-label uppercase text-ink">
                Booking terms
                <span aria-hidden="true" className="text-muted transition-transform duration-base group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 space-y-3 text-small text-ink-soft">
                <ul className="space-y-2">
                  <li>Pay the balance within {dep.balanceWindowDays} days of the sale start. We email you a private link.</li>
                  <li>
                    {dep.priceLock === 'booking' ? 'Your price is locked today.' : 'The final price is the price on the day the sale starts.'} Shipping is added
                    to the balance.
                  </li>
                  <li>
                    Deposit is {dep.depositRefundable ? 'refundable' : 'non-refundable'}.{' '}
                    {dep.unpaidOutcome === 'refund'
                      ? 'If the balance is not paid in time, the deposit is refunded.'
                      : dep.unpaidOutcome === 'forfeit'
                        ? 'If the balance is not paid in time, the deposit is kept.'
                        : 'If the balance is not paid in time, we contact you about the deposit.'}
                  </li>
                  <li>Limit {win.pre.perCustomerLimit} per customer. A receipt voucher is issued for your deposit.</li>
                </ul>
                <Markdown source={dep.policyMarkdown} className="space-y-2 text-muted" />
              </div>
            </details>
          </>
        ) : win.state === 'not_open' ? (
          <p className="border-l border-clay pl-4 text-small text-ink-soft">Bookings open {win.opensAt ? `on ${fmt(win.opensAt)}` : 'soon'}.</p>
        ) : (
          <p className="border-l border-line pl-4 text-small text-ink-soft">
            Bookings for this piece are closed.{' '}
            <Link href={`/products/${product.slug}`} className="link-quiet">
              See the piece
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

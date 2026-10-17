import type { Metadata } from 'next';
import { OrderTrackForm } from '@/components/shop/checkout-order-view';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  return (
    <div className="container-page pb-section pt-10 md:pt-16">
      <header className="mb-10 max-w-xl space-y-3 md:mb-14">
        <p className="text-label uppercase text-muted">Orders</p>
        <h1 className="font-display text-display-sm font-light text-ink">Track your order</h1>
        <p className="text-small text-ink-soft">See where your pieces are, and download your GST invoice.</p>
      </header>
      <OrderTrackForm initialNumber={typeof number === 'string' ? number.slice(0, 20) : ''} />
    </div>
  );
}

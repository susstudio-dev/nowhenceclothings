import type { Metadata } from 'next';
import { OrderTrackForm } from '@/components/shop/checkout-order-view';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="mb-8 text-3xl font-medium">Track your order</h1>
      <OrderTrackForm initialNumber={typeof number === 'string' ? number.slice(0, 20) : ''} />
    </div>
  );
}

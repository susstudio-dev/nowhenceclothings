import type { Metadata } from 'next';
import { CartPageClient } from '@/components/shop/cart-page';

export const metadata: Metadata = { title: 'Bag', robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page pb-section pt-10 md:pt-16">
      <h1 className="mb-10 font-display text-display-sm font-light text-ink md:mb-14">Your bag</h1>
      <CartPageClient />
    </div>
  );
}

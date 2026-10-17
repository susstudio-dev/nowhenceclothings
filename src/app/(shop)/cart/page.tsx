import type { Metadata } from 'next';
import { CartPageClient } from '@/components/shop/cart-page';

export const metadata: Metadata = { title: 'Bag', robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page py-12">
      <h1 className="mb-8 text-3xl font-medium">Your bag</h1>
      <CartPageClient />
    </div>
  );
}

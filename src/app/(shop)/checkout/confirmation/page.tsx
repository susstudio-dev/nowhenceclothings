import type { Metadata } from 'next';
import { OrderConfirmation } from '@/components/shop/checkout-order-view';

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } };

export default function ConfirmationPage() {
  return (
    <div className="container-page max-w-2xl py-12">
      <OrderConfirmation />
    </div>
  );
}

import type { Metadata } from 'next';
import { OrderConfirmation } from '@/components/shop/checkout-order-view';

export const metadata: Metadata = { title: 'Order confirmed', robots: { index: false } };

export default function ConfirmationPage() {
  return (
    <div className="container-page pb-section pt-10 md:pt-16">
      <OrderConfirmation />
    </div>
  );
}

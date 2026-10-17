import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/shop/checkout-form';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page pb-section pt-8 md:pt-14">
      <h1 className="mx-auto mb-8 max-w-[68rem] font-display text-display-sm font-light text-ink md:mb-12">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}

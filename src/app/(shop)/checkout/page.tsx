import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/shop/checkout-form';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page py-12">
      <h1 className="mb-8 text-3xl font-medium">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCart } from '@/lib/commerce/cart-client';
import { useQuote } from '@/lib/commerce/use-quote';
import { CartLines, CartTotals, CouponForm, FreeShippingProgress } from './cart-lines';

export function CartPageClient() {
  const cart = useCart();
  const { quote, error } = useQuote(cart.lines, cart.couponCode);
  if (!cart.lines.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">Your bag is empty.</p>
        <Link href="/shop" className="mt-4 inline-block underline">
          Continue shopping
        </Link>
      </div>
    );
  }
  const blocked = Boolean(quote?.issues.length);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <CartLines lines={cart.lines} quote={quote} />
      <aside className="space-y-6" aria-label="Summary">
        <FreeShippingProgress quote={quote} />
        <CouponForm couponCode={cart.couponCode} quote={quote} />
        <CartTotals quote={quote} />
        {error && <p role="alert" className="text-sm text-sale">{error}</p>}
        {blocked ? (
          <p className="text-sm text-sale">Remove unavailable items to continue.</p>
        ) : (
          <Link href="/checkout" className="block w-full bg-ink py-3 text-center text-sm font-medium text-paper">
            Checkout
          </Link>
        )}
      </aside>
    </div>
  );
}

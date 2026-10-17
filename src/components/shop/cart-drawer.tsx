'use client';
// Mount once (e.g. in the shop header/layout). Opens on addToCart/openCart.

import Link from 'next/link';
import { Drawer } from '@/components/ui';
import { IconBag } from '@/components/ui/icons';
import { closeCart, openCart, useCart } from '@/lib/commerce/cart-client';
import { useQuote } from '@/lib/commerce/use-quote';
import { CartLines, CartTotals, FreeShippingProgress } from './cart-lines';

export function CartDrawer() {
  const cart = useCart();
  const { quote } = useQuote(cart.open ? cart.lines : [], cart.couponCode);
  const empty = cart.lines.length === 0;
  return (
    <Drawer
      open={cart.open}
      onClose={closeCart}
      title={`Bag${cart.count ? ` (${cart.count})` : ''}`}
      footer={
        empty ? null : (
          <div className="space-y-3">
            <CartTotals quote={quote} />
            <Link
              href="/checkout"
              onClick={closeCart}
              className="block w-full bg-ink py-3 text-center text-sm font-medium text-paper"
            >
              Checkout
            </Link>
            <Link href="/cart" onClick={closeCart} className="block text-center text-sm underline">
              View bag
            </Link>
          </div>
        )
      }
    >
      {empty ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">Your bag is empty.</p>
          <Link href="/shop" onClick={closeCart} className="mt-4 inline-block text-sm underline">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <FreeShippingProgress quote={quote} />
          <CartLines lines={cart.lines} quote={quote} compact />
        </div>
      )}
    </Drawer>
  );
}

/**
 * Header bag button with live count; also mounts the drawer. Pass as
 * `<Header cartSlot={<CartButton />} />`.
 */
export function CartButton({ className }: { className?: string }) {
  const { count } = useCart();
  return (
    <>
      <button
        type="button"
        className={className ?? 'inline-flex h-10 min-w-10 items-center justify-center gap-1.5 text-ink hover:opacity-60'}
        onClick={openCart}
        aria-label={`Open bag, ${count} item${count === 1 ? '' : 's'}`}
      >
        <IconBag aria-hidden="true" />
        {count > 0 && <span className="text-sm tabular-nums">{count}</span>}
      </button>
      <CartDrawer />
    </>
  );
}

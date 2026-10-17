'use client';
// Mount once (e.g. in the shop header/layout). Opens on addToCart/openCart.

import Link from 'next/link';
import { Drawer } from '@/components/ui';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { IconBag } from '@/components/ui/icons';
import { closeCart, openCart, useCart } from '@/lib/commerce/cart-client';
import { useQuote } from '@/lib/commerce/use-quote';
import { formatPaise } from '@/lib/money';
import { CartLines, FreeShippingProgress, PresaleNotice } from './cart-lines';

export function EmptyBag({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <span aria-hidden="true" className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-line">
        <IconBag />
      </span>
      <p className="font-display text-h4 font-light text-ink">Your bag is empty</p>
      <p className="mt-2 max-w-[18rem] text-small text-muted">Quiet pieces, made to be worn for years. Start with the current drop.</p>
      <ButtonLink href="/shop" variant="secondary" className="mt-8" onClick={onNavigate}>
        Shop the collection
      </ButtonLink>
    </div>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const { quote, loading } = useQuote(cart.open ? cart.lines : [], cart.couponCode);
  const empty = cart.lines.length === 0;
  const blocked = Boolean(quote?.issues.length) || Boolean(quote?.mixedPresale);
  return (
    <Drawer
      open={cart.open}
      onClose={closeCart}
      title={`Bag${cart.count ? ` · ${cart.count}` : ''}`}
      className="w-full sm:max-w-[440px]"
      footer={
        empty ? null : (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-small text-ink">Subtotal</span>
              <span className="text-lead tabular-nums" aria-live="polite">
                {quote ? formatPaise(quote.subtotal - quote.discount) : '—'}
              </span>
            </div>
            <p className="-mt-2 text-caption text-muted">
              Inclusive of GST.{' '}
              {quote?.preorder ? 'Shipping calculated at checkout.' : quote && quote.shipping === 0 ? 'Complimentary shipping.' : 'Shipping calculated at checkout.'}
            </p>
            <ButtonLink
              href="/checkout"
              onClick={closeCart}
              fullWidth
              size="lg"
              aria-disabled={blocked || undefined}
              className={blocked ? 'pointer-events-none opacity-40' : undefined}
            >
              {loading && !quote ? 'Checkout' : quote ? `Checkout · ${formatPaise(quote.total)}` : 'Checkout'}
            </ButtonLink>
            <Link href="/cart" onClick={closeCart} className="block text-center text-caption text-muted underline decoration-line underline-offset-4 hover:text-ink">
              View bag and apply a code
            </Link>
          </div>
        )
      }
    >
      {empty ? (
        <EmptyBag onNavigate={closeCart} />
      ) : (
        <div className="space-y-5">
          <FreeShippingProgress quote={quote} />
          <PresaleNotice quote={quote} />
          <CartLines lines={cart.lines} quote={quote} compact onNavigate={closeCart} />
        </div>
      )}
    </Drawer>
  );
}

/**
 * Header bag button with live count; also mounts the drawer. Pass as
 * `<Header cartSlot={<CartButton />} />`. `variant="text"` reads "Bag 2" in tracked caps
 * (the storefront header); `icon` is the bag glyph with a count dot.
 */
export function CartButton({ className, variant = 'icon' }: { className?: string; variant?: 'icon' | 'text' }) {
  const { count } = useCart();
  const label = `Open bag, ${count} item${count === 1 ? '' : 's'}`;
  if (variant === 'text') {
    return (
      <>
        <button
          type="button"
          className={className ?? 'inline-flex h-10 items-center gap-[0.55em] font-sans text-label uppercase text-current transition-opacity duration-fast hover:opacity-60'}
          onClick={openCart}
          aria-label={label}
        >
          <span aria-hidden="true">Bag</span>
          <span aria-hidden="true" className="tabular-nums">
            {count}
          </span>
        </button>
        <CartDrawer />
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        className={className ?? 'relative inline-flex h-10 min-w-10 items-center justify-center text-ink transition-opacity duration-fast hover:opacity-60'}
        onClick={openCart}
        aria-label={label}
      >
        <IconBag aria-hidden="true" />
        {count > 0 && (
          <span className="absolute right-0.5 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none tabular-nums text-paper">
            {count}
          </span>
        )}
      </button>
      <CartDrawer />
    </>
  );
}

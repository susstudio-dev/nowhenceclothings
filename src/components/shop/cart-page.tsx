'use client';

import { ButtonLink } from '@/components/ui/ButtonLink';
import { useCart } from '@/lib/commerce/cart-client';
import { useQuote } from '@/lib/commerce/use-quote';
import { CartLines, CartTotals, CouponForm, FreeShippingProgress, PresaleNotice } from './cart-lines';
import { EmptyBag } from './cart-drawer';

export function CartPageClient() {
  const cart = useCart();
  const { quote, error } = useQuote(cart.lines, cart.couponCode);
  if (!cart.lines.length) return <EmptyBag />;
  const blocked = Boolean(quote?.issues.length) || Boolean(quote?.mixedPresale);
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20">
      <section aria-label="Items">
        <div className="flex items-baseline justify-between border-b border-ink pb-3">
          <p className="text-label uppercase text-ink">
            {cart.count} {cart.count === 1 ? 'piece' : 'pieces'}
          </p>
          <ButtonLink href="/shop" variant="link" size="sm">
            Continue shopping
          </ButtonLink>
        </div>
        <CartLines lines={cart.lines} quote={quote} />
      </section>
      <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start" aria-label="Summary">
        <p className="border-b border-ink pb-3 text-label uppercase text-ink">Summary</p>
        <FreeShippingProgress quote={quote} />
        <PresaleNotice quote={quote} />
        <CouponForm couponCode={cart.couponCode} quote={quote} />
        <CartTotals quote={quote} />
        {error && (
          <p role="alert" className="text-caption text-sale">
            {error}
          </p>
        )}
        {blocked && !quote?.mixedPresale && <p className="text-caption text-sale">Remove unavailable pieces to continue.</p>}
        <ButtonLink href="/checkout" fullWidth size="lg" aria-disabled={blocked || undefined} className={blocked ? 'pointer-events-none opacity-40' : undefined}>
          Checkout securely
        </ButtonLink>
        <ul className="space-y-1.5 border-t border-line pt-5 text-caption text-muted">
          <li>UPI, cards, netbanking and wallets via Razorpay</li>
          <li>{quote?.shippingEta || 'Ships in 2–4 working days'}</li>
          <li>Easy exchanges within 7 days of delivery</li>
        </ul>
      </aside>
    </div>
  );
}

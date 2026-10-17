import type { PublicProduct } from '@/lib/launches';
import { formatPaise } from '@/lib/money';

export type QuickBuyMode = 'deposit' | 'full' | 'buy';

/** The product the home hero features for A16: the first open presale / pre-booking piece. */
export function heroPresaleProduct(products: PublicProduct[]): PublicProduct | undefined {
  return products.find((p) => p.launch.state === 'presale' && p.launch.presale && p.colours.some((c) => c.images.length));
}

/** Deposit in paise per unit, from the public label ("₹999 deposit" or "20% deposit"). */
export function depositAmount(label: string, price: number): number | undefined {
  const pct = /^(\d+(?:\.\d+)?)% deposit$/.exec(label);
  if (pct) return Math.round((price * Number(pct[1])) / 100);
  const fixed = /^₹([\d,]+(?:\.\d+)?) deposit$/.exec(label);
  if (fixed) return Math.round(Number(fixed[1].replace(/,/g, '')) * 100);
  return undefined;
}

/** Mode + primary button label for a presale product. */
export function quickBuyAction(p: PublicProduct): { mode: QuickBuyMode; label: string } {
  const pre = p.launch.presale;
  if (pre?.paymentMode === 'deposit' && pre.deposit) {
    const amt = depositAmount(pre.deposit.label, p.price);
    return { mode: 'deposit', label: amt != null ? `Reserve for ${formatPaise(amt)}` : pre.deposit.ctaLabel };
  }
  if (pre) return { mode: 'full', label: `Pre-order ${formatPaise(p.price)}` };
  return { mode: 'buy', label: `Buy now ${formatPaise(p.price)}` };
}

/** SizeSelector's auto-fill grid leaves an empty grey track on wide columns; pin the column count. */
export function sizeGridClass(n: number): string {
  const map: Record<number, string> = {
    3: '[&_[role=radiogroup]]:grid-cols-3',
    4: '[&_[role=radiogroup]]:grid-cols-4',
    5: '[&_[role=radiogroup]]:grid-cols-5',
    6: '[&_[role=radiogroup]]:grid-cols-6',
    7: '[&_[role=radiogroup]]:grid-cols-7',
  };
  return map[Math.min(7, Math.max(3, n))];
}

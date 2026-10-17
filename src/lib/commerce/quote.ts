// Server-side cart resolution + pricing (C5). Used by /api/checkout/quote for
// display and by /api/checkout as the authoritative total.

import 'server-only';
import { getCatalogue, getInventory, isReleased } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { readJson } from '@/lib/storage';
import { COUPONS_KEY, CouponsDoc, type Coupon } from '@/lib/schemas/coupons';
import { available } from '@/lib/schemas/inventory';
import type { CatalogueDoc } from '@/lib/schemas/catalogue';
import type { InventoryDoc } from '@/lib/schemas/inventory';
import type { SettingsDoc } from '@/lib/schemas/settings';
import { applyPresalePrice, formatShipCopy, presaleTerms, resolveLaunch, type EffectivePresale } from '@/lib/launches';
import { COUPON_MESSAGES, findCoupon, priceCart, type PricingInputLine } from './pricing';
import type { CartRequestLine, LineIssue, QuoteLine, QuoteResponse } from './types';

export interface QuoteContext {
  catalogue: CatalogueDoc;
  inventory: InventoryDoc;
  settings: SettingsDoc;
  coupons: Coupon[];
  now?: Date;
}

export async function loadQuoteContext(): Promise<QuoteContext> {
  const [catalogue, inventory, settings, coupons] = await Promise.all([
    getCatalogue(),
    getInventory(),
    getSettings(),
    readJson(COUPONS_KEY, CouponsDoc),
  ]);
  return { catalogue, inventory, settings, coupons: coupons?.coupons ?? [] };
}

/** Merge duplicate SKUs, clamp qty to the per-line max. Pure. */
export function normaliseLines(lines: CartRequestLine[], maxQty: number): CartRequestLine[] {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.sku, (map.get(l.sku) ?? 0) + l.qty);
  return [...map].map(([sku, qty]) => ({ sku, qty: Math.min(qty, maxQty) }));
}

/** Resolve, check and price a cart. Pure given the context. */
export function buildQuote(
  ctx: QuoteContext,
  reqLines: CartRequestLine[],
  couponCode?: string,
): QuoteResponse {
  const now = ctx.now ?? new Date();
  const lines = normaliseLines(reqLines, ctx.settings.orders.maxQtyPerLine);
  const issues: QuoteResponse['issues'] = [];
  const inputs: PricingInputLine[] = [];
  const meta: Omit<QuoteLine, 'unitPrice' | 'compareAtPrice' | 'lineTotal'>[] = [];
  let presale: EffectivePresale | null = null;

  for (const { sku, qty } of lines) {
    let found: { product: CatalogueDoc['products'][number]; variant: CatalogueDoc['products'][number]['variants'][number] } | null = null;
    for (const product of ctx.catalogue.products) {
      const variant = product.variants.find((v) => v.sku === sku);
      if (variant) {
        found = { product, variant };
        break;
      }
    }
    if (!found) {
      issues.push({ sku, issue: 'unknown' });
      continue;
    }
    const { variant } = found;
    let product = found.product;
    let issue: LineIssue | null = null;
    const launch = resolveLaunch(product, ctx.catalogue.drops, ctx.settings.launches, now);
    const isPre = product.status === 'active' && launch.state === 'presale' && !!launch.presale;
    // Presale units count against the presale cap (checked at checkout), not inventory.
    // F19: the per-customer limit is flagged here so the bag warns early.
    const avail = isPre ? Math.min(qty, launch.presale!.perCustomerLimit) : available(ctx.inventory[sku]);
    if (product.status !== 'active') issue = 'unavailable';
    else if (launch.state === 'coming_soon') issue = 'not_released';
    else if (launch.state === 'sold_out') issue = 'out_of_stock';
    else if (!isPre && !isReleased(product, ctx.catalogue.drops, now)) issue = 'not_released';
    else if (avail <= 0) issue = 'out_of_stock';
    else if (avail < qty) issue = isPre ? 'presale_limit' : 'insufficient_stock';
    if (issue) issues.push({ sku, issue, available: avail });
    if (issue && issue !== 'insufficient_stock' && issue !== 'presale_limit') continue;
    if (isPre) {
      product = applyPresalePrice(product, launch.presale!);
      presale ??= launch.presale!;
    }

    const colour = product.colours.find((c) => c.id === variant.colourId);
    const img = colour?.images[0];
    const useQty = Math.min(qty, avail);
    inputs.push({ product, variant, qty: useQty });
    meta.push({
      sku,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      colour: colour?.name ?? variant.colourId,
      size: variant.size,
      qty: useQty,
      image: img?.src,
      available: avail,
      ...(isPre
        ? { preorder: true, shipCopy: launch.presale!.shipCopy, ...(launch.presale!.shipBy ? { shipBy: launch.presale!.shipBy } : {}) }
        : {}),
    });
  }

  const mixedPresale = meta.some((m) => m.preorder) && meta.some((m) => !m.preorder);
  if (mixedPresale) for (const m of meta) if (!m.preorder) issues.push({ sku: m.sku, issue: 'mixed_presale', available: m.available });

  const coupon = findCoupon(ctx.coupons, couponCode);
  const b = priceCart({ lines: inputs, settings: ctx.settings, couponCode, coupon, now });
  const out: QuoteLine[] = b.lines.map((pl, i) => ({
    ...meta[i]!,
    unitPrice: pl.unitPrice,
    compareAtPrice: pl.compareAtPrice,
    lineTotal: pl.lineTotal,
  }));

  return {
    lines: out,
    issues,
    subtotal: b.subtotal,
    discount: b.discount,
    shipping: b.shipping,
    total: b.total,
    couponCode: b.couponCode,
    couponError: b.couponError ? COUPON_MESSAGES[b.couponError] : undefined,
    freeShippingThreshold: b.freeShippingThreshold,
    freeShippingRemaining: b.freeShippingRemaining,
    shippingEta: ctx.settings.shipping.eta,
    ...(presale
      ? {
          preorder: {
            shipBy: presale.shipBy,
            shipCopy: formatShipCopy(presale.shipCopy, presale.shipBy),
            access: presale.access,
            terms: presaleTerms(presale.terms, presale.shipBy),
          },
        }
      : {}),
    ...(mixedPresale ? { mixedPresale: true } : {}),
  };
}

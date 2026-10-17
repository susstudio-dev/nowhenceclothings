// Pure cart reducers (shared by cart-client and tests).

/** Only sku + qty are required; the rest is an optional display snapshot
 *  (the drawer fills gaps from the server quote). */
export interface CartLine {
  sku: string;
  qty: number;
  productId?: string;
  slug?: string;
  title?: string;
  colour?: string;
  size?: string;
  /** Display snapshot only; the server re-prices. Paise. */
  unitPrice?: number;
  compareAtPrice?: number;
  image?: string;
}

export interface CartState {
  lines: CartLine[];
  couponCode?: string;
}

export const EMPTY_CART: CartState = { lines: [] };

const clamp = (n: number, max: number) => Math.max(1, Math.min(max, Math.floor(n)));

export function addLine(s: CartState, line: CartLine, max: number): CartState {
  const existing = s.lines.find((l) => l.sku === line.sku);
  if (existing) {
    return {
      ...s,
      lines: s.lines.map((l) => (l.sku === line.sku ? { ...l, ...line, qty: clamp(l.qty + line.qty, max) } : l)),
    };
  }
  return { ...s, lines: [...s.lines, { ...line, qty: clamp(line.qty, max) }] };
}

export function updateLineQty(s: CartState, sku: string, qty: number, max: number): CartState {
  if (!Number.isFinite(qty) || qty < 1) return removeLineFrom(s, sku);
  return { ...s, lines: s.lines.map((l) => (l.sku === sku ? { ...l, qty: clamp(qty, max) } : l)) };
}

export function removeLineFrom(s: CartState, sku: string): CartState {
  return { ...s, lines: s.lines.filter((l) => l.sku !== sku) };
}

export function setCoupon(s: CartState, code: string | undefined): CartState {
  const c = code?.trim().toUpperCase();
  return c ? { ...s, couponCode: c } : { lines: s.lines };
}

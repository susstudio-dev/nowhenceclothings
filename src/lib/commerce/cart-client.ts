'use client';
// S5. Cart persisted in localStorage. Lines carry display snapshots (title,
// price, image) for instant rendering; the server re-prices everything via
// /api/checkout/quote, and only SKU + qty are ever sent to checkout.

import { useSyncExternalStore } from 'react';
import { addLine, EMPTY_CART, removeLineFrom, setCoupon, updateLineQty, wouldMixPresale, type CartLine, type CartState } from './cart-core';
import { addToCartParams, track } from '../analytics/meta';

export type { CartLine, CartState } from './cart-core';

const STORAGE_KEY = 'nowhence.cart.v1';

let state: CartState = EMPTY_CART;
let drawerOpen = false;
let hydrated = false;
const listeners = new Set<() => void>();

function load(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw) as CartState;
    if (!Array.isArray(parsed?.lines)) return EMPTY_CART;
    return { lines: parsed.lines.filter((l) => l && typeof l.sku === 'string' && l.qty > 0), couponCode: parsed.couponCode };
  } catch {
    return EMPTY_CART;
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  state = load();
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      emit();
    }
  });
}

function emit() {
  snapshot = { ...state, open: drawerOpen };
  for (const l of listeners) l();
}

function commit(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: cart lives in memory for this tab */
  }
  emit();
}

export const MAX_QTY = 10;

export class MixedCartError extends Error {
  constructor() {
    super('Pre-order pieces ship later, so they need their own checkout. Finish or clear your bag first.');
    this.name = 'MixedCartError';
  }
}

/** Throws MixedCartError when the line would mix pre-order and in-stock pieces (A11). */
export function addToCart(line: CartLine, opts: { open?: boolean } = {}) {
  ensureHydrated();
  if (wouldMixPresale(state, line)) throw new MixedCartError();
  if (opts.open !== false) drawerOpen = true;
  commit(addLine(state, line, MAX_QTY));
  // Every add path goes through here (bag button, Buy now). Only buyable
  // pieces reach the bag, so no hidden coming-soon title/price is sent.
  track('AddToCart', addToCartParams(line));
}
export function updateQty(sku: string, qty: number) {
  ensureHydrated();
  commit(updateLineQty(state, sku, qty, MAX_QTY));
}
export function removeLine(sku: string) {
  ensureHydrated();
  commit(removeLineFrom(state, sku));
}
export function applyCoupon(code: string | undefined) {
  ensureHydrated();
  commit(setCoupon(state, code));
}
export function clearCart() {
  ensureHydrated();
  commit(EMPTY_CART);
}
export function openCart() {
  drawerOpen = true;
  emit();
}
export function closeCart() {
  drawerOpen = false;
  emit();
}

type Snapshot = CartState & { open: boolean };
let snapshot: Snapshot = { ...EMPTY_CART, open: false };
const SERVER_SNAPSHOT: Snapshot = { ...EMPTY_CART, open: false };

function subscribe(fn: () => void) {
  ensureHydrated();
  listeners.add(fn);
  if (snapshot.lines !== state.lines) emit();
  return () => listeners.delete(fn);
}

/** `{ lines, couponCode, open, count }` — re-renders on any cart change. */
export function useCart() {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
  return { ...s, count: s.lines.reduce((n, l) => n + l.qty, 0) };
}

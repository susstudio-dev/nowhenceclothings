'use client';
// Fetches the authoritative server price for the current cart.

import { useEffect, useState } from 'react';
import type { CartLine } from './cart-core';
import type { QuoteResponse } from './types';

export function useQuote(lines: CartLine[], couponCode?: string) {
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify([lines.map((l) => [l.sku, l.qty]), couponCode ?? '']);

  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/checkout/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines: lines.map((l) => ({ sku: l.sku, qty: l.qty })), couponCode }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not price your bag.');
        setQuote(json as QuoteResponse);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError((err as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, loading, error };
}

export const ISSUE_TEXT: Record<string, string> = {
  unknown: 'This item is no longer available.',
  unavailable: 'This item is no longer available.',
  not_released: 'This drop has not been released yet.',
  out_of_stock: 'Sold out.',
  insufficient_stock: 'Only a few left — quantity reduced.',
  mixed_presale: 'In stock — check this out separately from your pre-order.',
};

'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { SizeSelector } from '@/components/ui/SizeSelector';
import { Swatch } from '@/components/ui/Swatch';
import type { PublicProduct } from '@/lib/launches';
import { QuickBuySheet } from './checkout/QuickBuySheet';
import { sizeGridClass, type QuickBuyMode } from './quick-buy';

/** Colour + size + one primary button; opens checkout/booking in a sheet over the page (A16). */
export function QuickBuyPanel({
  product,
  stock,
  mode,
  cta,
  access,
}: {
  product: PublicProduct;
  stock: Record<string, number>;
  mode: QuickBuyMode;
  cta: string;
  access?: 'public' | 'code' | 'waitlist';
}) {
  const [colourId, setColourId] = useState(product.colours[0].id);
  const [size, setSize] = useState<string>();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const presale = mode !== 'buy';
  const sizes = product.sizes.map((s) => {
    const v = product.variants.find((x) => x.colourId === colourId && x.size === s);
    const n = v ? stock[v.sku] ?? 0 : 0;
    return { value: s, label: s, disabled: !v || (!presale && n === 0), note: !presale && n > 0 && n <= 3 ? `${n} left` : undefined };
  });
  return (
    <div className="mt-8 space-y-6">
      {product.colours.length > 1 && (
        <Swatch
          options={product.colours.map((c) => ({ value: c.id, label: c.name, hex: c.hex }))}
          value={colourId}
          onChange={(v) => { setColourId(v); setSize(undefined); }}
        />
      )}
      <SizeSelector options={sizes} value={size} onChange={(v) => { setSize(v); setError(''); }} error={error || undefined} className={sizeGridClass(sizes.length)} />
      <Button
        size="lg"
        fullWidth
        onClick={() => (size ? setOpen(true) : setError('Choose a size.'))}
      >
        {cta}
      </Button>
      {access && access !== 'public' && (
        <p className="text-caption text-muted">{access === 'code' ? 'Access code required at checkout.' : 'Open to the waitlist. Use the email you signed up with.'}</p>
      )}
      {open && size && <QuickBuySheet product={product} colourId={colourId} size={size} mode={mode} onClose={() => setOpen(false)} />}
    </div>
  );
}

import { cn } from './cn';
import { formatPaise } from '@/lib/money';

export { formatPaise };

export interface PriceProps {
  /** Integer paise. */
  amount: number;
  /** Integer paise; shown struck-through when greater than amount. */
  compareAt?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'text-small', md: 'text-body', lg: 'text-lead' } as const;

/** Tabular-figure price. On sale: current price in oxblood, original struck through. */
export function Price({ amount, compareAt, size = 'md', className }: PriceProps) {
  const onSale = compareAt != null && compareAt > amount;
  return (
    <span
      className={cn('inline-flex items-baseline gap-2 tabular-nums', sizes[size], className)}
      data-size={size}
    >
      {onSale && <span className="sr-only">Sale price</span>}
      <span className={onSale ? 'text-sale' : undefined}>{formatPaise(amount)}</span>
      {onSale && (
        <>
          <span className="sr-only">, was</span>
          <s className="text-[0.875em] text-muted">{formatPaise(compareAt)}</s>
        </>
      )}
    </span>
  );
}

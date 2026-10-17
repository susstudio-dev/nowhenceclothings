'use client';
import { cn } from './cn';
import { IconMinus, IconPlus } from './icons';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Accessible group name, e.g. "Quantity, Rain Emboss Polo". */
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

/** Minus / value / plus in a hairline box. Buttons disable at the bounds; the value is announced politely. */
export function QuantityStepper({ value, onChange, min = 1, max = 10, label = 'Quantity', size = 'md', disabled, className }: QuantityStepperProps) {
  const btn = cn(
    'inline-flex w-9 items-center justify-center text-ink transition-opacity duration-fast hover:opacity-60 disabled:opacity-25',
    size === 'sm' ? 'h-9' : 'h-11',
  );
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center border border-line', className)}>
      <button type="button" className={btn} aria-label="Decrease" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <IconMinus size={14} />
      </button>
      <span aria-live="polite" className="min-w-7 text-center text-small tabular-nums">
        {value}
      </span>
      <button type="button" className={btn} aria-label="Increase" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <IconPlus size={14} />
      </button>
    </div>
  );
}

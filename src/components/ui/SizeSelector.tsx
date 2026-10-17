'use client';
import type { ReactNode } from 'react';
import { cn } from './cn';

export interface SizeOption {
  value: string;
  label: string;
  /** Sold out / unavailable: struck through, not selectable. */
  disabled?: boolean;
  /** Low-stock note, e.g. "2 left". */
  note?: string;
}

export interface SizeSelectorProps {
  options: SizeOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  /** Right side of the label row, e.g. a size-guide link. */
  aside?: ReactNode;
  error?: string;
  className?: string;
}

/** Size radiogroup: equal hairline cells, ink fill when selected, struck through when sold out. */
export function SizeSelector({ options, value, onChange, label = 'Size', aside, error, className }: SizeSelectorProps) {
  const current = options.find((o) => o.value === value);
  return (
    <fieldset className={cn('min-w-0', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <legend className="flex gap-3 text-label uppercase text-ink">
          {label}
          {current?.note && <span className="normal-case tracking-normal text-clay">{current.note}</span>}
        </legend>
        {aside && <div className="text-caption text-muted">{aside}</div>}
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-px border border-line bg-line"
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.disabled ? `${o.label}, sold out` : o.label}
              disabled={o.disabled}
              onClick={() => onChange?.(o.value)}
              className={cn(
                'h-12 text-small tabular-nums transition-colors duration-fast ease-out',
                on ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-deep',
                o.disabled && 'cursor-not-allowed text-muted/70 line-through hover:bg-paper',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-caption text-sale">
          {error}
        </p>
      )}
    </fieldset>
  );
}

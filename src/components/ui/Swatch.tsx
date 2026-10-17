'use client';
import { cn } from './cn';

export interface SwatchOption {
  value: string;
  label: string;
  /** CSS colour, e.g. '#1d2a3a'. */
  hex?: string;
  /** Optional image URL (fabric crop) used instead of hex. */
  image?: string;
  disabled?: boolean;
}

export interface SwatchProps {
  options: SwatchOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** Group label, e.g. "Colour". Rendered as "COLOUR  Navy". */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Colour picker: radiogroup of round chips with an offset ring on the selected one. */
export function Swatch({ options, value, onChange, label = 'Colour', size = 'md', className }: SwatchProps) {
  const current = options.find((o) => o.value === value);
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-7 w-7';
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-3 flex gap-3 text-label uppercase text-ink">
        {label}
        {current && <span className="normal-case tracking-normal text-muted">{current.label}</span>}
      </legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              title={o.label}
              disabled={o.disabled}
              onClick={() => onChange?.(o.value)}
              className={cn(
                'relative rounded-full ring-offset-2 ring-offset-paper transition-[box-shadow] duration-base ease-out',
                dim,
                on ? 'ring-1 ring-ink' : 'ring-1 ring-transparent hover:ring-line',
                o.disabled && 'cursor-not-allowed opacity-40',
              )}
            >
              <span
                aria-hidden="true"
                className="block h-full w-full rounded-full border border-ink/10 bg-cover bg-center"
                style={{ backgroundColor: o.hex, backgroundImage: o.image ? `url(${o.image})` : undefined }}
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

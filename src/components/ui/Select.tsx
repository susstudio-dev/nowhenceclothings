import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';
import { fieldControl, fieldError, fieldLabel } from './field';
import { IconChevronDown } from './icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hideLabel?: boolean;
}

/** Native select (best mobile accessibility) with a hairline chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, error, hideLabel = false, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={selectId} className={hideLabel ? 'sr-only' : fieldLabel}>
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={cn(fieldControl, 'cursor-pointer appearance-none pr-10')}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={16}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
      {error && (
        <p id={`${selectId}-error`} role="alert" className={fieldError}>
          {error}
        </p>
      )}
    </div>
  );
});

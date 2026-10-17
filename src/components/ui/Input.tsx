import type React from 'react';
import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { fieldControl, fieldControlFloating, fieldError, fieldFloatingLabel, fieldHint, fieldLabel } from './field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  /** `top` (default): label above. `floating`: label sits inside and lifts on focus/value. */
  labelStyle?: 'top' | 'floating';
  /** Text or node shown at the right edge inside the field (e.g. a unit or status). */
  trailing?: React.ReactNode;
}

/** Labelled text input. Hint and error are wired via aria-describedby; errors use role="alert". */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel = false, labelStyle = 'top', trailing, id, className, required, placeholder, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy =
    [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  const floating = labelStyle === 'floating' && !hideLabel;
  const star = required && !hideLabel && (
    <span aria-hidden="true" className="ml-1 text-muted">
      *
    </span>
  );
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {!floating && (
        <label htmlFor={inputId} className={hideLabel ? 'sr-only' : fieldLabel}>
          {label}
          {star}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          placeholder={floating ? (placeholder ?? ' ') : placeholder}
          className={cn(fieldControl, floating && fieldControlFloating, trailing ? 'pr-12' : undefined)}
          {...rest}
        />
        {floating && (
          <label htmlFor={inputId} className={fieldFloatingLabel}>
            {label}
            {star}
          </label>
        )}
        {trailing && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-caption text-muted">{trailing}</span>
        )}
      </div>
      {hint && (
        <p id={`${inputId}-hint`} className={fieldHint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className={fieldError}>
          {error}
        </p>
      )}
    </div>
  );
});

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { fieldControl, fieldError, fieldHint, fieldLabel } from './field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

/** Labelled text input. Hint and error are wired via aria-describedby; errors use role="alert". */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel = false, id, className, required, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy =
    [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : fieldLabel}>
        {label}
        {required && !hideLabel && (
          <span aria-hidden="true" className="ml-1 text-muted">
            *
          </span>
        )}
      </label>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={fieldControl}
        {...rest}
      />
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

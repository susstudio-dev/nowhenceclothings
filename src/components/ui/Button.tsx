import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-none font-sans ' +
  'transition-[background-color,color,border-color,opacity,transform] duration-base ease-out ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-ink ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-ink bg-ink text-paper uppercase tracking-[0.12em] hover:bg-ink-soft active:translate-y-px',
  secondary:
    'border border-ink bg-transparent text-ink uppercase tracking-[0.12em] hover:bg-ink hover:text-paper active:translate-y-px',
  ghost: 'border border-transparent bg-transparent text-ink uppercase tracking-[0.12em] hover:border-line active:translate-y-px',
  link: 'h-auto p-0 text-small text-ink underline decoration-1 underline-offset-4 hover:decoration-transparent',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-micro',
  md: 'h-12 px-6 text-caption',
  lg: 'h-14 px-8 text-caption',
};

/** Square-cornered, uppercase-tracked button. `link` renders as inline underlined text. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      className={cn(
        base,
        variants[variant],
        variant !== 'link' && sizes[size],
        fullWidth && 'w-full',
        loading && 'disabled:opacity-100',
        className,
      )}
      {...rest}
    >
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {iconLeft}
        {children}
        {iconRight}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
          <span className="sr-only">Loading</span>
        </span>
      )}
    </button>
  );
});

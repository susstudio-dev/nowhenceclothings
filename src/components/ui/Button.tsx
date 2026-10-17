import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'ghost' | 'link' | 'inverse';
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
  'relative inline-flex select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-none font-sans font-medium ' +
  'transition-[background-color,color,border-color,opacity,transform] duration-base ease-out active:scale-[0.99] ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-ink ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';

const caps = 'uppercase tracking-label';

/** Variant classes; exported so links can look like buttons (see ButtonLink). */
export const buttonVariants: Record<ButtonVariant, string> = {
  primary: `${caps} border border-ink bg-ink text-paper hover:bg-ink-soft hover:border-ink-soft`,
  secondary: `${caps} border border-ink/80 bg-transparent text-ink hover:bg-ink hover:text-paper`,
  quiet: `${caps} border border-line bg-paper text-ink hover:border-ink`,
  ghost: `${caps} border border-transparent bg-transparent text-ink hover:bg-ink/[0.04]`,
  inverse: `${caps} border border-paper bg-paper text-ink hover:bg-transparent hover:text-paper`,
  link: 'h-auto p-0 text-small text-ink underline decoration-ink/30 decoration-1 underline-offset-[5px] hover:decoration-ink',
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[0.625rem]',
  md: 'h-12 px-7 text-label',
  lg: 'h-14 px-9 text-label',
};

/** Class string for a button-styled element (anchors, Next links). */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', fullWidth = false): string {
  return [base, buttonVariants[variant], variant !== 'link' ? buttonSizes[size] : '', fullWidth ? 'w-full' : ''].join(' ');
}

/**
 * Square-cornered, tracked-caps button. primary = ink fill (one per view), secondary = ink outline,
 * quiet = hairline on paper, ghost = no border, inverse = for dark imagery, link = inline underline.
 */
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
        buttonVariants[variant],
        variant !== 'link' && buttonSizes[size],
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

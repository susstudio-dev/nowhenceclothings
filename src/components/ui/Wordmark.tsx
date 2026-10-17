import { cn } from './cn';

/** Typeset wordmark; text comes from settings.brand.wordmark (A9), default NOWHENCE. */
export function Wordmark({ className, text }: { className?: string; text?: string }) {
  return (
    <span
      className={cn(
        'font-display text-[1.375rem] leading-none tracking-[0.18em] md:text-[1.625rem]',
        className,
      )}
    >
      {text?.trim() || 'NOWHENCE'}
    </span>
  );
}

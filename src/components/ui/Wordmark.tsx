import { cn } from './cn';

/** Placeholder logo (D12): a typeset wordmark until the real mark arrives. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-display text-[1.375rem] leading-none tracking-[0.18em] md:text-[1.625rem]',
        className,
      )}
    >
      NOWHENCE
    </span>
  );
}

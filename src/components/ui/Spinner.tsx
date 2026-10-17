import { cn } from './cn';

/** Quiet loading indicator: a rotating hairline arc. Decorative; pair with aria-busy. */
export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn('animate-spin motion-reduce:animate-none', className)}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.25" />
      <path d="M14.5 8A6.5 6.5 0 008 1.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

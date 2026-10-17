import { cn } from './cn';

/**
 * Quiet loading indicator built from the brand motif: the wordmark's ring
 * with three button-holes, turning slowly. Decorative; pair with aria-busy.
 */
export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={cn('nh-ring-spin motion-reduce:animate-none', className)}
    >
      <path fillRule="evenodd" d="M8 .5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15Zm0 1.6a5.9 5.9 0 1 0 0 11.8a5.9 5.9 0 0 0 0-11.8Z" />
      <circle cx="8" cy="5.3" r="1.25" />
      <circle cx="5.75" cy="9.3" r="1.25" />
      <circle cx="10.25" cy="9.3" r="1.25" />
    </svg>
  );
}

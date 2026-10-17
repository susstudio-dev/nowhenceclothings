import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { IconArrowRight } from '@/components/ui/icons';
import type { HeaderAnnouncement } from './announcement';

/**
 * The announcement as a status line, not a slab: a slowly breathing clay dot, the owner's
 * words in tracked micro caps and, for pre-orders, the date in quiet sentence case.
 * Colour comes from the header state (ink on paper, paper over the hero).
 */
export function HeaderStatus({
  announcement: a,
  className,
  onNavigate,
  size = 'bar',
}: {
  announcement: HeaderAnnouncement;
  className?: string;
  onNavigate?: () => void;
  /** `bar` sits in the header; `menu` is the slightly larger line inside the mobile menu. */
  size?: 'bar' | 'menu';
}) {
  const body = (
    <>
      <span aria-hidden="true" className="nh-live h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
      <span className={cn('font-sans uppercase leading-none tracking-label', size === 'bar' ? 'text-[0.625rem]' : 'text-label')}>
        {a.text}
      </span>
      {a.note && (
        <>
          <span aria-hidden="true" className="h-px w-4 shrink-0 bg-current opacity-35" />
          <span className="sr-only">, </span>
          <span className="whitespace-nowrap text-caption leading-none tabular-nums opacity-70">{a.note}</span>
        </>
      )}
    </>
  );
  const base = cn('items-center gap-2.5 whitespace-nowrap text-current', size === 'bar' ? 'h-10' : 'min-h-11', className);
  if (!a.href) return <p className={cn('flex', base)}>{body}</p>;

  const arrow = (
    <IconArrowRight
      size={12}
      className="-ml-0.5 shrink-0 opacity-0 transition-[opacity,transform] duration-base ease-out group-hover:translate-x-0.5 group-hover:opacity-70 group-focus-visible:opacity-70"
    />
  );
  const linkClass = cn(
    'group flex transition-opacity duration-fast ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4',
    base,
  );
  return a.external ? (
    <a href={a.href} target="_blank" rel="noopener noreferrer" className={linkClass} onClick={onNavigate}>
      {body}
      {arrow}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <Link href={a.href} className={linkClass} onClick={onNavigate}>
      {body}
      {arrow}
    </Link>
  );
}

import type { ReactNode } from 'react';
import { cn } from './cn';
import { IconPlus } from './icons';

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Ids open on first render. */
  defaultOpen?: string[];
  className?: string;
}

/**
 * Disclosure list on native <details>/<summary>: keyboard and screen-reader
 * semantics for free, works without JS (server component).
 */
export function Accordion({ items, defaultOpen = [], className }: AccordionProps) {
  return (
    <div className={cn('border-t border-line', className)}>
      {items.map((it) => (
        <details key={it.id} open={defaultOpen.includes(it.id)} className="group border-b border-line">
          <summary
            className={cn(
              'flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-micro uppercase text-ink',
              'transition-opacity duration-fast hover:opacity-70 [&::-webkit-details-marker]:hidden',
              'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink',
            )}
          >
            {it.title}
            <IconPlus size={16} className="shrink-0 transition-transform duration-base ease-out group-open:rotate-45" />
          </summary>
          <div className="pb-6 text-small text-ink-soft group-open:animate-fade-in">{it.content}</div>
        </details>
      ))}
    </div>
  );
}

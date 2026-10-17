import Link from 'next/link';
import type { SiteContentDoc } from '@/lib/schemas/site-content';
import { cn } from '@/components/ui/cn';
import { announcementLink } from './announcement';

export interface AnnouncementBarProps {
  /** site-content `announcement`. Renders nothing when disabled or empty. */
  announcement: SiteContentDoc['announcement'];
  className?: string;
}

/** Single quiet line above the header: paper on ink, tracked micro caps. Server component. */
export function AnnouncementBar({ announcement, className }: AnnouncementBarProps) {
  if (!announcement.enabled || !announcement.text.trim()) return null;
  const link = announcementLink(announcement.href);
  const text = <span className="text-[0.625rem] uppercase tracking-label">{announcement.text}</span>;
  const row = 'container-page flex min-h-8 items-center justify-center py-1.5 text-center';
  return (
    <aside aria-label="Announcement" className={cn('bg-ink text-paper', className)}>
      {link ? (
        // The whole bar is the tap target (the text alone is ~10px tall).
        link.external ? (
          <a href={link.href} target="_blank" rel="noopener noreferrer" className={cn(row, 'group focus-visible:outline-offset-[-2px]')}>
            <span className="underline decoration-paper/40 underline-offset-[3px] transition-colors group-hover:decoration-paper">{text}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <Link href={link.href} className={cn(row, 'group focus-visible:outline-offset-[-2px]')}>
            <span className="underline decoration-paper/40 underline-offset-[3px] transition-colors group-hover:decoration-paper">{text}</span>
          </Link>
        )
      ) : (
        <div className={row}>{text}</div>
      )}
    </aside>
  );
}

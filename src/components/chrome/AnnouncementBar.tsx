import Link from 'next/link';
import type { SiteContentDoc } from '@/lib/schemas/site-content';
import { cn } from '@/components/ui/cn';

export interface AnnouncementBarProps {
  /** site-content `announcement`. Renders nothing when disabled or empty. */
  announcement: SiteContentDoc['announcement'];
  className?: string;
}

/** Single quiet line above the header: paper on ink, tracked micro caps. Server component. */
export function AnnouncementBar({ announcement, className }: AnnouncementBarProps) {
  if (!announcement.enabled || !announcement.text.trim()) return null;
  const text = <span className="text-[0.625rem] uppercase tracking-label">{announcement.text}</span>;
  return (
    <aside
      aria-label="Announcement"
      className={cn('bg-ink text-paper', className)}
    >
      <div className="container-page flex min-h-8 items-center justify-center py-1.5 text-center">
        {announcement.href ? (
          <Link href={announcement.href} className="link-underline">
            {text}
          </Link>
        ) : (
          text
        )}
      </div>
    </aside>
  );
}

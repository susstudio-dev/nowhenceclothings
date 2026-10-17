'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { flushPending, isTrackedPath, track } from '@/lib/analytics/meta';

/**
 * PageView on client-side route changes. The first URL is already counted by
 * the bootstrap's own PageView, so it is only remembered, not sent (a ref of
 * the last URL rather than a "first render" flag, so React strict-mode's
 * double effect in dev cannot double count either). Also flushes events that
 * fired before the bootstrap ran.
 */
export function MetaPixelTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search?.toString() ?? '';
  const last = useRef<string | null>(null);

  useEffect(() => {
    flushPending();
  }, []);

  useEffect(() => {
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (last.current === null) {
      last.current = url;
      return;
    }
    if (last.current === url) return;
    last.current = url;
    if (isTrackedPath(pathname)) track('PageView');
  }, [pathname, qs]);

  return null;
}

'use client';
import { useState, type ReactNode } from 'react';
import { Sheet } from '@/components/ui/Sheet';

/** Quiet trigger + sheet for listing filters. Filters are plain links, so state stays in the URL. */
export function FilterSheet({ label, footer, children }: { label: string; footer?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="link-underline min-h-[44px] text-label uppercase" aria-haspopup="dialog">
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filter & sort" footer={footer}>
        {/* Close once a filter link is followed. */}
        <div onClickCapture={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>{children}</div>
      </Sheet>
    </>
  );
}

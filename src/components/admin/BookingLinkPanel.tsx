'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { qrSvg } from '@/lib/qr';

/** A13: shareable /book/{slug} link (optional ?code=) with copy + QR. */
export function BookingLinkPanel({ slug, code }: { slug: string; code?: string }) {
  const [origin, setOrigin] = useState('https://nowhenceclothings.com');
  const [copied, setCopied] = useState(false);
  const [withCode, setWithCode] = useState(Boolean(code));
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/book/${slug}${withCode && code ? `?code=${encodeURIComponent(code)}` : ''}`;
  const svg = useMemo(() => {
    try {
      return qrSvg(url);
    } catch {
      return '';
    }
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const download = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <div className="flex flex-wrap items-start gap-4 border border-line p-3">
      {svg && <div aria-label="QR code for the booking link" role="img" className="h-32 w-32" dangerouslySetInnerHTML={{ __html: svg }} />}
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="font-medium">Booking link</p>
        <p className="break-all font-mono text-xs">{url}</p>
        {code && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={withCode} onChange={(e) => setWithCode(e.target.checked)} />
            Include access code in the link
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {svg && (
            <a href={download} download={`book-${slug}.svg`} className="border border-line px-3 py-1 text-xs">
              Download QR (SVG)
            </a>
          )}
        </div>
        <p className="text-xs text-muted">Works while bookings are open. Save the product first so the link reflects your changes.</p>
      </div>
    </div>
  );
}

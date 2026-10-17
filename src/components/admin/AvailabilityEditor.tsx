'use client';

import { useEffect, useState } from 'react';
import type { Colour } from '@/lib/schemas/catalogue';
import type { MediaRef } from '@/lib/schemas/common';
import type { Availability, BlurredImage, ComingSoonConfig, DepositConfig, PresaleConfig } from '@/lib/schemas/launches';
import { BookingLinkPanel } from './BookingLinkPanel';
import { Button, Input, Select } from '@/components/ui';
import { adminFetch, toPaise, toRupees } from './api-client';
import { mediaPreviewSrc, uploadImage } from './MediaUploader';

const textarea = 'w-full border border-line bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none';

/** Optional boolean: undefined = use the Settings → Launches default. */
function TriState({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void }) {
  return (
    <Select
      label={label}
      value={value === undefined ? '' : value ? 'yes' : 'no'}
      options={[
        { value: '', label: 'Use default' },
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'yes')}
    />
  );
}

const toLocal = (iso: string | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);
const opt = (s: string) => (s.trim() ? s : undefined);
const optInt = (s: string) => {
  const n = Math.trunc(Number(s));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * A10 secrecy: blur in the admin's browser and upload only the blurred copy as
 * a separate media item. Downscale → blur filter → upscale, so even browsers
 * without canvas `filter` support get an unrecoverable image.
 */
export async function makeBlurredFile(media: MediaRef, strength: number): Promise<File> {
  const res = await fetch(mediaPreviewSrc({ ...media, widths: media.widths.length ? [media.widths[media.widths.length - 1]] : [] }));
  if (!res.ok) throw new Error(`Could not load image ${media.id}`);
  const bitmap = await createImageBitmap(await res.blob());
  try {
    const W = Math.min(1200, bitmap.width);
    const H = Math.max(1, Math.round((bitmap.height * W) / bitmap.width));
    const s = Math.max(1, Math.min(100, strength));
    // 1) shrink hard: detail is physically discarded.
    const smallW = Math.max(6, Math.round(W / (2 + s / 2)));
    const smallH = Math.max(6, Math.round((H * smallW) / W));
    const small = document.createElement('canvas');
    small.width = smallW;
    small.height = smallH;
    const sctx = small.getContext('2d')!;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(bitmap, 0, 0, smallW, smallH);
    // 2) scale back up with a blur filter; overdraw the edges to avoid halos.
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d')!;
    const r = Math.max(2, Math.round((W * s) / 1000));
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = `blur(${r}px)`;
    ctx.drawImage(small, -2 * r, -2 * r, W + 4 * r, H + 4 * r);
    const blob = await new Promise<Blob | null>((ok) => out.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Could not encode the blurred image');
    // Neutral name: media ids derive from the file name, and must not point back to the sharp original.
    return new File([blob], 'preview.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}

export interface AvailabilityValue {
  availability?: Availability;
  comingSoon?: ComingSoonConfig;
  presale?: PresaleConfig;
}

export function PresaleFields({ value, onChange }: { value: PresaleConfig; onChange: (next: PresaleConfig) => void }) {
  const set = (patch: Partial<PresaleConfig>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Presale enabled
      </label>
      <Input label="Presale starts" type="datetime-local" value={toLocal(value.startsAt)} onChange={(e) => set({ startsAt: fromLocal(e.target.value) })} />
      <Input
        label="Presale ends"
        hint="Leave blank for open-ended."
        type="datetime-local"
        value={toLocal(value.endsAt)}
        onChange={(e) => set({ endsAt: fromLocal(e.target.value) })}
      />
      <Input
        label="Presale price (₹)"
        hint="Optional. Blank = normal price."
        type="number"
        min={0}
        value={toRupees(value.price)}
        onChange={(e) => set({ price: toPaise(e.target.value) })}
      />
      <Input label="Total presale cap (units)" hint="Blank = unlimited." type="number" min={1} value={value.cap ? String(value.cap) : ''} onChange={(e) => set({ cap: optInt(e.target.value) })} />
      <Input
        label="Per-customer limit"
        hint="Blank = default."
        type="number"
        min={1}
        value={value.perCustomerLimit ? String(value.perCustomerLimit) : ''}
        onChange={(e) => set({ perCustomerLimit: optInt(e.target.value) })}
      />
      <Input label="Estimated ship date" type="date" value={value.shipBy ?? ''} onChange={(e) => set({ shipBy: e.target.value || undefined })} />
      <Input label="Ship copy" hint="Blank = default. {date} = ship date." value={value.shipCopy ?? ''} onChange={(e) => set({ shipCopy: opt(e.target.value) })} />
      <Select
        label="Access"
        value={value.access ?? ''}
        options={[
          { value: '', label: 'Use default' },
          { value: 'public', label: 'Public' },
          { value: 'code', label: 'Access code' },
          { value: 'waitlist', label: 'Waitlist only' },
        ]}
        onChange={(e) => set({ access: (e.target.value || undefined) as PresaleConfig['access'] })}
      />
      {value.access === 'code' && (
        <Input label="Access code" hint="Checked on the server; never sent to the storefront." value={value.accessCode ?? ''} onChange={(e) => set({ accessCode: opt(e.target.value) })} />
      )}
      <Input label='"Pre-order" button label' hint="Blank = default." maxLength={40} value={value.ctaLabel ?? ''} onChange={(e) => set({ ctaLabel: opt(e.target.value) })} />
      <Input label="Badge" hint="Blank = default." maxLength={40} value={value.badge ?? ''} onChange={(e) => set({ badge: opt(e.target.value) })} />
      <TriState label="Switch to available at end" value={value.autoSwitchAtEnd} onChange={(v) => set({ autoSwitchAtEnd: v })} />
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        Terms (blank = default)
        <textarea rows={2} className={textarea} value={value.terms ?? ''} onChange={(e) => set({ terms: opt(e.target.value) })} />
      </label>
      <Select
        label="Payment"
        value={value.paymentMode ?? 'full'}
        options={[
          { value: 'full', label: 'Pay in full at checkout' },
          { value: 'deposit', label: 'Pre-book with a deposit' },
        ]}
        onChange={(e) => set({ paymentMode: e.target.value === 'deposit' ? 'deposit' : undefined })}
      />
      {value.paymentMode === 'deposit' && (
        <div className="md:col-span-2">
          <DepositFields value={value.deposit ?? {}} onChange={(deposit) => set({ deposit })} />
        </div>
      )}
    </div>
  );
}

/** A13 pre-booking settings. Blank = Settings -> Launches default. */
export function DepositFields({ value, onChange }: { value: DepositConfig; onChange: (next: DepositConfig) => void }) {
  const set = (patch: Partial<DepositConfig>) => onChange({ ...value, ...patch });
  const percent = value.depositType === 'percent';
  return (
    <fieldset className="grid gap-4 border border-line bg-paper-deep/30 p-4 md:grid-cols-2">
      <legend className="px-1 text-[11px] font-medium uppercase tracking-label text-muted">Pre-booking (deposit)</legend>
      <Select
        label="Deposit type"
        value={value.depositType ?? ''}
        options={[
          { value: '', label: 'Use default' },
          { value: 'fixed', label: 'Fixed amount (₹)' },
          { value: 'percent', label: 'Percent of price' },
        ]}
        onChange={(e) => set({ depositType: (e.target.value || undefined) as DepositConfig['depositType'] })}
      />
      <Input
        label={percent ? 'Deposit (%)' : 'Deposit (₹)'}
        hint="Blank = default."
        type="number"
        min={1}
        max={percent ? 100 : undefined}
        value={value.depositValue == null ? '' : percent ? String(value.depositValue) : toRupees(value.depositValue)}
        onChange={(e) => set({ depositValue: percent ? optInt(e.target.value) : toPaise(e.target.value) || undefined })}
      />
      <Input
        label="Bookings open"
        hint="Blank = presale start."
        type="datetime-local"
        value={toLocal(value.bookingOpensAt)}
        onChange={(e) => set({ bookingOpensAt: fromLocal(e.target.value) })}
      />
      <Input
        label="Bookings close"
        hint="Blank = presale end / sale start."
        type="datetime-local"
        value={toLocal(value.bookingClosesAt)}
        onChange={(e) => set({ bookingClosesAt: fromLocal(e.target.value) })}
      />
      <Input
        label="Sale starts (balance due)"
        hint="Required to take bookings."
        type="datetime-local"
        value={toLocal(value.saleStartsAt)}
        onChange={(e) => set({ saleStartsAt: fromLocal(e.target.value) })}
      />
      <Input
        label="Balance window (days)"
        hint="Blank = default."
        type="number"
        min={1}
        max={90}
        value={value.balanceWindowDays ? String(value.balanceWindowDays) : ''}
        onChange={(e) => set({ balanceWindowDays: optInt(e.target.value) })}
      />
      <Select
        label="Final price"
        value={value.priceLock ?? ''}
        options={[
          { value: '', label: 'Use default' },
          { value: 'booking', label: 'Locked at booking' },
          { value: 'sale', label: 'Price at sale start' },
        ]}
        onChange={(e) => set({ priceLock: (e.target.value || undefined) as DepositConfig['priceLock'] })}
      />
      <TriState label="Deposit refundable" value={value.depositRefundable} onChange={(v) => set({ depositRefundable: v })} />
      <Select
        label="If the balance is not paid"
        value={value.unpaidOutcome ?? ''}
        options={[
          { value: '', label: 'Use default' },
          { value: 'forfeit', label: 'Keep the deposit' },
          { value: 'refund', label: 'Refund the deposit automatically' },
          { value: 'manual', label: 'Admin decides' },
        ]}
        onChange={(e) => set({ unpaidOutcome: (e.target.value || undefined) as DepositConfig['unpaidOutcome'] })}
      />
      <p className="self-end text-xs text-muted">Cap and per-customer limit above apply to bookings too.</p>
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        Booking policy (Markdown, blank = default)
        <textarea rows={3} maxLength={4000} className={textarea} value={value.policyMarkdown ?? ''} onChange={(e) => set({ policyMarkdown: opt(e.target.value) })} />
      </label>
    </fieldset>
  );
}

/** Product editor "Availability" section (A10/A11). */
export function AvailabilityEditor({
  value,
  colours,
  title,
  slug,
  onChange,
}: {
  value: AvailabilityValue;
  colours: Colour[];
  title: string;
  /** A13: enables the booking link + QR. */
  slug?: string;
  onChange: (next: AvailabilityValue) => void;
}) {
  const cs: ComingSoonConfig = value.comingSoon ?? { revealTo: 'available', blurred: [] };
  const ps: PresaleConfig = value.presale ?? { enabled: false };
  const setCs = (patch: Partial<ComingSoonConfig>) => onChange({ ...value, comingSoon: { ...cs, ...patch } });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const images = colours.flatMap((c) => c.images);
  // WS-G open 4: an unset per-product strength uses the global Settings → Launches default.
  const [globalStrength, setGlobalStrength] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    adminFetch<{ settings: { launches?: { comingSoon?: { blurStrength?: number } } } }>('/api/admin/settings')
      .then((r) => {
        const v = r.settings.launches?.comingSoon?.blurStrength;
        if (live && typeof v === 'number') setGlobalStrength(v);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const strength = cs.blurStrength ?? globalStrength ?? 30;
  const missing = images.filter((m) => !cs.blurred.some((b) => b.sourceId === m.id && b.strength === strength));

  async function generate() {
    setBusy(true);
    setMsg('');
    try {
      const keep = cs.blurred.filter((b) => images.some((m) => m.id === b.sourceId) && b.strength === strength);
      const made: BlurredImage[] = [];
      for (const m of missing) {
        const file = await makeBlurredFile(m, strength);
        const media = await uploadImage(file, `Blurred preview of ${title}`);
        made.push({ sourceId: m.id, strength, media });
      }
      setCs({ blurred: [...keep, ...made] });
      setMsg(`Generated ${made.length} blurred image${made.length === 1 ? '' : 's'}. Save the product to publish them.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Blur failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6 border border-line p-5">
      <h2 className="text-[11px] font-medium uppercase tracking-label">Availability</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Availability"
          value={value.availability ?? 'available'}
          options={[
            { value: 'available', label: 'Available' },
            { value: 'coming_soon', label: 'Coming soon' },
            { value: 'presale', label: 'Presale' },
            { value: 'sold_out', label: 'Sold out' },
          ]}
          onChange={(e) => onChange({ ...value, availability: e.target.value as Availability })}
        />
        <p className="self-end text-xs text-muted">
          Dates switch the state automatically at request time. Blank fields use Settings → Launches.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-[11px] font-medium uppercase tracking-label text-muted">Coming soon</legend>
        <div className="grid gap-4 md:grid-cols-3">
          <TriState label="Blur images" value={cs.blur} onChange={(v) => setCs({ blur: v })} />
          <Input
            label="Blur strength (5-100)"
            hint="Blank = default."
            type="number"
            min={5}
            max={100}
            value={cs.blurStrength != null ? String(cs.blurStrength) : ''}
            onChange={(e) => setCs({ blurStrength: optInt(e.target.value) })}
          />
          <TriState label="Show title" value={cs.showTitle} onChange={(v) => setCs({ showTitle: v })} />
          <TriState label="Show price" value={cs.showPrice} onChange={(v) => setCs({ showPrice: v })} />
          <TriState label="Notify-me signup" value={cs.notify} onChange={(v) => setCs({ notify: v })} />
          <TriState label="Show in shop grid" value={cs.showInShop} onChange={(v) => setCs({ showInShop: v })} />
          <TriState label="Show on home" value={cs.showOnHome} onChange={(v) => setCs({ showOnHome: v })} />
          <TriState label="Show on /coming-soon" value={cs.showOnComingSoonPage} onChange={(v) => setCs({ showOnComingSoonPage: v })} />
          <Input label="Badge" hint="Blank = default." maxLength={40} value={cs.badge ?? ''} onChange={(e) => setCs({ badge: opt(e.target.value) })} />
          <Input
            label="Placeholder title"
            hint="Used when the title is hidden. The slug is public — keep it neutral."
            maxLength={80}
            value={cs.hiddenTitle ?? ''}
            onChange={(e) => setCs({ hiddenTitle: opt(e.target.value) })}
          />
          <Input label="Reveal date" type="datetime-local" value={toLocal(cs.revealAt)} onChange={(e) => setCs({ revealAt: fromLocal(e.target.value) })} />
          <Select
            label="At reveal, switch to"
            value={cs.revealTo}
            options={[
              { value: 'available', label: 'Available' },
              { value: 'presale', label: 'Presale' },
            ]}
            onChange={(e) => setCs({ revealTo: e.target.value as ComingSoonConfig['revealTo'] })}
          />
          <label className="flex flex-col gap-1 text-sm md:col-span-3">
            Teaser text (blank = default)
            <textarea rows={2} maxLength={500} className={textarea} value={cs.teaser ?? ''} onChange={(e) => setCs({ teaser: opt(e.target.value) })} />
          </label>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" loading={busy} disabled={!images.length || !missing.length} onClick={() => void generate()}>
              {missing.length ? `Generate blurred images (${missing.length})` : 'Blurred images up to date'}
            </Button>
            <span className="text-xs text-muted">
              While blurred, the shop only gets these copies. Images without one are not shown. Regenerate after changing images or strength.
            </span>
          </div>
          {msg && <p role="status" className="text-sm">{msg}</p>}
          {cs.blurred.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {cs.blurred.map((b) => (
                <li key={b.media.id} className="w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaPreviewSrc(b.media)} alt="" className="aspect-[4/5] w-full object-cover" />
                  <span className="text-[10px] text-muted">strength {b.strength}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-[11px] font-medium uppercase tracking-label text-muted">Presale</legend>
        <p className="text-xs text-muted">Products in a drop inherit the drop&apos;s presale (Launches page) unless enabled here.</p>
        <PresaleFields value={ps} onChange={(presale) => onChange({ ...value, presale })} />
        {slug && ps.enabled && ps.paymentMode === 'deposit' && (
          <BookingLinkPanel slug={slug} code={ps.access === 'code' ? ps.accessCode : undefined} />
        )}
      </fieldset>
    </section>
  );
}

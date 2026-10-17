'use client';

import { useState, type ReactNode } from 'react';
import type { SettingsDoc } from '@/lib/schemas/settings';
import { BRAND_FONTS, BRAND_FONT_LABELS, brandContrastChecks, emailFromHeader, launchReadiness, type SettingsTab } from '@/lib/brand';
import { Button, Input } from '@/components/ui';
import { adminFetch, toPaise, toRupees } from './api-client';
import { MediaPickerField } from './MediaPicker';
import { LaunchSettingsPanel } from './LaunchSettingsPanel';
import { mediaPreviewSrc } from './MediaUploader';
import { useMsgToast } from './useMsgToast';
import { META_PIXEL_ID_RE } from '@/lib/analytics/meta';
import { INDEXNOW_KEY_RE } from '@/lib/indexnow';
import { usableFavicon } from '@/lib/icons';
import { extractVerificationToken } from '@/lib/seo';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'brand', label: 'Brand' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'returns', label: 'Returns' },
  { id: 'legal', label: 'Legal' },
  { id: 'email', label: 'Email' },
  { id: 'launches', label: 'Launches' },
  { id: 'marketing', label: 'Marketing' },
];

const textarea = 'w-full border border-line bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none';

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 border border-line" aria-label={`${label} picker`} />
      <span className="flex flex-col">
        <span>{label}</span>
        <input
          aria-label={`${label} hex`}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className="w-28 border border-line px-2 py-1 font-mono text-xs"
          maxLength={7}
        />
      </span>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function SettingsForm({
  initial,
  canEdit,
  initialTab = 'brand',
}: {
  initial: SettingsDoc;
  canEdit: boolean;
  initialTab?: SettingsTab;
}) {
  const [s, setS] = useState(initial);
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useMsgToast(msg);
  const [busy, setBusy] = useState(false);
  const sec = <K extends keyof SettingsDoc>(k: K, patch: Partial<SettingsDoc[K]>) =>
    setS((cur) => ({ ...cur, [k]: { ...(cur[k] as object), ...patch } }));
  const colours = (patch: Partial<SettingsDoc['brand']['colours']>) =>
    setS((cur) => ({ ...cur, brand: { ...cur.brand, colours: { ...cur.brand.colours, ...patch } } }));

  const checks = brandContrastChecks(s.brand.colours);
  const pixelOk = !s.analytics.metaPixelId.trim() || META_PIXEL_ID_RE.test(s.analytics.metaPixelId.trim());
  const indexNowOk = !s.seo.indexNowKey.trim() || INDEXNOW_KEY_RE.test(s.seo.indexNowKey.trim());
  const faviconTooSmall = !!s.brand.favicon && !usableFavicon(s.brand.favicon);
  const readiness = launchReadiness(s);
  const missingByTab = (t: SettingsTab) => readiness.filter((r) => r.tab === t && !r.ok).length;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      // F13: `s.updatedAt` is the version this form loaded; the API answers 409
      // (SETTINGS_STALE_MESSAGE) if someone saved since, shown below as the error.
      const { settings } = await adminFetch<{ settings: SettingsDoc }>('/api/admin/settings', {
        method: 'PUT',
        body: { ...s, updatedAt: s.updatedAt },
      });
      setS(settings);
      setMsg({ ok: true, text: 'Saved. The storefront uses it on the next page load.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  const panels: Record<SettingsTab, ReactNode> = {
    launches: <LaunchSettingsPanel value={s.launches} onChange={(launches) => setS((cur) => ({ ...cur, launches }))} />,
    brand: (
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Store name" value={s.store.name} onChange={(e) => sec('store', { name: e.target.value })} />
            <Input
              label="Wordmark text"
              hint="Shown when no logo is uploaded."
              value={s.brand.wordmark}
              maxLength={40}
              onChange={(e) => sec('brand', { wordmark: e.target.value })}
            />
          </div>
          <MediaPickerField
            label="Logo (for light backgrounds)"
            hint="PNG with a transparent background works best. Replaces the wordmark in the header and footer."
            value={s.brand.logoLight}
            disabled={!canEdit}
            onChange={(m) => sec('brand', { logoLight: m })}
          />
          <MediaPickerField
            label="Logo (for dark backgrounds)"
            value={s.brand.logoDark}
            disabled={!canEdit}
            onChange={(m) => sec('brand', { logoDark: m })}
          />
          <MediaPickerField
            label="Favicon / app icon"
            hint="Optional. Leave empty to use the Nowhence symbol. Square, at least 512×512 (never under 48×48). Served at /icon.png."
            value={s.brand.favicon}
            disabled={!canEdit}
            previewClassName="h-12 w-12 object-contain"
            onChange={(m) => sec('brand', { favicon: m })}
          />
          {faviconTooSmall && (
            <p role="alert" className="border border-sale p-3 text-sm text-sale">
              This image is smaller than 48×48, too small for browser tabs and Google results. The storefront shows the Nowhence symbol instead until
              you upload a larger one or remove this.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {(['displayFont', 'bodyFont'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-sm">
                {k === 'displayFont' ? 'Display font (headings, wordmark)' : 'Body font (text, UI)'}
                <select
                  value={s.brand[k]}
                  onChange={(e) => sec('brand', { [k]: e.target.value } as Partial<SettingsDoc['brand']>)}
                  className="border border-line bg-paper px-2 py-2"
                >
                  {BRAND_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {BRAND_FONT_LABELS[f].label} ({BRAND_FONT_LABELS[f].kind})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            <ColourField label="Ink (text)" value={s.brand.colours.ink} onChange={(v) => colours({ ink: v })} />
            <ColourField label="Paper (background)" value={s.brand.colours.paper} onChange={(v) => colours({ paper: v })} />
            <ColourField label="Accent" value={s.brand.colours.accent} onChange={(v) => colours({ accent: v })} />
          </div>
          <ul className="space-y-1 text-sm" aria-label="Contrast checks">
            {checks.map((c) => (
              <li key={c.id} className={c.ok ? '' : 'text-sale'}>
                {c.ok ? '✓' : '✗'} {c.label}: {Number.isFinite(c.ratio) ? `${c.ratio.toFixed(2)}:1` : 'invalid colour'} ({c.grade}, needs {c.min}:1)
              </li>
            ))}
          </ul>
        </div>
        <BrandPreview s={s} />
      </div>
    ),
    shipping: (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Flat fee (₹)" type="number" min={0} value={toRupees(s.shipping.flatFee)} onChange={(e) => sec('shipping', { flatFee: toPaise(e.target.value) ?? 0 })} />
          <Input
            label="Free shipping from (₹)"
            type="number"
            min={0}
            value={toRupees(s.shipping.freeShippingThreshold)}
            onChange={(e) => sec('shipping', { freeShippingThreshold: toPaise(e.target.value) ?? 0 })}
          />
          <Input label="Delivery estimate" hint="e.g. Ships in 2–4 working days" value={s.shipping.eta} onChange={(e) => sec('shipping', { eta: e.target.value })} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="GST rate (%)" type="number" min={0} max={28} value={s.tax.gstRatePercent} onChange={(e) => sec('tax', { gstRatePercent: Number(e.target.value) })} />
          <Input
            label="Payment window (minutes)"
            type="number"
            min={1}
            value={s.orders.paymentWindowMinutes}
            onChange={(e) => sec('orders', { paymentWindowMinutes: Math.trunc(Number(e.target.value)) })}
          />
          <Input
            label="Max units per line"
            type="number"
            min={1}
            value={s.orders.maxQtyPerLine}
            onChange={(e) => sec('orders', { maxQtyPerLine: Math.trunc(Number(e.target.value)) })}
          />
        </div>
      </div>
    ),
    returns: (
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <Toggle label="Returns (refunds) allowed" checked={s.returns.returnsAllowed} onChange={(v) => sec('returns', { returnsAllowed: v })} />
          <Toggle label="Exchanges allowed" checked={s.returns.exchangesAllowed} onChange={(v) => sec('returns', { exchangesAllowed: v })} />
          <Input
            label="Return window (days from delivery)"
            type="number"
            min={0}
            max={365}
            value={s.returns.windowDays}
            onChange={(e) => sec('returns', { windowDays: Math.max(0, Math.trunc(Number(e.target.value))) })}
          />
          <label className="flex flex-col gap-1 text-sm">
            Policy text (markdown: ## headings, - lists, **bold**, [links](/path))
            <textarea rows={14} className={textarea} value={s.returns.policyMarkdown} onChange={(e) => sec('returns', { policyMarkdown: e.target.value })} />
          </label>
        </div>
        <div className="space-y-2 border border-line p-4 text-sm">
          <p className="eyebrow">Preview · /returns</p>
          <p>
            {s.returns.returnsAllowed || s.returns.exchangesAllowed
              ? `You have ${s.returns.windowDays} days from delivery to ask for ${
                  s.returns.returnsAllowed && s.returns.exchangesAllowed ? 'a return or exchange' : s.returns.returnsAllowed ? 'a return' : 'an exchange'
                }.`
              : 'No returns or exchanges, except faulty pieces.'}
          </p>
          <pre className="whitespace-pre-wrap font-sans text-ink-soft">{s.returns.policyMarkdown}</pre>
          <p className="text-xs text-muted">Full page copy is editable in Content → Pages → returns.</p>
        </div>
      </div>
    ),
    legal: (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Legal company name" value={s.legal.legalName} onChange={(e) => sec('legal', { legalName: e.target.value })} />
          <Input
            label="GSTIN"
            hint="15 characters"
            maxLength={15}
            value={s.legal.gstin}
            onChange={(e) => sec('legal', { gstin: e.target.value.toUpperCase() })}
          />
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Registered address
            <textarea rows={3} className={textarea} value={s.legal.registeredAddress} onChange={(e) => sec('legal', { registeredAddress: e.target.value })} />
          </label>
          <Input label="Jurisdiction city (courts)" value={s.legal.jurisdictionCity} onChange={(e) => sec('legal', { jurisdictionCity: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Privacy policy updated" type="date" value={s.legal.privacyUpdatedAt} onChange={(e) => sec('legal', { privacyUpdatedAt: e.target.value })} />
            <Input label="Terms updated" type="date" value={s.legal.termsUpdatedAt} onChange={(e) => sec('legal', { termsUpdatedAt: e.target.value })} />
          </div>
        </div>
        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Public contact</legend>
          <Input label="Contact email" type="email" value={s.store.email} onChange={(e) => sec('store', { email: e.target.value })} />
          <Input label="Phone" value={s.store.phone} onChange={(e) => sec('store', { phone: e.target.value })} />
          <Input label="Studio / contact address" value={s.store.address} onChange={(e) => sec('store', { address: e.target.value })} />
          <Input label="Instagram" value={s.store.instagram} onChange={(e) => sec('store', { instagram: e.target.value })} />
        </fieldset>
      </div>
    ),
    marketing: (
      <div className="max-w-2xl space-y-4">
        <Input
          label="Meta Pixel ID"
          hint="Digits only, from Meta Events Manager. Leave empty to turn the pixel off."
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          value={s.analytics.metaPixelId}
          error={pixelOk ? undefined : 'Use the numeric pixel ID, e.g. 1574364723928175.'}
          onChange={(e) => sec('analytics', { metaPixelId: e.target.value.replace(/\s+/g, '') })}
        />
        <p className="border border-line p-3 text-sm">
          {s.analytics.metaPixelId.trim() ? (
            <>
              Pixel <b className="font-mono">{s.analytics.metaPixelId.trim()}</b> loads on every storefront page (never in the studio) and sends
              PageView, ViewContent, AddToCart, InitiateCheckout and Purchase (INR).
            </>
          ) : (
            'Meta Pixel is off. No Meta script loads on the storefront.'
          )}
        </p>
        <p className="text-xs text-muted">Coming-soon pieces with a hidden title or price are never sent to Meta.</p>
        <fieldset className="space-y-4 border-t border-line pt-6">
          <legend className="mb-2 text-sm font-medium">Search engines</legend>
          <Input
            label="Google Search Console verification"
            hint={'Search Console → Settings → Ownership verification → HTML tag. Paste the whole tag or just the content="…" value.'}
            autoComplete="off"
            maxLength={400}
            value={s.seo.googleSiteVerification}
            onChange={(e) => sec('seo', { googleSiteVerification: extractVerificationToken(e.target.value) })}
          />
          <Input
            label="Bing Webmaster verification"
            hint="Optional. Bing Webmaster Tools → HTML meta tag (msvalidate.01)."
            autoComplete="off"
            maxLength={400}
            value={s.seo.bingSiteVerification}
            onChange={(e) => sec('seo', { bingSiteVerification: extractVerificationToken(e.target.value) })}
          />
          <Input
            label="IndexNow key"
            hint="Optional. 8 to 128 letters, digits or dashes. Served at /{key}.txt; changed pages are sent to Bing and others when you publish. The INDEXNOW_KEY secret overrides this."
            autoComplete="off"
            maxLength={128}
            value={s.seo.indexNowKey}
            error={indexNowOk ? undefined : 'Use 8 to 128 letters, digits or dashes.'}
            onChange={(e) => sec('seo', { indexNowKey: e.target.value.replace(/\s+/g, '') })}
          />
          <p className="text-xs text-muted">Sitemap: https://nowhenceclothings.com/sitemap.xml. Pieces that are coming soon are never listed or submitted.</p>
        </fieldset>
      </div>
    ),
    email: (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Sender name" hint="e.g. Nowhence" value={s.email.senderName} onChange={(e) => sec('email', { senderName: e.target.value })} />
          <Input label="From address" hint="Must be on a domain verified with the email provider" value={s.email.from} onChange={(e) => sec('email', { from: e.target.value })} />
          <Input label="Reply-to" type="email" value={s.email.replyTo} onChange={(e) => sec('email', { replyTo: e.target.value })} />
        </div>
        <p className="border border-line p-3 text-sm">
          Customers see: <b>{emailFromHeader(s.email)}</b>
          {s.email.replyTo && <> · replies go to {s.email.replyTo}</>}
        </p>
      </div>
    ),
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const n = missingByTab(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t.id ? 'border-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {t.label}
              {n > 0 && <span className="ml-1 text-xs text-sale" aria-label={`${n} missing`}>({n})</span>}
            </button>
          );
        })}
      </div>
      <fieldset disabled={!canEdit} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {panels[tab]}
      </fieldset>
      {canEdit ? (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-paper py-3">
          <Button type="submit" loading={busy} disabled={checks.some((c) => !c.ok) || !pixelOk}>
            Save settings
          </Button>
          {checks.some((c) => !c.ok) && <span className="text-sm text-sale">Fix colour contrast to save.</span>}
          {!pixelOk && <span className="text-sm text-sale">Fix the Meta Pixel ID (Marketing) to save.</span>}
          {msg && (
            <span role="status" className={msg.ok ? 'text-sm' : 'text-sm text-sale'}>
              {msg.text}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Only the owner can change settings.</p>
      )}
    </form>
  );
}

/** Live preview of brand choices, scoped with inline CSS variables. */
function BrandPreview({ s }: { s: SettingsDoc }) {
  const { ink, paper, accent } = s.brand.colours;
  const display = `var(--font-${s.brand.displayFont}), Georgia, serif`;
  const body = `var(--font-${s.brand.bodyFont}), system-ui, sans-serif`;
  return (
    <aside aria-label="Brand preview" className="self-start border border-line">
      <p className="border-b border-line px-3 py-1 text-xs text-muted">Preview</p>
      <div style={{ background: paper, color: ink, fontFamily: body }} className="space-y-4 p-5">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: `${ink}22` }}>
          <span className="text-[10px] uppercase tracking-[0.14em]">Shop</span>
          {s.brand.logoLight ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaPreviewSrc(s.brand.logoLight)} alt="" className="h-6 w-auto" />
          ) : (
            <span style={{ fontFamily: display }} className="text-lg tracking-[0.18em]">
              {s.brand.wordmark || 'NOWHENCE'}
            </span>
          )}
          <span className="text-[10px]">Bag</span>
        </div>
        <h3 style={{ fontFamily: display }} className="text-3xl leading-tight">
          Made to outlast the season
        </h3>
        <p className="text-sm leading-relaxed">Heavyweight cotton, cut on one block and graded XS to XXL.</p>
        <span className="inline-block px-4 py-2 text-xs uppercase tracking-[0.14em]" style={{ background: ink, color: paper }}>
          Add to bag
        </span>{' '}
        <span className="text-sm underline" style={{ color: accent }}>
          Size guide
        </span>
      </div>
      {s.brand.logoDark && (
        <div style={{ background: ink }} className="p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaPreviewSrc(s.brand.logoDark)} alt="" className="h-6 w-auto" />
        </div>
      )}
    </aside>
  );
}

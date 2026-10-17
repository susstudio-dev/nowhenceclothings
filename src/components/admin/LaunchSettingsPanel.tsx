'use client';

import type { LaunchDefaults } from '@/lib/schemas/launches';
import { Input, Select } from '@/components/ui';

const textarea = 'w-full border border-line bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none';

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Settings → Launches (A10/A11 global defaults). Products override any of these in their Availability section. */
export function LaunchSettingsPanel({ value, onChange }: { value: LaunchDefaults; onChange: (next: LaunchDefaults) => void }) {
  const cs = value.comingSoon;
  const ps = value.presale;
  const setCs = (patch: Partial<LaunchDefaults['comingSoon']>) => onChange({ ...value, comingSoon: { ...cs, ...patch } });
  const setPs = (patch: Partial<LaunchDefaults['presale']>) => onChange({ ...value, presale: { ...ps, ...patch } });
  const dep = ps.deposit;
  const setDep = (patch: Partial<LaunchDefaults['presale']['deposit']>) => setPs({ deposit: { ...dep, ...patch } });
  const setPage = (patch: Partial<LaunchDefaults['page']>) => onChange({ ...value, page: { ...value.page, ...patch } });
  const setHome = (patch: Partial<LaunchDefaults['home']>) => onChange({ ...value, home: { ...value.home, ...patch } });

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Coming soon defaults</h2>
        <p className="text-sm text-muted">Used by every coming-soon product unless the product sets its own value.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Check
            label="Blur images"
            hint="The storefront only ever receives the pre-blurred copy, never the sharp photo."
            checked={cs.blur}
            onChange={(v) => setCs({ blur: v })}
          />
          <label className="flex flex-col gap-1 text-sm">
            Blur strength ({cs.blurStrength})
            <input type="range" min={5} max={100} value={cs.blurStrength} onChange={(e) => setCs({ blurStrength: Number(e.target.value) })} />
          </label>
          <Check label="Show title" checked={cs.showTitle} onChange={(v) => setCs({ showTitle: v })} />
          <Check label="Show price" checked={cs.showPrice} onChange={(v) => setCs({ showPrice: v })} />
          <Input label="Badge text" maxLength={40} value={cs.badge} onChange={(e) => setCs({ badge: e.target.value })} />
          <Input
            label="Placeholder title"
            hint="Shown instead of the real title when the title is hidden."
            maxLength={80}
            value={cs.hiddenTitle}
            onChange={(e) => setCs({ hiddenTitle: e.target.value })}
          />
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Teaser text
            <textarea rows={2} maxLength={500} className={textarea} value={cs.teaser} onChange={(e) => setCs({ teaser: e.target.value })} />
          </label>
          <Check label="Notify-me signup" checked={cs.notify} onChange={(v) => setCs({ notify: v })} />
          <Check label="Show in shop grids" checked={cs.showInShop} onChange={(v) => setCs({ showInShop: v })} />
          <Check label='Show in home "Coming soon" section' checked={cs.showOnHome} onChange={(v) => setCs({ showOnHome: v })} />
          <Check label="Show on /coming-soon" checked={cs.showOnComingSoonPage} onChange={(v) => setCs({ showOnComingSoonPage: v })} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Presale defaults</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Per-customer limit (units)"
            type="number"
            min={1}
            value={String(ps.perCustomerLimit)}
            onChange={(e) => setPs({ perCustomerLimit: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })}
          />
          <Select
            label="Access"
            value={ps.access}
            options={[
              { value: 'public', label: 'Public' },
              { value: 'code', label: 'Access code' },
              { value: 'waitlist', label: 'Waitlist only (email on notify list)' },
            ]}
            onChange={(e) => setPs({ access: e.target.value as LaunchDefaults['presale']['access'] })}
          />
          <Input label='"Pre-order" button label' maxLength={40} value={ps.ctaLabel} onChange={(e) => setPs({ ctaLabel: e.target.value })} />
          <Input label="Badge text" maxLength={40} value={ps.badge} onChange={(e) => setPs({ badge: e.target.value })} />
          <Input
            label="Ship-by copy"
            hint="{date} is replaced by the product's estimated ship date."
            maxLength={300}
            value={ps.shipCopy}
            onChange={(e) => setPs({ shipCopy: e.target.value })}
          />
          <Check label="Switch to available when the presale ends" checked={ps.autoSwitchAtEnd} onChange={(v) => setPs({ autoSwitchAtEnd: v })} />
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Terms
            <textarea rows={3} maxLength={4000} className={textarea} value={ps.terms} onChange={(e) => setPs({ terms: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Pre-booking (deposit) defaults</h2>
        <p className="text-sm text-muted">Used when a product or drop presale is set to &quot;Pre-book with a deposit&quot; and leaves a field blank.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Deposit type"
            value={dep.depositType}
            options={[
              { value: 'fixed', label: 'Fixed amount (₹)' },
              { value: 'percent', label: 'Percent of price' },
            ]}
            onChange={(e) => setDep({ depositType: e.target.value as typeof dep.depositType })}
          />
          <Input
            label={dep.depositType === 'percent' ? 'Deposit (%)' : 'Deposit (₹)'}
            type="number"
            min={1}
            value={dep.depositType === 'percent' ? String(dep.depositValue) : String(dep.depositValue / 100)}
            onChange={(e) => {
              const n = Number(e.target.value) || 0;
              const v = dep.depositType === 'percent' ? Math.min(100, Math.max(1, Math.trunc(n))) : Math.max(1, Math.round(n * 100));
              setDep({ depositValue: v });
            }}
          />
          <Input
            label="Balance window (days after sale start)"
            type="number"
            min={1}
            max={90}
            value={String(dep.balanceWindowDays)}
            onChange={(e) => setDep({ balanceWindowDays: Math.min(90, Math.max(1, Math.trunc(Number(e.target.value) || 1))) })}
          />
          <Select
            label="Final price"
            value={dep.priceLock}
            options={[
              { value: 'booking', label: 'Locked at booking' },
              { value: 'sale', label: 'Price at sale start' },
            ]}
            onChange={(e) => setDep({ priceLock: e.target.value as typeof dep.priceLock })}
          />
          <Select
            label="If the balance is not paid"
            value={dep.unpaidOutcome}
            options={[
              { value: 'forfeit', label: 'Keep the deposit' },
              { value: 'refund', label: 'Refund the deposit automatically' },
              { value: 'manual', label: 'Admin decides' },
            ]}
            onChange={(e) => setDep({ unpaidOutcome: e.target.value as typeof dep.unpaidOutcome })}
          />
          <Input label="Booking button label" maxLength={40} value={dep.bookCtaLabel} onChange={(e) => setDep({ bookCtaLabel: e.target.value })} />
          <Check label="Deposit refundable" checked={dep.depositRefundable} onChange={(v) => setDep({ depositRefundable: v })} />
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Booking policy (Markdown)
            <textarea rows={3} maxLength={4000} className={textarea} value={dep.policyMarkdown} onChange={(e) => setDep({ policyMarkdown: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Storefront</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Check label='Home "Coming soon" section' checked={value.home.enabled} onChange={(v) => setHome({ enabled: v })} />
          <Input label="Home section heading" maxLength={80} value={value.home.heading} onChange={(e) => setHome({ heading: e.target.value })} />
          <Input
            label="Home section: max pieces"
            type="number"
            min={1}
            max={12}
            value={String(value.home.limit)}
            onChange={(e) => setHome({ limit: Math.min(12, Math.max(1, Math.trunc(Number(e.target.value) || 1))) })}
          />
          <Input label="/coming-soon title" maxLength={80} value={value.page.title} onChange={(e) => setPage({ title: e.target.value })} />
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            /coming-soon intro
            <textarea rows={2} maxLength={1000} className={textarea} value={value.page.intro} onChange={(e) => setPage({ intro: e.target.value })} />
          </label>
        </div>
      </section>
    </div>
  );
}

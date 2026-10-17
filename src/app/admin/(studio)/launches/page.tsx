import Link from 'next/link';
import { requireCapability } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { presaleUnits, resolveLaunch } from '@/lib/launches';
import { readPresaleLedger, readProductNotifyList } from '@/lib/launches-server';
import { LaunchRowActions, DropPresaleEditor } from '@/components/admin/LaunchesAdmin';

export const metadata = { title: 'Launches' };
export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = { available: 'Available', coming_soon: 'Coming soon', presale: 'Presale', sold_out: 'Sold out' };

/** A10/A11 overview: live state, notify lists (CSV, email), presale units, drop presales. */
export default async function LaunchesPage() {
  await requireCapability('catalogue.write');
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const now = new Date();
  const rows = await Promise.all(
    cat.products
      .filter((p) => p.status !== 'archived')
      .map(async (p) => {
        const r = resolveLaunch(p, cat.drops, settings.launches, now);
        const [subs, ledger] = await Promise.all([readProductNotifyList(p.id), r.presale ? readPresaleLedger(p.id) : null]);
        return { p, r, subs: subs.length, pending: subs.filter((s) => !s.notifiedAt).length, sold: presaleUnits(ledger) };
      }),
  );
  const shown = rows.filter((x) => x.r.state !== 'available' || x.subs > 0 || x.p.availability);
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Launches</h1>
        <p className="text-sm text-muted">
          Coming-soon and presale pieces. Defaults live in{' '}
          <Link className="underline" href="/admin/settings?tab=launches">
            Settings → Launches
          </Link>
          ; per-product options in each product&apos;s Availability section.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-2">Product</th>
              <th>State now</th>
              <th>Next change</th>
              <th>Presale units</th>
              <th>Notify list</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ p, r, subs, pending, sold }) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="py-2">
                  <Link className="underline" href={`/admin/products/${encodeURIComponent(p.id)}`}>
                    {p.title}
                  </Link>
                  {p.status !== 'active' && <span className="ml-2 text-xs text-muted">({p.status})</span>}
                </td>
                <td>{LABEL[r.state]}</td>
                <td>{r.nextChangeAt ? new Date(r.nextChangeAt).toLocaleString('en-IN') : '—'}</td>
                <td>{r.presale ? `${sold}${r.presale.cap ? ` / ${r.presale.cap}` : ''}` : '—'}</td>
                <td>
                  {subs} ({pending} not yet emailed)
                </td>
                <td>
                  <LaunchRowActions productId={p.id} canEmail={r.state === 'presale' || r.state === 'available'} pending={pending} />
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="py-6 text-muted">
                  No coming-soon or presale pieces yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <section className="space-y-4">
        <h2 className="text-xl">Drop presales</h2>
        {cat.drops.length ? (
          cat.drops.map((d) => <DropPresaleEditor key={d.id} dropId={d.id} name={d.name} initial={d.presale ?? { enabled: false }} />)
        ) : (
          <p className="text-sm text-muted">No drops.</p>
        )}
      </section>
    </div>
  );
}

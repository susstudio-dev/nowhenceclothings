import Link from 'next/link';
import { requireCapability } from '@/lib/guard';
import { getCatalogue } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { presaleUnits, resolveLaunch } from '@/lib/launches';
import { readPresaleLedger, readProductNotifyList } from '@/lib/launches-server';
import { LaunchRowActions, DropPresaleEditor } from '@/components/admin/LaunchesAdmin';
import { PageHeader, EmptyState, Table, th, td, tr, Chip } from '@/components/admin/kit';

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
      <PageHeader
        title="Launches"
        description={<>
          Coming-soon and presale pieces. Defaults live in{' '}
          <Link className="underline" href="/admin/settings?tab=launches">
            Settings → Launches
          </Link>
          ; per-product options in each product&apos;s Availability section.</>}
      />
      <Table>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>State now</th>
              <th className={th}>Next change</th>
              <th className={th}>Presale units</th>
              <th className={th}>Notify list</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ p, r, subs, pending, sold }) => (
              <tr key={p.id} className={tr}>
                <td className={td}>
                  <Link className="font-medium hover:underline" href={`/admin/products/${encodeURIComponent(p.id)}`}>
                    {p.title}
                  </Link>
                  {p.status !== 'active' && <span className="ml-2 text-xs text-muted">({p.status})</span>}
                </td>
                <td className={td}><Chip tone={r.state === 'presale' ? 'clay' : r.state === 'coming_soon' ? 'ink' : r.state === 'sold_out' ? 'muted' : 'success'}>{LABEL[r.state]}</Chip></td>
                <td className={`${td} text-muted`}>{r.nextChangeAt ? new Date(r.nextChangeAt).toLocaleString('en-IN') : '—'}</td>
                <td className={`${td} tabular-nums`}>{r.presale ? `${sold}${r.presale.cap ? ` / ${r.presale.cap}` : ''}` : '—'}</td>
                <td className={`${td} tabular-nums`}>
                  {subs} <span className="text-xs text-muted">({pending} not yet emailed)</span>
                </td>
                <td className={td}>
                  <LaunchRowActions productId={p.id} canEmail={r.state === 'presale' || r.state === 'available'} pending={pending} />
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No coming-soon or presale pieces yet.
                </td>
              </tr>
            )}
          </tbody>
      </Table>
      <section className="space-y-4">
        <h2 className="text-[11px] font-medium uppercase tracking-label">Drop presales</h2>
        {cat.drops.length ? (
          cat.drops.map((d) => <DropPresaleEditor key={d.id} dropId={d.id} name={d.name} initial={d.presale ?? { enabled: false }} />)
        ) : (
          <EmptyState title="No drops yet">Create a drop in the catalogue to run a presale across several pieces.</EmptyState>
        )}
      </section>
    </div>
  );
}

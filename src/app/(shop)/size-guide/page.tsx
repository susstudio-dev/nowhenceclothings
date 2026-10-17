import { getCatalogue } from '@/lib/catalogue';
import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('size-guide');
}

const toInches = (cm: number) => (cm / 2.54).toFixed(1);

export default async function Page() {
  const [{ page, vars }, catalogue] = await Promise.all([loadStaticPage('size-guide'), getCatalogue()]);
  return (
    <StaticPageView slug="size-guide" page={page} vars={vars}>
      {catalogue.sizeCharts.map((chart) => (
        <section key={chart.id} className="mt-12">
          <h2 className="mb-4 text-sm uppercase tracking-widest">{chart.name}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm tabular-nums">
              <caption className="sr-only">{chart.name} garment measurements in centimetres and inches</caption>
              <thead>
                <tr className="border-b border-current/20">
                  <th scope="col" className="py-2 pr-4 font-medium">Size</th>
                  {chart.measurements.map((m) => (
                    <th key={m} scope="col" className="py-2 pr-4 font-medium capitalize">{m} cm / in</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => (
                  <tr key={row.size} className="border-b border-current/10">
                    <th scope="row" className="py-2 pr-4 font-medium">{row.size}</th>
                    {chart.measurements.map((m) => {
                      const v = row.values[m];
                      return (
                        <td key={m} className="py-2 pr-4">
                          {v === undefined ? '—' : `${v} / ${toInches(v)}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart.modelNote && <p className="mt-3 text-sm opacity-70">{chart.modelNote}</p>}
        </section>
      ))}
    </StaticPageView>
  );
}

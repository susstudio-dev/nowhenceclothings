import { getCatalogue } from '@/lib/catalogue';
import { SizeChartNotes, SizeChartTable } from '@/components/shop/SizeGuide';
import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('size-guide');
}

export default async function Page() {
  const [{ page, vars }, catalogue] = await Promise.all([loadStaticPage('size-guide'), getCatalogue()]);
  return (
    <StaticPageView slug="size-guide" page={page} vars={vars}>
      {catalogue.sizeCharts.map((chart) => (
        <section key={chart.id} className="mt-12">
          <h2 className="mb-4 text-sm uppercase tracking-widest">{chart.name}</h2>
          <SizeChartTable chart={chart} />
          <SizeChartNotes chart={chart} className="mt-10" />
        </section>
      ))}
    </StaticPageView>
  );
}

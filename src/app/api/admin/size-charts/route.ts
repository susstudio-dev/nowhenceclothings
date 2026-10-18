import { writeJsonCas } from '@/lib/storage';
import { CATALOGUE_KEY, CatalogueDoc } from '@/lib/schemas/catalogue';
import { adminRoute, json, readBody } from '@/lib/admin/api';
import { SizeChartInput } from '@/lib/admin/inputs';
import { upsertSizeChart } from '@/lib/admin/catalogue-mutations';
import { purgeEdge } from '@/lib/edge-purge';

export const dynamic = 'force-dynamic';

/** Create or update one size chart (matched by id). */
export async function PUT(req: Request) {
  return adminRoute({ cap: 'catalogue.write' }, async ({ log }) => {
    const { chart } = await readBody(req, SizeChartInput);
    const doc = await writeJsonCas(CATALOGUE_KEY, CatalogueDoc, (cur) => upsertSizeChart(cur ?? CatalogueDoc.parse({}), chart));
    await log('size_chart_save', `catalogue.json#sizeChart:${chart.id}`, chart.name);
    const slugs = doc.products.filter((p) => p.sizeChartId === chart.id).map((p) => p.slug);
    await purgeEdge({ productSlugs: slugs, extra: ['/size-guide'] });
    return json({ chart });
  });
}

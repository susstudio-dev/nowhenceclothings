import { writeJsonCas } from '@/lib/storage';
import { CATALOGUE_KEY, CatalogueDoc } from '@/lib/schemas/catalogue';
import { adminRoute, json } from '@/lib/admin/api';
import { removeSizeChart } from '@/lib/admin/catalogue-mutations';
import { purgeEdge } from '@/lib/edge-purge';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Refused (400) while any product still uses the chart. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ cap: 'catalogue.write' }, async ({ log }) => {
    await writeJsonCas(CATALOGUE_KEY, CatalogueDoc, (cur) => removeSizeChart(cur ?? CatalogueDoc.parse({}), id));
    await log('size_chart_delete', `catalogue.json#sizeChart:${id}`);
    await purgeEdge({ extra: ['/size-guide'] });
    return json({ ok: true });
  });
}

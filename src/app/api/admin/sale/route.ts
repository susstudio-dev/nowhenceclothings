import { writeJsonCas } from '@/lib/storage';
import { CATALOGUE_KEY, CatalogueDoc } from '@/lib/schemas/catalogue';
import { adminRoute, json, readBody } from '@/lib/admin/api';
import { SaleInput } from '@/lib/admin/inputs';
import { applySale } from '@/lib/admin/catalogue-mutations';

export const dynamic = 'force-dynamic';

/** A5 sale pricing: percentOff 0 ends the sale for the selected products. */
export async function POST(req: Request) {
  return adminRoute({ role: 'manager', cap: 'coupons.write' }, async ({ log }) => {
    const body = await readBody(req, SaleInput);
    const sale = body.percentOff > 0 ? { percentOff: body.percentOff, saleEndsAt: body.saleEndsAt } : null;
    await writeJsonCas(CATALOGUE_KEY, CatalogueDoc, (cur) =>
      applySale(cur ?? CatalogueDoc.parse({}), body.productIds, sale),
    );
    await log(sale ? 'sale_start' : 'sale_end', 'catalogue.json', `${body.productIds.length} products, ${body.percentOff}%`);
    return json({ ok: true });
  });
}

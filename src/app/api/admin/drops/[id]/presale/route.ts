import { writeJsonCas } from '@/lib/storage';
import { CATALOGUE_KEY, CatalogueDoc } from '@/lib/schemas/catalogue';
import { PresaleConfig } from '@/lib/schemas/launches';
import { adminRoute, HttpError, json, readBody } from '@/lib/admin/api';
import { getCatalogue } from '@/lib/catalogue';
import { reapplyAfterCatalogueChange } from '@/lib/bookings-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** A11 drop-level presale. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ cap: 'catalogue.write' }, async ({ admin, log }) => {
    const presale = await readBody(req, PresaleConfig);
    const before = await getCatalogue();
    const after = await writeJsonCas(CATALOGUE_KEY, CatalogueDoc, (cur) => {
      const cat = cur ?? CatalogueDoc.parse({});
      if (!cat.drops.some((d) => d.id === id)) throw new HttpError(404, 'Unknown drop');
      return { ...cat, drops: cat.drops.map((d) => (d.id === id ? { ...d, presale } : d)) };
    });
    await log('drop_presale', `catalogue.json#drop:${id}`, presale.enabled ? 'enabled' : 'disabled');
    // F23: open bookings of this drop's products follow a moved sale date.
    const bookings = await reapplyAfterCatalogueChange(before, after, admin.email);
    if (bookings.moved.length) {
      await log('bookings_sale_date_moved', `catalogue.json#drop:${id}`, `${bookings.moved.length} moved, ${bookings.emailed.length} emailed: ${bookings.moved.join(' ')}`.slice(0, 500));
    }
    return json({ ok: true, presale, bookings });
  });
}

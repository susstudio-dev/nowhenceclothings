import { writeJsonCas } from '@/lib/storage';
import { CATALOGUE_KEY, CatalogueDoc } from '@/lib/schemas/catalogue';
import { adminRoute, HttpError, json, readBody } from '@/lib/admin/api';
import { ProductBody, ProductStatusInput } from '@/lib/admin/inputs';
import { saveProduct } from '@/lib/admin/products';
import { setProductStatus } from '@/lib/admin/catalogue-mutations';
import { purgeEdge } from '@/lib/edge-purge';
import { notifyProductsChanged } from '@/lib/indexnow-server';
import { getCatalogue } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { bookingsToMove, reapplyAfterCatalogueChange } from '@/lib/bookings-server';
import { saleTermsFor } from '@/lib/bookings';
import type { Product } from '@/lib/schemas/catalogue';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ cap: 'catalogue.write' }, async ({ admin, log }) => {
    const body = await readBody(req, ProductBody);
    if (body.id !== id) throw new HttpError(400, 'Product id does not match the URL');
    const before = await getCatalogue();
    const product = await saveProduct(body, 'update');
    await log('product_update', `catalogue.json#product:${id}`, product.title);
    // F23: open bookings follow a moved sale date.
    const bookings = await reapplyAfterCatalogueChange(before, await getCatalogue(), admin.email);
    if (bookings.moved.length) {
      await log('bookings_sale_date_moved', `catalogue.json#product:${id}`, `${bookings.moved.length} moved, ${bookings.emailed.length} emailed: ${bookings.moved.join(' ')}`.slice(0, 500));
    }
    await purgeEdge({ productSlugs: [product.slug] });
    await notifyProductsChanged([id]);
    return json({ product, bookings });
  });
}

/**
 * F23 preview: POST the edited product (not saved) and get how many open
 * bookings would move to its sale date.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ cap: 'catalogue.write' }, async () => {
    const body = await readBody(req, ProductBody);
    if (body.id !== id) throw new HttpError(400, 'Product id does not match the URL');
    const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
    const terms = saleTermsFor(body as Product, cat.drops, settings.launches);
    const list = terms ? await bookingsToMove([id], terms) : [];
    return json({ count: list.length, saleStartsAt: terms?.saleStartsAt ?? null });
  });
}

/** Status only: publish (active), unpublish (draft) or archive. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ cap: 'catalogue.write' }, async ({ log }) => {
    const { status } = await readBody(req, ProductStatusInput);
    await writeJsonCas(CATALOGUE_KEY, CatalogueDoc, (cur) => setProductStatus(cur ?? CatalogueDoc.parse({}), id, status));
    await log('product_status', `catalogue.json#product:${id}`, status);
    await purgeEdge();
    await notifyProductsChanged([id]);
    return json({ ok: true, status });
  });
}

/** DELETE archives (orders keep referencing the product, so nothing is destroyed). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ cap: 'catalogue.write' }, async ({ log }) => {
    await writeJsonCas(CATALOGUE_KEY, CatalogueDoc, (cur) =>
      setProductStatus(cur ?? CatalogueDoc.parse({}), id, 'archived'),
    );
    await log('product_archive', `catalogue.json#product:${id}`);
    await purgeEdge();
    return json({ ok: true, status: 'archived' });
  });
}

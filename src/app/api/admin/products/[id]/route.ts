import { writeJsonCas } from '@/lib/storage';
import { CATALOGUE_KEY, CatalogueDoc } from '@/lib/schemas/catalogue';
import { adminRoute, HttpError, json, readBody } from '@/lib/admin/api';
import { ProductBody, ProductStatusInput } from '@/lib/admin/inputs';
import { saveProduct } from '@/lib/admin/products';
import { setProductStatus } from '@/lib/admin/catalogue-mutations';
import { purgeEdge } from '@/lib/edge-purge';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ cap: 'catalogue.write' }, async ({ log }) => {
    const body = await readBody(req, ProductBody);
    if (body.id !== id) throw new HttpError(400, 'Product id does not match the URL');
    const product = await saveProduct(body, 'update');
    await log('product_update', `catalogue.json#product:${id}`, product.title);
    await purgeEdge({ productSlugs: [product.slug] });
    return json({ product });
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

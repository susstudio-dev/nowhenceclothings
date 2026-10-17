import { adminRoute, json, readBody } from '@/lib/admin/api';
import { ProductBody } from '@/lib/admin/inputs';
import { saveProduct } from '@/lib/admin/products';
import { getCatalogue } from '@/lib/catalogue';

export const dynamic = 'force-dynamic';

export async function GET() {
  return adminRoute({}, async () => json({ catalogue: await getCatalogue() }));
}

export async function POST(req: Request) {
  return adminRoute({ cap: 'catalogue.write' }, async ({ log }) => {
    const body = await readBody(req, ProductBody);
    const product = await saveProduct(body, 'create');
    await log('product_create', `catalogue.json#product:${product.id}`, product.title);
    return json({ product }, 201);
  });
}

import { writeJsonCas } from '@/lib/storage';
import { COUPONS_KEY, CouponsDoc } from '@/lib/schemas/coupons';
import { adminRoute, json } from '@/lib/admin/api';
import { removeCoupon } from '@/lib/admin/catalogue-mutations';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'coupons.write' }, async ({ log }) => {
    const doc = await writeJsonCas(COUPONS_KEY, CouponsDoc, (cur) => removeCoupon(cur ?? { coupons: [] }, id));
    await log('coupon_delete', `coupons.json#${id}`);
    return json({ coupons: doc.coupons });
  });
}

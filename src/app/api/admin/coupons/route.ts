import { readJson, writeJsonCas } from '@/lib/storage';
import { COUPONS_KEY, CouponsDoc } from '@/lib/schemas/coupons';
import { adminRoute, json, readBody } from '@/lib/admin/api';
import { CouponInput } from '@/lib/admin/inputs';
import { upsertCoupon } from '@/lib/admin/catalogue-mutations';

export const dynamic = 'force-dynamic';

export async function GET() {
  return adminRoute({ role: 'manager', cap: 'coupons.write' }, async () =>
    json({ coupons: (await readJson(COUPONS_KEY, CouponsDoc))?.coupons ?? [] }),
  );
}

/** Create or update one coupon (matched by id). */
export async function PUT(req: Request) {
  return adminRoute({ role: 'manager', cap: 'coupons.write' }, async ({ log }) => {
    const { coupon } = await readBody(req, CouponInput);
    const doc = await writeJsonCas(COUPONS_KEY, CouponsDoc, (cur) => upsertCoupon(cur ?? { coupons: [] }, coupon), {
      initial: () => ({ coupons: [] }),
    });
    await log('coupon_save', `coupons.json#${coupon.id}`, `${coupon.code} ${coupon.type}`);
    return json({ coupons: doc.coupons });
  });
}

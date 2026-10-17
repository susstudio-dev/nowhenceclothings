import { z } from 'zod';
import { adminRoute, HttpError, json, readBody } from '@/lib/admin/api';
import { emailNotifyList, LaunchEmailError } from '@/lib/launches-admin';

export const dynamic = 'force-dynamic';

const Body = z.object({ productId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) });

/** A11: email the notify list (Resend). Idempotent per launch. */
export async function POST(req: Request) {
  return adminRoute({ role: 'manager', cap: 'catalogue.write' }, async ({ admin, log }) => {
    const { productId } = await readBody(req, Body);
    try {
      const res = await emailNotifyList(productId, admin.email);
      await log('notify_email', `notify/product-${productId}.json`, `${res.key} sent=${res.sent} failed=${res.failed}`);
      return json(res);
    } catch (err) {
      if (err instanceof LaunchEmailError) throw new HttpError(err.status, err.message);
      throw err;
    }
  });
}

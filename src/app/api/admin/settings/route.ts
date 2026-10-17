import { writeJsonCas } from '@/lib/storage';
import { getSettings } from '@/lib/content';
import { SETTINGS_KEY, SETTINGS_STALE_MESSAGE, SettingsDoc, isStaleSettingsWrite } from '@/lib/schemas/settings';
import { adminRoute, HttpError, json, readBody } from '@/lib/admin/api';
import { brandContrastChecks } from '@/lib/brand';
import { purgeEdge } from '@/lib/edge-purge';

export const dynamic = 'force-dynamic';

export async function GET() {
  return adminRoute({ role: 'manager' }, async () => json({ settings: await getSettings() }));
}

/** A5 settings (owner only: shipping fees and tax change what customers pay). */
export async function PUT(req: Request) {
  return adminRoute({ role: 'owner', cap: 'settings.write' }, async ({ log }) => {
    const next = await readBody(req, SettingsDoc);
    // A9b: never publish an unreadable palette.
    const failed = brandContrastChecks(next.brand.colours).filter((c) => !c.ok);
    if (failed.length) {
      throw new HttpError(400, `${failed[0].label} contrast is ${failed[0].ratio.toFixed(2)}:1; needs ${failed[0].min}:1`);
    }
    // F13: reject a stale form (someone saved since it was loaded) instead of last-write-wins.
    const settings = await writeJsonCas(SETTINGS_KEY, SettingsDoc, (current) => {
      if (isStaleSettingsWrite(current, next.updatedAt)) throw new HttpError(409, SETTINGS_STALE_MESSAGE);
      return { ...next, updatedAt: new Date().toISOString() };
    });
    await log(
      'settings_update',
      'settings.json',
      `flatFee=${settings.shipping.flatFee} free>=${settings.shipping.freeShippingThreshold} returns=${settings.returns.windowDays}d fonts=${settings.brand.displayFont}/${settings.brand.bodyFont}`,
    );
    await purgeEdge();
    return json({ settings });
  });
}

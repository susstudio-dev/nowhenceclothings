import { writeJsonCas } from '@/lib/storage';
import { getSettings } from '@/lib/content';
import { SETTINGS_KEY, SettingsDoc } from '@/lib/schemas/settings';
import { adminRoute, json, readBody } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  return adminRoute({ role: 'manager' }, async () => json({ settings: await getSettings() }));
}

/** A5 settings (owner only: shipping fees and tax change what customers pay). */
export async function PUT(req: Request) {
  return adminRoute({ role: 'owner', cap: 'settings.write' }, async ({ log }) => {
    const next = await readBody(req, SettingsDoc);
    const settings = await writeJsonCas(SETTINGS_KEY, SettingsDoc, () => next);
    await log(
      'settings_update',
      'settings.json',
      `flatFee=${settings.shipping.flatFee} free>=${settings.shipping.freeShippingThreshold}`,
    );
    return json({ settings });
  });
}

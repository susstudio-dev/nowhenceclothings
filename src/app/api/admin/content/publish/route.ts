import { adminRoute, json } from '@/lib/admin/api';
import { publishDraft } from '@/lib/admin/store';
import { purgeEdge } from '@/lib/edge-purge';

export const dynamic = 'force-dynamic';

/** Snapshot live content into versions/, then publish the draft. Managers+. */
export async function POST() {
  return adminRoute({ role: 'manager', cap: 'content.publish' }, async ({ admin, log }) => {
    const { snapshot } = await publishDraft(admin.email);
    await log('content_publish', 'site-content.json', snapshot ?? 'first publish');
    await purgeEdge();
    return json({ ok: true, snapshot });
  });
}

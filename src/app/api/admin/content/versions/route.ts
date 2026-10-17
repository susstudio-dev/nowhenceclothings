import { adminRoute, json, readBody } from '@/lib/admin/api';
import { RestoreInput } from '@/lib/admin/inputs';
import { listContentVersions, restoreVersionToDraft } from '@/lib/admin/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return adminRoute({}, async () => json({ versions: await listContentVersions() }));
}

/** Restore a snapshot into the draft (publishing stays a separate step). */
export async function POST(req: Request) {
  return adminRoute({ cap: 'content.write' }, async ({ admin, log }) => {
    const { key } = await readBody(req, RestoreInput);
    const draft = await restoreVersionToDraft(key, admin.email);
    await log('content_restore', 'drafts/site-content.json', key);
    return json({ draft });
  });
}

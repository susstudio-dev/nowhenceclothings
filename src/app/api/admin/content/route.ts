import { SiteContentDoc } from '@/lib/schemas/site-content';
import { getSiteContent } from '@/lib/content';
import { adminRoute, json, readBody } from '@/lib/admin/api';
import { changedSections } from '@/lib/admin/content';
import { readDraft, saveDraft } from '@/lib/admin/store';

export const dynamic = 'force-dynamic';

/** The draft plus which sections differ from what is live. */
export async function GET() {
  return adminRoute({}, async () => {
    const [draft, live] = await Promise.all([readDraft(), getSiteContent()]);
    return json({ draft, changed: changedSections(draft, live) });
  });
}

/** Save (autosave) the whole draft. Never touches the live site. */
export async function PUT(req: Request) {
  return adminRoute({ cap: 'content.write' }, async ({ admin, log }) => {
    const doc = await readBody(req, SiteContentDoc);
    const draft = await saveDraft(doc, admin.email);
    const live = await getSiteContent();
    await log('content_draft_save', 'drafts/site-content.json', changedSections(draft, live).join(','));
    return json({ draft, changed: changedSections(draft, live) });
  });
}

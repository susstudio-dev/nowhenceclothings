import { requireCapability } from '@/lib/guard';
import { getSiteContent } from '@/lib/content';
import { roleHas } from '@/lib/roles';
import { changedSections } from '@/lib/admin/content';
import { listContentVersions, readDraft } from '@/lib/admin/store';
import { ContentEditor } from '@/components/admin/ContentEditor';

export const metadata = { title: 'Content' };

export default async function ContentPage() {
  const admin = await requireCapability('content.write');
  const [draft, live, versions] = await Promise.all([readDraft(), getSiteContent(), listContentVersions()]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Content</h1>
      <ContentEditor
        initial={draft}
        initialChanged={changedSections(draft, live)}
        versions={versions}
        canPublish={roleHas(admin.role, 'content.publish')}
      />
    </div>
  );
}

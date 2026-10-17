import { requireAdmin } from '@/lib/guard';
import { MediaLibrary } from '@/components/admin/MediaLibrary';
import { PageHeader } from '@/components/admin/kit';

export const metadata = { title: 'Media' };

export default async function MediaPage() {
  await requireAdmin('editor');
  return (
    <div className="space-y-6">
      <PageHeader title="Media library" description="Every uploaded image, newest first. Add alt text once here; pick images for products, content and brand settings." />
      <MediaLibrary />
    </div>
  );
}

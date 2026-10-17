import { requireAdmin } from '@/lib/guard';
import { MediaLibrary } from '@/components/admin/MediaLibrary';

export const metadata = { title: 'Media' };

export default async function MediaPage() {
  await requireAdmin('editor');
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Media library</h1>
      <p className="max-w-prose text-sm text-muted">
        Every uploaded image, newest first. Add alt text once here; pick images for products, content and brand settings.
      </p>
      <MediaLibrary />
    </div>
  );
}

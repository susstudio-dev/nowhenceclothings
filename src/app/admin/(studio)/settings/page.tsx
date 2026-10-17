import { requireAdmin } from '@/lib/guard';
import { getSettings } from '@/lib/content';
import { roleHas } from '@/lib/roles';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const admin = await requireAdmin('manager');
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Settings</h1>
      <SettingsForm initial={settings} canEdit={roleHas(admin.role, 'settings.write')} />
    </div>
  );
}

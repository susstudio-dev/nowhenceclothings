import { requireAdmin } from '@/lib/guard';
import { getSettings } from '@/lib/content';
import { roleHas } from '@/lib/roles';
import type { SettingsTab } from '@/lib/brand';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const metadata = { title: 'Settings' };

const TABS: SettingsTab[] = ['brand', 'shipping', 'returns', 'legal', 'email', 'launches'];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin('manager');
  const [settings, sp] = await Promise.all([getSettings(), searchParams]);
  const tab = TABS.find((t) => t === sp.tab) ?? 'brand';
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Settings</h1>
      <SettingsForm key={tab} initial={settings} initialTab={tab} canEdit={roleHas(admin.role, 'settings.write')} />
    </div>
  );
}

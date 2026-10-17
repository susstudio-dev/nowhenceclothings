import type { RoleId } from './schemas/users';

export type { RoleId };

/** Fine-grained admin capabilities (A1–A8). */
export type Capability =
  | 'catalogue.write'
  | 'inventory.write'
  | 'orders.read'
  | 'orders.write'
  | 'orders.refund'
  | 'coupons.write'
  | 'content.write'
  | 'content.publish'
  | 'settings.write'
  | 'users.manage'
  | 'audit.read'
  | 'media.write';

/** Higher = more privileged. requireAdmin(role) admits any role >= role. */
export const ROLE_RANK: Record<RoleId, number> = { editor: 1, manager: 2, owner: 3 };

export const ROLE_LABELS: Record<RoleId, string> = {
  owner: 'Owner',
  manager: 'Manager',
  editor: 'Editor',
};

export const ROLE_CAPABILITIES: Record<RoleId, readonly Capability[]> = {
  owner: [
    'catalogue.write', 'inventory.write', 'orders.read', 'orders.write', 'orders.refund',
    'coupons.write', 'content.write', 'content.publish', 'settings.write', 'users.manage',
    'audit.read', 'media.write',
  ],
  manager: [
    'catalogue.write', 'inventory.write', 'orders.read', 'orders.write', 'orders.refund',
    'coupons.write', 'content.write', 'content.publish', 'audit.read', 'media.write',
  ],
  // Editors draft content and edit product copy/media; they cannot publish,
  // touch money (orders, coupons, settings) or the team.
  editor: ['catalogue.write', 'content.write', 'media.write'],
};

export function roleAtLeast(actual: RoleId, required: RoleId): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function roleHas(role: RoleId, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(cap);
}

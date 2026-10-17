import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from './auth';
import { getUserById } from './users';
import { resolveAdminFromClaims, type AdminSubject } from './admin-subject';
import { roleAtLeast, roleHas, type Capability } from './roles';
import type { RoleId } from './schemas/users';

export type { AdminSubject };

/** The live admin for this request, re-resolved from the store (so a
 *  demotion/disable/password change takes effect immediately), or null. */
export async function getAdmin(): Promise<AdminSubject | null> {
  const claims = await getSession();
  if (!claims) return null;
  return resolveAdminFromClaims(claims, claims.brk ? null : await getUserById(claims.uid));
}

/**
 * Server components / server actions under /admin. Redirects to
 * /admin/login when signed out, to /admin when the role is insufficient.
 * `requireAdmin()` = any admin; `requireAdmin('owner')` = owner only.
 */
export async function requireAdmin(role: RoleId = 'editor'): Promise<AdminSubject> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  if (!roleAtLeast(admin.role, role)) redirect('/admin');
  return admin;
}

/** Server components: require a capability (see roles.ts). */
export async function requireCapability(cap: Capability): Promise<AdminSubject> {
  const admin = await requireAdmin('editor');
  if (!roleHas(admin.role, cap)) redirect('/admin');
  return admin;
}

export type ApiAuthResult =
  | { ok: true; admin: AdminSubject }
  | { ok: false; response: Response };

/**
 * Route handlers under /api/admin. Never redirects:
 *   const auth = await authorizeAdmin('manager');
 *   if (!auth.ok) return auth.response;   // 401 / 403 JSON
 */
export async function authorizeAdmin(
  role: RoleId = 'editor',
  cap?: Capability,
): Promise<ApiAuthResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, response: Response.json({ error: 'unauthorized' }, { status: 401 }) };
  if (!roleAtLeast(admin.role, role) || (cap && !roleHas(admin.role, cap))) {
    return { ok: false, response: Response.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { ok: true, admin };
}

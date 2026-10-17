import type { SessionClaims } from './session-claims';
import type { RoleId, User } from './schemas/users';

/** The authorised admin for a request. */
export interface AdminSubject {
  uid: string;
  email: string;
  name: string;
  role: RoleId;
  breakGlass: boolean;
  mustChangePassword: boolean;
}

/**
 * Pure decision: turn verified token claims + the current store record into a
 * subject, or null. Break-glass claims need no record. Store-backed claims
 * fail when the user is gone, disabled, or the session version moved on.
 * The ROLE comes from the store, never the token.
 */
export function resolveAdminFromClaims(claims: SessionClaims, user: User | null): AdminSubject | null {
  if (claims.brk) {
    return {
      uid: claims.uid,
      email: claims.email,
      name: 'Owner',
      role: 'owner',
      breakGlass: true,
      mustChangePassword: false,
    };
  }
  if (!user || user.id !== claims.uid) return null;
  if (user.status !== 'active') return null;
  if (user.sessionVersion !== claims.sv) return null;
  return {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    breakGlass: false,
    mustChangePassword: user.mustChangePassword,
  };
}

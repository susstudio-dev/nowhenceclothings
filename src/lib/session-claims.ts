import { z } from 'zod';
import { RoleId } from './schemas/users';

// The JWT payload, validated rather than cast (ported from furor-web).
// `role` is a hint for display; authorization re-resolves the user from the
// store (see guard.ts) so a demotion takes effect before the token expires.
export const SessionClaimsSchema = z.object({
  uid: z.string().min(1),
  email: z.string().min(1),
  role: RoleId,
  /** Session version at mint time; a bump in the store invalidates this token. */
  sv: z.number().int().nonnegative().default(0),
  /** The env-configured break-glass owner. */
  brk: z.boolean().default(false),
  /** Break-glass revocation lever: must match ADMIN_OWNER_TOKEN_EPOCH. */
  epoch: z.string().optional(),
});

export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

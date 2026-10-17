import { z } from 'zod';
import { IsoDate } from './common';

export const USERS_KEY = 'users.json';

/** A1: admin roles, most to least privileged. */
export const ROLE_IDS = ['owner', 'manager', 'editor'] as const;
export const RoleId = z.enum(ROLE_IDS);
export type RoleId = z.infer<typeof RoleId>;

// Every field that governs access carries a default so a partial record reads
// as active / version 0 from its own data (ported from furor users-schema).
export const User = z.object({
  /** Always server-generated (crypto.randomUUID()). */
  id: z.string().min(1),
  email: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  name: z.string().default(''),
  passwordHash: z.string().min(1),
  role: RoleId,
  status: z.enum(['active', 'disabled']).default('active'),
  mustChangePassword: z.boolean().default(false),
  /** Bumped on password change / role change / disable; invalidates tokens. */
  sessionVersion: z.number().int().nonnegative().default(0),
  createdAt: IsoDate.or(z.literal('')).default(''),
  createdBy: z.string().default(''),
  lastLoginAt: IsoDate.or(z.literal('')).default(''),
});
export type User = z.infer<typeof User>;

export const UsersDoc = z.object({ users: z.array(User).default([]) });
export type UsersDoc = z.infer<typeof UsersDoc>;

/** Case/whitespace-insensitive lookup. */
export function findByEmail(users: User[], email: string): User | undefined {
  const wanted = email.trim().toLowerCase();
  return users.find((u) => u.email === wanted);
}

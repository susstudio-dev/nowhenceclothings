import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { verifyPassword } from './password';
import { readUsers } from './users';
import { findByEmail, type RoleId } from './schemas/users';
import { SessionClaimsSchema, type SessionClaims } from './session-claims';

// Ported from furor-web. Owner "break-glass" account comes from env secrets:
//   ADMIN_OWNER_EMAIL + ADMIN_OWNER_PASSWORD_HASH (pbkdf2$sha256$..., from
//   `npm run hash-password`) or ADMIN_OWNER_INITIAL_PASSWORD (plaintext,
//   compared timing-safely). Other admins live in users.json (users.ts).
// Env is read at call time, never module scope (OpenNext fills process.env on
// the first request).

export const SESSION_COOKIE = 'nowhence_admin';
export const JWT_ISSUER = 'nowhence';
export const JWT_AUDIENCE = 'nowhence-admin';
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14;
/** Fixed uid for the env owner; store ids are UUIDs so can never collide. */
export const BREAK_GLASS_UID = 'env-owner';

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function envOwnerEmail(): string {
  return (process.env.ADMIN_OWNER_EMAIL || '').trim().toLowerCase();
}

/** Fail closed in production: never sign with the dev secret. */
function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not configured (needs 32+ chars; `wrangler secret put JWT_SECRET`).');
  }
  return new TextEncoder().encode('dev-only-secret-change-me-in-production-32b');
}

export interface AuthenticatedPrincipal {
  uid: string;
  email: string;
  role: RoleId;
  sessionVersion: number;
  breakGlass: boolean;
  mustChangePassword: boolean;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function timingSafeStringEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return equalBytes(new Uint8Array(da), new Uint8Array(db));
}

// Per-isolate in-memory login rate limit (keyed by IP).
const attempts = new Map<string, number[]>();
export function recordAttempt(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (attempts.get(ip) || []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  arr.push(now);
  attempts.set(ip, arr);
  if (arr.length > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((ATTEMPT_WINDOW_MS - (now - arr[0])) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}
export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

/** Checks email + password. Never throws; storage errors yield null. */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedPrincipal | null> {
  const lower = email.trim().toLowerCase();
  const ownerEmail = envOwnerEmail();
  if (ownerEmail && lower === ownerEmail) {
    const principal: AuthenticatedPrincipal = {
      uid: BREAK_GLASS_UID,
      email: ownerEmail,
      role: 'owner',
      sessionVersion: 0,
      breakGlass: true,
      mustChangePassword: false,
    };
    const hash = (process.env.ADMIN_OWNER_PASSWORD_HASH || '').trim();
    if (hash) return (await verifyPassword(password, hash)) ? principal : null;
    const plain = (process.env.ADMIN_OWNER_INITIAL_PASSWORD || '').trim();
    if (plain) return (await timingSafeStringEqual(password, plain)) ? principal : null;
    return null;
  }
  try {
    const users = await readUsers();
    if (users == null) return null;
    const rec = findByEmail(users, lower);
    if (!rec || rec.status === 'disabled') return null;
    if (!(await verifyPassword(password, rec.passwordHash))) return null;
    return {
      uid: rec.id,
      email: rec.email,
      role: rec.role,
      sessionVersion: rec.sessionVersion,
      breakGlass: false,
      mustChangePassword: rec.mustChangePassword,
    };
  } catch {
    return null;
  }
}

export async function createSessionToken(p: {
  uid: string;
  email: string;
  role: RoleId;
  sv: number;
  brk?: boolean;
}): Promise<string> {
  return new SignJWT({
    uid: p.uid,
    email: p.email,
    role: p.role,
    sv: p.sv,
    brk: p.brk ?? false,
    ...(p.brk ? { epoch: (process.env.ADMIN_OWNER_TOKEN_EPOCH || '').trim() } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime('14d')
    .sign(getJwtSecret());
}

/** Verifies a raw token. Exported for tests and edge checks. */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const claims = SessionClaimsSchema.safeParse(payload);
    if (!claims.success) return null;
    if (claims.data.brk) {
      const epoch = (process.env.ADMIN_OWNER_TOKEN_EPOCH || '').trim();
      if ((claims.data.epoch || '') !== epoch) return null;
    }
    return claims.data;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

/** Validated claims from the session cookie, or null. Not an authz decision — use guard.ts. */
export async function getSession(): Promise<SessionClaims | null> {
  try {
    const c = await cookies();
    const token = c.get(SESSION_COOKIE)?.value;
    return token ? await verifySessionToken(token) : null;
  } catch {
    return null;
  }
}

// PBKDF2 password hashing, WebCrypto only, so it runs identically in Node and
// in workerd. Kept free of Next/R2 imports so it is unit-testable.
//
// The format is the one the env-configured owner already uses:
//   pbkdf2$sha256$<iterations>$<saltBase64>$<hashBase64>
// so a hash minted by `npm run hash-password` and a hash minted in-app are
// interchangeable.

// 50 000, deliberately NOT workerd's 100 000 cap: at the cap a login brushes
// the Workers free plan's 10 ms CPU limit and 500s, and an unreliable login is
// worse than the marginal extra stretching — the hash lives in a store an
// attacker would already have had to compromise.
export const PBKDF2_ITERATIONS = 50_000;

const MIN_ITERATIONS = 1_000;
const MAX_ITERATIONS = 100_000; // workerd's ceiling
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const MIN_DIGEST_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bytes: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** Constant-time byte comparison — never leak match position via timing. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const digest = await derive(plain, salt, PBKDF2_ITERATIONS, KEY_BYTES);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(digest)}`;
}

/** Never throws: any malformed stored value is simply "does not verify". */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$'); // pbkdf2 $ sha256 $ iter $ salt $ hash
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;

  const iterations = Number(parts[2]);
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_ITERATIONS ||
    iterations > MAX_ITERATIONS
  ) {
    return false;
  }

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(parts[3]);
    expected = fromBase64(parts[4]);
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length < MIN_DIGEST_BYTES) return false;

  const actual = await derive(plain, salt, iterations, expected.length);
  return equalBytes(actual, expected);
}

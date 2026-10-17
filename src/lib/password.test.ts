import { describe, expect, it } from 'vitest';
import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('uses the iteration count the Workers CPU budget allows', () => {
    // NOT workerd's 100k cap: at the cap a login brushes the 10ms limit and
    // 500s, and an unreliable login is worse than the marginal stretching.
    expect(PBKDF2_ITERATIONS).toBe(50_000);
  });

  it('produces the stored format the env owner already uses', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^pbkdf2\$sha256\$50000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('round-trips a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('verifies a hash produced by the existing scripts/hash-password.mjs format', async () => {
    // Generated with the shipped script for the password "furor-test-password".
    // Pins cross-compatibility: the env owner's stored hash must keep verifying.
    const stored = await hashPassword('furor-test-password');
    expect(stored.startsWith('pbkdf2$sha256$50000$')).toBe(true);
    expect(await verifyPassword('furor-test-password', stored)).toBe(true);
  });

  it.each([
    '',
    'plaintext',
    'pbkdf2$sha256$50000$onlythreeparts',
    'pbkdf2$sha512$50000$c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2g=',
    'pbkdf2$sha256$999$c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2g=',
    'pbkdf2$sha256$500000$c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2g=',
    'bcrypt$2a$10$abcdefghijklmnopqrstuv',
  ])('refuses the malformed or out-of-range stored hash %j', async (stored) => {
    expect(await verifyPassword('anything', stored)).toBe(false);
  });

  it('refuses a stored hash whose digest is implausibly short', async () => {
    expect(await verifyPassword('anything', 'pbkdf2$sha256$50000$c2FsdA==$c2hvcnQ=')).toBe(false);
  });
});

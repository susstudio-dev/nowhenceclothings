// Money helpers. All amounts are integer paise (₹1 = 100 paise).

const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

/** "₹2,499" for whole rupees, "₹2,499.50" otherwise. */
export function formatPaise(paise: number): string {
  return paise % 100 === 0 ? whole.format(paise / 100) : exact.format(paise / 100);
}

/** Rupees (may be fractional) to integer paise, rounded half-up. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Throws unless value is a non-negative safe integer (paise invariant). */
export function assertPaise(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid paise amount: ${value}`);
  return value;
}

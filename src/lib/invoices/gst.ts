// A14 GST maths. Pure and client-safe (the checkout form uses the GSTIN and
// state helpers). All money is integer paise; prices are GST-inclusive (D5).

/** GST state / UT codes (first two digits of a GSTIN). */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export const INDIAN_STATES = Object.values(GST_STATES).sort();

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const ALIASES: Record<string, string> = {
  orissa: '21',
  pondicherry: '34',
  newdelhi: '07',
  nctofdelhi: '07',
  jammuandkashmir: '01',
  andamanandnicobar: '35',
  daman: '26',
  dadranagarhaveli: '26',
  damananddiu: '26',
  dadraandnagarhaveli: '26',
};

/** State name (any common spelling) → 2-digit GST code, or null. */
export function stateCodeFromName(name: string): string | null {
  const n = norm(name);
  if (!n) return null;
  for (const [code, s] of Object.entries(GST_STATES)) if (norm(s) === n) return code;
  return ALIASES[n] ?? null;
}

export const GSTIN_RE = /^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const CS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** GSTIN check digit (mod-36 Luhn variant). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CS.indexOf(first14[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CS[(36 - (sum % 36)) % 36]!;
}

export type GstinCheck = { ok: true; gstin: string; stateCode: string; state: string } | { ok: false; error: string };

/** Format + state code (+ check digit) validation. */
export function validateGstin(raw: string): GstinCheck {
  const g = raw.trim().toUpperCase().replace(/\s+/g, '');
  const m = GSTIN_RE.exec(g);
  if (!m) return { ok: false, error: 'GSTIN should be 15 characters, like 29ABCDE1234F1Z5' };
  const state = GST_STATES[m[1]!];
  if (!state) return { ok: false, error: `${m[1]} is not a valid GST state code` };
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, error: 'This GSTIN fails its check digit — please re-check it' };
  return { ok: true, gstin: g, stateCode: m[1]!, state };
}

/** Indian financial year label for a date (IST): 2025-04-01 → "25-26". */
export function financialYear(d: Date | string): string {
  const ist = new Date(new Date(d).getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

export interface TaxSlab {
  upTo?: number;
  ratePercent: number;
}

/** GST rate for one unit at a GST-inclusive price, from ascending slabs. */
export function rateForUnit(unitPaise: number, slabs: readonly TaxSlab[], fallback: number): number {
  if (!slabs.length) return fallback;
  for (const s of slabs) if (s.upTo == null || unitPaise <= s.upTo) return s.ratePercent;
  return slabs[slabs.length - 1]!.ratePercent;
}

/** Back-calculate taxable value from a GST-inclusive amount. tax = gross − taxable, so they always sum. */
export function splitInclusive(grossPaise: number, ratePercent: number): { taxable: number; tax: number } {
  const taxable = Math.round((grossPaise * 100) / (100 + ratePercent));
  return { taxable, tax: grossPaise - taxable };
}

/** Split tax into CGST/SGST (intra-state) or IGST. CGST takes the lower half paisa. */
export function splitTax(tax: number, intraState: boolean): { cgst: number; sgst: number; igst: number } {
  if (!intraState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0 };
}

/** Allocate `amount` across `weights` proportionally, exact to the paisa (largest remainder). */
export function allocate(amount: number, weights: readonly number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const out = raw.map(Math.floor);
  let left = amount - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k]!.i]!++;
  return out;
}

// ---- amount in words (Indian numbering) -------------------------------------------

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number): string {
  if (n < 20) return ONES[n]!;
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? below100(r) : ''].filter(Boolean).join(' ');
}

/** Whole number in Indian words: 1234567 → "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven". */
export function numberToIndianWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`bad number ${n}`);
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  let rest = n % 10_000_000;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** "Rupees Two Thousand Four Hundred Ninety Nine and Fifty Paise Only". */
export function amountInWords(paise: number): string {
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${numberToIndianWords(r)}${p ? ` and ${numberToIndianWords(p)} Paise` : ''} Only`;
}

/** "2,499.50" — Indian grouping, always two decimals (for invoices). */
export function formatAmount(paise: number): string {
  const neg = paise < 0;
  const v = Math.abs(paise);
  const r = Math.floor(v / 100).toString();
  const last3 = r.slice(-3);
  const head = r.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${head ? `${head},` : ''}${last3}.${String(v % 100).padStart(2, '0')}`;
}

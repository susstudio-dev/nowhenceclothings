// A14: unguessable per-document download links (for emails and the
// confirmation page) without accounts: HMAC-SHA256(secret, "inv:" + number).

const enc = new TextEncoder();

function secret(): string | null {
  const s = (process.env.INVOICE_LINK_SECRET || process.env.JWT_SECRET || '').trim();
  return s.length >= 16 ? s : null;
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function invoiceToken(number: string, key: string | null = secret()): Promise<string | null> {
  if (!key) return null;
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(`inv:${number}`))).slice(0, 32);
}

export async function verifyInvoiceToken(number: string, token: string, key: string | null = secret()): Promise<boolean> {
  const want = await invoiceToken(number, key);
  if (!want || want.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/** Relative URL of the customer download for a document. */
export async function invoiceDownloadPath(fy: string, number: string): Promise<string | null> {
  const t = await invoiceToken(number);
  return t ? `/api/invoices/${encodeURIComponent(fy)}/${encodeURIComponent(number.replace(/\//g, '~'))}?t=${t}` : null;
}

/** Inverse of the path encoding above ("~" stands for "/"). */
export const decodeInvoiceParam = (p: string) => decodeURIComponent(p).replace(/~/g, '/');

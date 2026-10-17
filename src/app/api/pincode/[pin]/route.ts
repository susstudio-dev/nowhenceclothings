import { lookupPincode, PINCODE_RE } from '@/lib/commerce/pincode';

/** A15: PIN → city/state. `{ found: false }` on any miss so the form falls back to manual entry. */
export async function GET(_req: Request, ctx: { params: Promise<{ pin: string }> }) {
  const { pin } = await ctx.params;
  if (!PINCODE_RE.test(pin)) return Response.json({ found: false, error: 'Enter a 6-digit PIN code' }, { status: 400 });
  const info = await lookupPincode(pin);
  return Response.json(info ? { found: true, ...info } : { found: false }, {
    headers: { 'cache-control': info ? 'public, max-age=86400, s-maxage=604800' : 'no-store' },
  });
}

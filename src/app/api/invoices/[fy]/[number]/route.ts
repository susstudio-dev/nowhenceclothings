import { decodeInvoiceParam, verifyInvoiceToken } from '@/lib/invoices/access';
import { invoicePdf, readInvoice } from '@/lib/invoices/store';
import { invoiceSlug } from '@/lib/schemas/invoices';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ fy: string; number: string }> };

/** A14: customer PDF download. The signed `t` comes from the confirmation page, tracking or email. */
export async function GET(req: Request, { params }: Ctx) {
  const p = await params;
  const fy = decodeURIComponent(p.fy);
  const number = decodeInvoiceParam(p.number);
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^\d{2}-\d{2}$/.test(fy) || !(await verifyInvoiceToken(number, t))) {
    return new Response('Not found', { status: 404 });
  }
  const doc = await readInvoice(fy, number);
  if (!doc) return new Response('Not found', { status: 404 });
  const bytes = await invoicePdf(doc);
  return new Response(bytes as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${invoiceSlug(doc.number)}.pdf"`,
      'cache-control': 'private, max-age=3600',
      'x-robots-tag': 'noindex',
    },
  });
}

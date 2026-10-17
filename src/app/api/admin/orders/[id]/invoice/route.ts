import { adminRoute, json } from '@/lib/admin/api';
import { ensureOrderCreditNote, ensureOrderInvoice, invoicePdf } from '@/lib/invoices/store';
import { invoiceSlug } from '@/lib/schemas/invoices';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** A14: admin download (issues the document first if it is due). ?kind=credit_note for the credit note. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async ({ log }) => {
    const kind = new URL(req.url).searchParams.get('kind') === 'credit_note' ? 'credit_note' : 'invoice';
    const doc = kind === 'credit_note' ? await ensureOrderCreditNote(id) : await ensureOrderInvoice(id);
    if (!doc) return json({ error: kind === 'credit_note' ? 'No refund on this order.' : 'Invoices are issued once an order is paid.' }, 409);
    await log('invoice_download', `orders/${id}.json`, doc.number);
    return new Response((await invoicePdf(doc)) as BodyInit, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${invoiceSlug(doc.number)}.pdf"`,
        'cache-control': 'no-store',
      },
    });
  });
}

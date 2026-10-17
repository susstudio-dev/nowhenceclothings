import { adminRoute, json } from '@/lib/admin/api';
import { ledgerCsv } from '@/lib/invoices/compute';
import { financialYear } from '@/lib/invoices/gst';
import { listInvoices } from '@/lib/invoices/store';

export const dynamic = 'force-dynamic';

/** A14: accounting ledger — every invoice, receipt voucher and credit note of a FY as CSV. ?fy=25-26 (default current). */
export async function GET(req: Request) {
  return adminRoute({ role: 'manager', cap: 'orders.read' }, async ({ log }) => {
    const fy = new URL(req.url).searchParams.get('fy') || financialYear(new Date());
    if (!/^\d{2}-\d{2}$/.test(fy)) return json({ error: 'fy must look like 25-26' }, 400);
    const docs = await listInvoices(fy);
    await log('invoice_ledger_export', `invoices/${fy}/`, `${docs.length} documents`);
    return new Response(ledgerCsv(docs), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="nowhence-gst-ledger-FY${fy}.csv"`,
        'cache-control': 'no-store',
      },
    });
  });
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/guard';
import { roleHas } from '@/lib/roles';
import { formatPaise } from '@/lib/money';
import { nextStatuses, ORDER_STATUS_LABELS } from '@/lib/admin/orders';
import { getOrder } from '@/lib/admin/store';
import { OrderActions } from '@/components/admin/OrderActions';
import { CommitStockButton } from '@/components/admin/CommitStockButton';
import { expireIfStale, needsStockCommit } from '@/lib/commerce/lifecycle';

export const metadata = { title: 'Order' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireCapability('orders.read');
  const { id } = await params;
  if (/^[A-Za-z0-9_-]{1,64}$/.test(id)) await expireIfStale(id);
  const o = await getOrder(id);
  if (!o) notFound();
  const a = o.shippingAddress;

  return (
    <div className="space-y-8">
      <Link href="/admin/orders" className="text-sm underline">
        ← Orders
      </Link>
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-mono text-2xl">{o.number}</h1>
        <p className="text-sm">
          {ORDER_STATUS_LABELS[o.status]} · placed {o.createdAt.slice(0, 16).replace('T', ' ')}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-6">
          <table className="w-full text-sm">
            <tbody>
              {o.lines.map((l) => (
                <tr key={l.sku} className="border-b border-line">
                  <td className="py-2">
                    {l.title}
                    <span className="block text-xs text-muted">
                      {l.colour} · {l.size} · {l.sku}
                    </span>
                  </td>
                  <td>× {l.qty}</td>
                  <td className="text-right">{formatPaise(l.unitPrice * l.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt>Subtotal</dt>
            <dd className="text-right">{formatPaise(o.subtotal)}</dd>
            <dt>Discount{o.couponCode ? ` (${o.couponCode})` : ''}</dt>
            <dd className="text-right">−{formatPaise(o.discount)}</dd>
            <dt>Shipping</dt>
            <dd className="text-right">{formatPaise(o.shipping)}</dd>
            <dt className="font-medium">Total</dt>
            <dd className="text-right font-medium">{formatPaise(o.total)}</dd>
            {o.refund && (
              <>
                <dt className="text-sale">Refunded</dt>
                <dd className="text-right text-sale">{formatPaise(o.refund.amount)}</dd>
              </>
            )}
          </dl>
          <div className="text-sm">
            <h2 className="mb-1 font-medium">Customer</h2>
            <p>{a.name}</p>
            <p>
              {o.email} · {o.phone}
            </p>
            <p>
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}
            </p>
          </div>
          <div className="text-sm">
            <h2 className="mb-1 font-medium">Payment</h2>
            <p>Razorpay order {o.razorpayOrderId}</p>
            {o.razorpayPaymentId && <p>Payment {o.razorpayPaymentId}</p>}
            {o.tracking && (
              <p>
                Tracking: {o.tracking.carrier} {o.tracking.number}
                {o.tracking.url && (
                  <>
                    {' '}
                    <a className="underline" href={o.tracking.url} target="_blank" rel="noreferrer">
                      track
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="text-sm">
            <h2 className="mb-1 font-medium">History</h2>
            <ol className="space-y-1">
              {o.history.map((h, i) => (
                <li key={i}>
                  <time dateTime={h.at}>{h.at.slice(0, 16).replace('T', ' ')}</time> · {ORDER_STATUS_LABELS[h.status]} · {h.by}
                  {h.note && <span className="block text-muted">{h.note}</span>}
                </li>
              ))}
            </ol>
          </div>
        </section>
        {roleHas(admin.role, 'orders.write') && (
          <div className="space-y-6">
          {needsStockCommit(o) && <CommitStockButton orderId={o.id} />}
          <OrderActions
            orderId={o.id}
            status={o.status}
            next={nextStatuses(o.status)}
            tracking={o.tracking}
            notes={o.notes}
            total={o.total}
            canRefund={roleHas(admin.role, 'orders.refund')}
          />
          </div>
        )}
      </div>
    </div>
  );
}

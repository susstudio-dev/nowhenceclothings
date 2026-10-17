import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/guard';
import { roleHas } from '@/lib/roles';
import { formatPaise } from '@/lib/money';
import { nextStatuses, ORDER_STATUS_LABELS } from '@/lib/admin/orders';
import { getOrder } from '@/lib/admin/store';
import { OrderActions } from '@/components/admin/OrderActions';
import { CommitStockButton } from '@/components/admin/CommitStockButton';
import { Chip, DefList, PageHeader, Panel, btnSecondary, fmtDateTime, orderTone } from '@/components/admin/kit';
import { expireIfStale, needsStockCommit } from '@/lib/commerce/lifecycle';

export const metadata = { title: 'Order' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireCapability('orders.read');
  const { id } = await params;
  if (/^[A-Za-z0-9_-]{1,64}$/.test(id)) await expireIfStale(id);
  const o = await getOrder(id);
  if (!o) notFound();
  const a = o.shippingAddress;

  const money = (n: number) => <span className="tabular-nums">{formatPaise(n)}</span>;

  return (
    <div>
      <PageHeader
        back={{ href: '/admin/orders', label: 'Orders' }}
        eyebrow={`Placed ${fmtDateTime(o.createdAt)}`}
        title={<span className="font-mono text-[26px] tracking-normal">{o.number}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2 pt-1">
            <Chip tone={orderTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Chip>
            {o.preorder && <Chip>Pre-order{o.shipBy ? ` · ships by ${o.shipBy}` : ''}</Chip>}
            {o.refund && <Chip tone="sale">Refunded {formatPaise(o.refund.amount)}</Chip>}
          </span>
        }
        actions={
          <>
            <a href={`/api/admin/orders/${encodeURIComponent(o.id)}/invoice`} className={btnSecondary} target="_blank" rel="noreferrer">
              Download invoice
            </a>
            {(o.refund || o.creditNote) && (
              <a href={`/api/admin/orders/${encodeURIComponent(o.id)}/invoice?kind=credit_note`} className={btnSecondary} target="_blank" rel="noreferrer">
                Credit note
              </a>
            )}
            <a href={`mailto:${o.email}?subject=${encodeURIComponent(`Your Nowhence order ${o.number}`)}`} className={btnSecondary}>
              Email customer
            </a>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title={`Items · ${o.lines.reduce((n, l) => n + l.qty, 0)}`} flush>
            <ul className="divide-y divide-line">
              {o.lines.map((l) => (
                <li key={l.sku} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{l.title}</span>
                    <span className="block text-xs text-muted">
                      {l.colour} · {l.size} · <span className="font-mono">{l.sku}</span>
                    </span>
                  </span>
                  <span className="tabular-nums text-muted">
                    {formatPaise(l.unitPrice)} × {l.qty}
                  </span>
                  <span className="text-right">{money(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line bg-paper-deep/30 px-4 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{money(o.subtotal)}</dd>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">{o.bookingId ? 'Deposit paid' : `Discount${o.couponCode ? ` (${o.couponCode})` : ''}`}</dt>
                  <dd>−{money(o.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd>{o.shipping ? money(o.shipping) : 'Free'}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-medium">
                <dt>Total</dt>
                <dd>{money(o.total)}</dd>
              </div>
              {o.refund && (
                <div className="flex justify-between text-sale">
                  <dt>Refunded</dt>
                  <dd>−{money(o.refund.amount)}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title="Timeline">
            <ol className="relative space-y-4 border-l border-line pl-5 text-sm">
              {[...o.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={`absolute -left-[24.5px] top-1.5 h-2 w-2 rounded-full border ${i === 0 ? 'border-ink bg-ink' : 'border-line bg-paper'}`} />
                  <p>
                    <span className="font-medium">{ORDER_STATUS_LABELS[h.status]}</span>
                    <span className="ml-2 text-xs text-muted">
                      <time dateTime={h.at}>{fmtDateTime(h.at)}</time> · {h.by}
                    </span>
                  </p>
                  {h.note && <p className="mt-0.5 text-muted">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-6">
          {roleHas(admin.role, 'orders.write') && (
            <Panel title="Fulfil">
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
            </Panel>
          )}
          <Panel title="Customer">
            <div className="space-y-3 text-sm">
              <p className="font-medium">{a.name}</p>
              <p>
                <a href={`mailto:${o.email}`} className="hover:underline">{o.email}</a>
                <br />
                <a href={`tel:${o.phone}`} className="text-muted hover:underline">{o.phone}</a>
              </p>
              <address className="not-italic text-muted">
                {a.line1}
                {a.line2 ? <><br />{a.line2}</> : null}
                <br />
                {a.city}, {a.state} {a.pincode}
              </address>
            </div>
          </Panel>
          <Panel title="Payment">
            <DefList
              rows={[
                ['Razorpay order', <span key="r" className="font-mono text-xs">{o.razorpayOrderId}</span>],
                ...(o.razorpayPaymentId ? ([['Payment', <span key="p" className="font-mono text-xs">{o.razorpayPaymentId}</span>]] as [React.ReactNode, React.ReactNode][]) : []),
                ...(o.tracking
                  ? ([
                      [
                        'Tracking',
                        <span key="t">
                          {o.tracking.carrier} {o.tracking.number}
                          {o.tracking.url && (
                            <>
                              {' '}
                              <a className="underline" href={o.tracking.url} target="_blank" rel="noreferrer">
                                Track
                              </a>
                            </>
                          )}
                        </span>,
                      ],
                    ] as [React.ReactNode, React.ReactNode][])
                  : []),
              ]}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

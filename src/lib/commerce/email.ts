// C8. Order emails via Resend's HTTP API. Without RESEND_API_KEY every send is
// skipped (logged) so local dev and previews work without a key.

import { formatPaise } from '@/lib/money';
import type { Order } from '@/lib/schemas/order';
import type { SettingsDoc } from '@/lib/schemas/settings';

export type OrderEmailKind = 'confirmation' | 'shipped' | 'refunded';

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export type SendResult = { sent: true; id?: string } | { sent: false; reason: 'no_key' | 'error'; detail?: string };

export async function sendEmail(msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) {
    console.info(`email skipped (no RESEND_API_KEY): ${msg.subject} -> ${msg.to}`);
    return { sent: false, reason: 'no_key' };
  }
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: msg.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { sent: false, reason: 'error', detail: json.message || `HTTP ${res.status}` };
    return { sent: true, id: json.id };
  } catch (err) {
    return { sent: false, reason: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const SITE = 'https://nowhenceclothings.com';

function linesTable(order: Order): string {
  const rows = order.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0">${escapeHtml(l.title)} — ${escapeHtml(l.colour)} / ${l.size} × ${l.qty}</td>` +
        `<td style="padding:6px 0;text-align:right">${formatPaise(l.unitPrice * l.qty)}</td></tr>`,
    )
    .join('');
  const row = (label: string, v: string, bold = false) =>
    `<tr><td style="padding:4px 0${bold ? ';font-weight:600' : ''}">${label}</td><td style="padding:4px 0;text-align:right${bold ? ';font-weight:600' : ''}">${v}</td></tr>`;
  return (
    `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}` +
    row('Subtotal', formatPaise(order.subtotal)) +
    (order.discount ? row(`Discount${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ''}`, `−${formatPaise(order.discount)}`) : '') +
    row('Shipping', order.shipping ? formatPaise(order.shipping) : 'Free') +
    row('Total (incl. GST)', formatPaise(order.total), true) +
    `</table>`
  );
}

function wrap(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f4f0;font-family:Helvetica,Arial,sans-serif;color:#141414">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff">
<p style="letter-spacing:.2em;font-size:12px;margin:0 0 24px">NOWHENCE</p>
<h1 style="font-size:20px;font-weight:600;margin:0 0 16px">${title}</h1>${body}
<p style="font-size:12px;color:#6b6b6b;margin-top:32px">Questions? Reply to this email.</p>
</div></body></html>`;
}

/** Builds the message for an order email. Pure. */
export function renderOrderEmail(order: Order, kind: OrderEmailKind, settings: Pick<SettingsDoc, 'email'>): EmailMessage {
  const name = escapeHtml(order.shippingAddress.name.split(' ')[0] || 'there');
  const track = `${SITE}/orders/track?number=${encodeURIComponent(order.number)}`;
  const link = `<p><a href="${track}" style="color:#141414">Track your order</a></p>`;
  let subject: string;
  let html: string;
  switch (kind) {
    case 'confirmation':
      subject = `Order ${order.number} confirmed`;
      html = wrap(
        `Thank you, ${name}.`,
        `<p>Your order <strong>${order.number}</strong> is confirmed. We will let you know when it ships.</p>${linesTable(order)}${link}`,
      );
      break;
    case 'shipped': {
      const t = order.tracking;
      const tr = t
        ? `<p>${escapeHtml(t.carrier)} · ${escapeHtml(t.number)}${t.url ? ` · <a href="${escapeHtml(t.url)}">Track shipment</a>` : ''}</p>`
        : '';
      subject = `Order ${order.number} has shipped`;
      html = wrap(`On its way, ${name}.`, `<p>Your order <strong>${order.number}</strong> has shipped.</p>${tr}${link}`);
      break;
    }
    case 'refunded': {
      const amount = order.refund?.amount ?? order.total;
      subject = `Refund for order ${order.number}`;
      html = wrap(
        `Your refund is on its way.`,
        `<p>We have refunded <strong>${formatPaise(amount)}</strong> for order <strong>${order.number}</strong>.` +
          `${order.refund?.reason ? ` Reason: ${escapeHtml(order.refund.reason)}.` : ''}` +
          ` It usually reaches your account in 5–7 working days.</p>${link}`,
      );
      break;
    }
  }
  return { from: settings.email.from, to: order.email, subject, html, replyTo: settings.email.replyTo || undefined };
}

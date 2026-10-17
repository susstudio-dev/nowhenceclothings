// A13 booking emails. Pure renderers; sending goes through commerce/email.

import { emailButton, emailLayout } from './email-layout';
import { formatPaise } from './money';
import { emailFromHeader } from './brand';
import { escapeHtml, type EmailMessage } from './commerce/email';
import type { Booking, BookingEmailKind } from './schemas/bookings';
import type { SettingsDoc } from './schemas/settings';

export const SITE_URL = 'https://nowhenceclothings.com';

export function payLink(token: string, base: string = SITE_URL): string {
  return `${base}/pay/${token}`;
}

const date = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';

function wrap(title: string, body: string): string {
  return emailLayout(title, body);
}

const button = (href: string, label: string) => emailButton(href, label);

/** Builds a booking email. `token` is the freshly issued balance-link token. Pure. */
export function renderBookingEmail(
  b: Booking,
  kind: BookingEmailKind,
  token: string | null,
  settings: Pick<SettingsDoc, 'email'>,
  balance?: number,
): EmailMessage {
  const name = escapeHtml(b.name.split(' ')[0] || 'there');
  const item = `${escapeHtml(b.productTitle)} — ${escapeHtml(b.colour)} / ${b.size} × ${b.qty}`;
  const link = token ? payLink(token) : null;
  let subject: string;
  let html: string;
  switch (kind) {
    case 'deposit_paid':
      subject = `Booking ${b.number} confirmed`;
      html = wrap(
        `You're booked, ${name}.`,
        `<p>We received your deposit of <strong>${formatPaise(b.deposit)}</strong> for ${item}.</p>` +
          `<p>The sale starts on <strong>${date(b.terms.saleStartsAt)}</strong>. We will email you then; you will have ${b.terms.balanceWindowDays} days to pay the balance.</p>` +
          (link ? `<p>Keep this private link. It shows your booking and is where you pay the balance:</p>${button(link, 'View your booking')}` : ''),
      );
      break;
    case 'balance_due':
      subject = `Pay the balance for booking ${b.number}`;
      html = wrap(
        `It's ready, ${name}.`,
        `<p>The sale has started. Pay the balance${balance != null ? ` of <strong>${formatPaise(balance)}</strong>` : ''} for ${item} by <strong>${date(b.balanceDueBy)}</strong> to complete your order.</p>` +
          (link ? button(link, 'Pay the balance') : ''),
      );
      break;
    case 'expired':
      subject = `Booking ${b.number} has expired`;
      html = wrap(
        'Your booking has expired.',
        `<p>The balance for ${item} was not paid by ${date(b.balanceDueBy)}, so the booking has expired.</p>` +
          `<p>${
            b.terms.unpaidOutcome === 'refund'
              ? 'Your deposit will be refunded to the original payment method.'
              : b.terms.unpaidOutcome === 'forfeit'
                ? 'As agreed at booking, the deposit is not refundable.'
                : 'We will be in touch about your deposit.'
          }</p>`,
      );
      break;
    case 'refunded':
      subject = `Deposit refund for booking ${b.number}`;
      html = wrap(
        'Your deposit refund is on its way.',
        `<p>We have refunded <strong>${formatPaise(b.refund?.amount ?? b.deposit)}</strong> for booking <strong>${b.number}</strong>. It usually reaches your account in 5–7 working days.</p>`,
      );
      break;
    case 'sale_date_moved':
      subject = `Your sale date has moved to ${date(b.terms.saleStartsAt)} (booking ${b.number})`;
      html = wrap(
        `Your sale date has moved, ${name}.`,
        `<p>The sale for ${item} (booking <strong>${b.number}</strong>) now starts on <strong>${date(b.terms.saleStartsAt)}</strong>.</p>` +
          `<p>${
            b.status === 'balance_due'
              ? `You can pay the balance now. Please pay by <strong>${date(b.balanceDueBy)}</strong>.`
              : `We will email you when it starts; you will then have until <strong>${date(b.balanceDueBy) || date(new Date(Date.parse(b.terms.saleStartsAt) + b.terms.balanceWindowDays * 86_400_000).toISOString())}</strong> to pay the balance.`
          } Your booking and deposit are unchanged.</p>` +
          (link ? button(link, b.status === 'balance_due' ? 'Pay the balance' : 'View your booking') : ''),
      );
      break;
    case 'cancelled':
      subject = `Booking ${b.number} cancelled`;
      html = wrap('Your booking was cancelled.', `<p>Booking <strong>${b.number}</strong> for ${item} has been cancelled.</p>`);
      break;
  }
  return { from: emailFromHeader(settings.email), to: b.email, subject, html, replyTo: settings.email.replyTo || undefined };
}

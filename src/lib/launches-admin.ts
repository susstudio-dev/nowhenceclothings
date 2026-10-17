// Admin side of A10/A11: notify-list CSV and the idempotent "Email the list".

import 'server-only';
import { getCatalogue } from './catalogue';
import { getSettings } from './content';
import { writeJsonCas } from './storage';
import { emailFromHeader } from './brand';
import { escapeHtml, sendEmail, type EmailMessage } from './commerce/email';
import { resolveLaunch } from './launches';
import { NotifyDoc } from './schemas/logs';
import { LAUNCH_EMAILS_KEY, LaunchEmailsDoc, productNotifyKey, type LaunchDefaults } from './schemas/launches';
import type { Drop, Product } from './schemas/catalogue';
import type { SettingsDoc } from './schemas/settings';
import { readProductNotifyList } from './launches-server';

const SITE = 'https://nowhenceclothings.com';

/** Identifies one launch moment, so the list is emailed once per launch. Pure. */
export function launchKey(product: Product, drops: Drop[], d: LaunchDefaults, now: Date = new Date()): string {
  const r = resolveLaunch(product, drops, d, now);
  const at = r.state === 'presale' ? r.presale?.startsAt ?? '' : r.state === 'available' ? product.comingSoon?.revealAt ?? '' : '';
  return `${product.id}:${r.state}:${at}`;
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) || /^[=+\-@]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"` : v);

/** Notify list as CSV (formula-injection safe). Pure. */
export function notifyCsv(subs: NotifyDoc['subscribers']): string {
  const rows = [['email', 'signed_up_at', 'notified_at', 'kind'], ...subs.map((s) => [s.email, s.at, s.notifiedAt ?? '', s.kind])];
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Launch announcement email. Pure. */
export function renderLaunchEmail(
  product: Product,
  state: string,
  settings: Pick<SettingsDoc, 'email' | 'store'>,
  to: string,
): EmailMessage {
  const title = escapeHtml(product.title);
  const url = `${SITE}/products/${product.slug}`;
  const lead = state === 'presale' ? `Pre-orders for ${title} are open.` : `${title} is here.`;
  return {
    from: emailFromHeader(settings.email),
    to,
    subject: state === 'presale' ? `Pre-orders open: ${product.title}` : `Now available: ${product.title}`,
    replyTo: settings.email.replyTo || undefined,
    html: `<!doctype html><html><body style="margin:0;background:#f6f4f0;font-family:Helvetica,Arial,sans-serif;color:#141414">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff">
<p style="letter-spacing:.2em;font-size:12px;margin:0 0 24px">NOWHENCE</p>
<h1 style="font-size:20px;font-weight:600;margin:0 0 16px">${lead}</h1>
<p style="font-size:14px">You asked us to tell you first.</p>
<p><a href="${url}" style="display:inline-block;background:#141414;color:#ffffff;padding:12px 20px;text-decoration:none;font-size:14px">${state === 'presale' ? 'Pre-order now' : 'Shop now'}</a></p>
<p style="font-size:12px;color:#6b6b6b;margin-top:32px">You are receiving this because you signed up for updates on this piece.</p>
</div></body></html>`,
  };
}

export class LaunchEmailError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Email the product's notify list once per launch. The send is claimed first
 * with writeJsonCas on launch-emails.json, so double clicks and concurrent
 * admins cannot send twice. Subscribers are then marked notified.
 */
export async function emailNotifyList(
  productId: string,
  by: string,
  deps: { send?: typeof sendEmail; now?: Date } = {},
): Promise<{ key: string; sent: number; failed: number }> {
  const now = deps.now ?? new Date();
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const product = cat.products.find((p) => p.id === productId);
  if (!product) throw new LaunchEmailError('Unknown product', 404);
  const r = resolveLaunch(product, cat.drops, settings.launches, now);
  if (r.state !== 'presale' && r.state !== 'available') throw new LaunchEmailError('Only email the list once the piece is in presale or available.', 400);
  const key = launchKey(product, cat.drops, settings.launches, now);
  const subs = (await readProductNotifyList(productId)).filter((s) => !s.notifiedAt);
  const recipients = [...new Set(subs.map((s) => s.email))];

  await writeJsonCas(
    LAUNCH_EMAILS_KEY,
    LaunchEmailsDoc,
    (cur) => {
      const doc = cur ?? { sends: [] };
      if (doc.sends.some((s) => s.key === key)) throw new LaunchEmailError('The list was already emailed for this launch.', 409);
      return { sends: [...doc.sends, { key, at: now.toISOString(), by, recipients }].slice(-500) };
    },
    { initial: () => ({ sends: [] }) },
  );

  const send = deps.send ?? sendEmail;
  const ok = new Set<string>();
  let failed = 0;
  for (const to of recipients) {
    const res = await send(renderLaunchEmail(product, r.state, settings, to));
    if (res.sent || res.reason === 'no_key') ok.add(to);
    else failed++;
  }
  const at = now.toISOString();
  await writeJsonCas(productNotifyKey(productId), NotifyDoc, (cur) => ({
    subscribers: (cur?.subscribers ?? []).map((s) => (ok.has(s.email) && !s.notifiedAt ? { ...s, notifiedAt: at } : s)),
  }));
  return { key, sent: ok.size, failed };
}

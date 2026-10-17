// Brand layout for transactional email ("the care label"). Pure HTML strings,
// table-based and inline-styled so it survives Gmail, Outlook and Apple Mail.

export const EMAIL_COLORS = {
  paper: '#F4F4F2',
  card: '#FFFFFF',
  ink: '#0B0B0B',
  muted: '#6B6B67',
  line: '#DEDDD8',
  clay: '#A8927A',
  claySoft: '#E6DFD5',
} as const;

const C = EMAIL_COLORS;
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const SITE = 'https://nowhenceclothings.com';

/** Tracked micro caps, the brand's only ornament. */
export function emailLabel(text: string, color: string = C.muted): string {
  return `<p style="margin:0 0 8px;font:500 10px/16px ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${color}">${text}</p>`;
}

/** Primary action: square ink block with tracked caps. */
export function emailButton(href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr>` +
    `<td style="background:${C.ink}"><a href="${href}" style="display:inline-block;padding:14px 28px;font:500 11px/16px ${SANS};letter-spacing:.18em;text-transform:uppercase;color:#FFFFFF;text-decoration:none">${label}</a></td>` +
    `</tr></table>`
  );
}

/** A hairline-boxed note (pre-order, deposit terms). */
export function emailNote(html: string): string {
  return `<div style="margin:20px 0;padding:14px 16px;border:1px solid ${C.line};background:${C.paper};font:400 14px/22px ${SANS};color:${C.ink}">${html}</div>`;
}

/** Wraps a title and body in the full branded document. */
export function emailLayout(title: string, body: string, opts: { preheader?: string } = {}): string {
  const pre = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 28px"><a href="${SITE}" style="font:500 13px/16px ${SANS};letter-spacing:.42em;color:${C.ink};text-decoration:none">NOWHENCE</a></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};padding:40px 32px;font:400 15px/24px ${SANS};color:${C.ink}">
<h1 style="margin:0 0 20px;font:300 26px/32px ${SANS};letter-spacing:-.01em;color:${C.ink}">${title}</h1>
${body}
</td></tr>
<tr><td style="padding:24px 8px 0;font:400 12px/18px ${SANS};color:${C.muted};text-align:center">
Questions? Reply to this email and a person will answer.<br>
<a href="${SITE}" style="color:${C.muted};text-decoration:underline">nowhenceclothings.com</a>
</td></tr>
<tr><td align="center" style="padding:20px 0 0"><span style="display:inline-block;width:18px;height:18px;border:1px solid ${C.clay};border-radius:50%"></span></td></tr>
</table></td></tr></table></body></html>`;
}

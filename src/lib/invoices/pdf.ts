// A14: render an InvoiceDoc to PDF with pdf-lib (runs on Workers). Standard
// Helvetica has no ₹ glyph, so amounts are written "Rs." on the document.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { InvoiceDoc } from '@/lib/schemas/invoices';
import { KIND_TITLES } from './compute';
import { formatAmount } from './gst';

const INK = rgb(0.043, 0.043, 0.043);
const MUTED = rgb(0.42, 0.42, 0.4);
const RULE = rgb(0.82, 0.82, 0.8);
const W = 595.28;
const H = 841.89;
const M = 44;

/** Strip characters WinAnsi (standard fonts) cannot encode. */
export function pdfSafe(s: string): string {
  return s
    .replace(/₹/g, 'Rs.')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of pdfSafe(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export async function renderInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${KIND_TITLES[doc.kind]} ${doc.number}`);
  pdf.setAuthor(doc.seller.legalName);
  pdf.setCreationDate(new Date(doc.issuedAt));
  pdf.setModificationDate(new Date(doc.issuedAt));
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: typeof INK; right?: boolean; spacing?: number } = {}) => {
    const size = o.size ?? 8.5;
    const font = o.font ?? reg;
    const t = pdfSafe(s);
    const w = font.widthOfTextAtSize(t, size) + (o.spacing ?? 0) * t.length;
    let cx = o.right ? x - w : x;
    if (!o.spacing) {
      page.drawText(t, { x: cx, y: yy, size, font, color: o.color ?? INK });
      return;
    }
    for (const ch of t) {
      page.drawText(ch, { x: cx, y: yy, size, font, color: o.color ?? INK });
      cx += font.widthOfTextAtSize(ch, size) + o.spacing;
    }
  };
  const hr = (yy: number, weight = 0.5, color = RULE) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: weight, color });
  const ensure = (need: number) => {
    if (y - need < M + 40) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  // Header
  text('NOWHENCE', M, y - 4, { size: 13, font: bold, spacing: 3.2 });
  text(KIND_TITLES[doc.kind].toUpperCase(), W - M, y - 2, { size: 9, font: bold, right: true, spacing: 1.6 });
  text(doc.kind === 'invoice' ? 'Original for recipient' : ' ', W - M, y - 14, { size: 7, color: MUTED, right: true });
  y -= 34;
  hr(y, 0.8, INK);
  y -= 18;

  // Meta + seller
  const col2 = W / 2 + 10;
  const meta: [string, string][] = [
    ['Number', doc.number],
    ['Date', fmtDate(doc.issuedAt)],
    [doc.source.type === 'order' ? 'Order' : 'Booking', doc.source.number],
    ['Place of supply', `${doc.placeOfSupply.state}${doc.placeOfSupply.code ? ` (${doc.placeOfSupply.code})` : ''}`],
    ...(doc.reference ? ([[doc.kind === 'credit_note' ? 'Against' : 'Advance receipt', doc.reference]] as [string, string][]) : []),
  ];
  let yl = y;
  text('SOLD BY', M, yl, { size: 6.5, color: MUTED, spacing: 1.2 });
  yl -= 12;
  text(doc.seller.legalName, M, yl, { font: bold, size: 9 });
  yl -= 11;
  for (const l of wrap(doc.seller.address, reg, 8, W / 2 - M - 10)) {
    if (!l) continue;
    text(l, M, yl, { size: 8, color: MUTED });
    yl -= 10;
  }
  if (doc.seller.gstin) {
    text(`GSTIN ${doc.seller.gstin}`, M, yl, { size: 8 });
    yl -= 10;
  }
  if (doc.seller.state) {
    text(`State ${doc.seller.state} (${doc.seller.stateCode})`, M, yl, { size: 8, color: MUTED });
    yl -= 10;
  }
  let yr = y;
  for (const [k, v] of meta) {
    text(k, col2, yr, { size: 7.5, color: MUTED });
    text(v, W - M, yr, { size: 8.5, right: true });
    yr -= 12;
  }
  y = Math.min(yl, yr) - 10;
  hr(y);
  y -= 16;

  // Buyer
  const addr = (a: InvoiceDoc['buyer']['billing']) =>
    [a.name, a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter((s) => s && s !== '—').join('\n');
  const block = (title: string, body: string, x: number, yy: number) => {
    text(title, x, yy, { size: 6.5, color: MUTED, spacing: 1.2 });
    let yy2 = yy - 12;
    for (const l of wrap(body, reg, 8.5, W / 2 - M - 10)) {
      text(l, x, yy2, { size: 8.5 });
      yy2 -= 11;
    }
    return yy2;
  };
  const b1 = block(
    'BILL TO',
    `${addr(doc.buyer.billing)}${doc.buyer.gstin ? `\nGSTIN ${doc.buyer.gstin}` : ''}\n${doc.buyer.email} · ${doc.buyer.phone}`,
    M,
    y,
  );
  const b2 = block('SHIP TO', addr(doc.buyer.shipping), col2, y);
  y = Math.min(b1, b2) - 8;

  // Lines table
  const showSplit = doc.intraState;
  const cols = showSplit
    ? [
        { h: 'Description', x: M, w: 168 },
        { h: 'HSN/SAC', x: M + 172, w: 44 },
        { h: 'Qty', x: M + 240, r: true },
        { h: 'Taxable', x: M + 300, r: true },
        { h: 'Rate', x: M + 330, r: true },
        { h: 'CGST', x: M + 380, r: true },
        { h: 'SGST', x: M + 430, r: true },
        { h: 'Amount', x: W - M, r: true },
      ]
    : [
        { h: 'Description', x: M, w: 200 },
        { h: 'HSN/SAC', x: M + 206, w: 44 },
        { h: 'Qty', x: M + 276, r: true },
        { h: 'Taxable', x: M + 346, r: true },
        { h: 'Rate', x: M + 380, r: true },
        { h: 'IGST', x: M + 440, r: true },
        { h: 'Amount', x: W - M, r: true },
      ];
  ensure(40);
  hr(y + 4, 0.8, INK);
  y -= 8;
  for (const c of cols) text(c.h.toUpperCase(), c.x, y, { size: 6.5, color: MUTED, right: !!c.r, spacing: 0.8 });
  y -= 8;
  hr(y);
  y -= 13;
  for (const l of doc.lines) {
    const desc = wrap(l.description + (l.discount ? ` (less discount Rs. ${formatAmount(l.discount)})` : ''), reg, 8, cols[0]!.w!);
    ensure(desc.length * 10 + 10);
    const vals = showSplit
      ? [l.hsn, String(l.qty), formatAmount(l.taxable), `${l.ratePercent / 2}+${l.ratePercent / 2}%`, formatAmount(l.cgst), formatAmount(l.sgst), formatAmount(l.total)]
      : [l.hsn, String(l.qty), formatAmount(l.taxable), `${l.ratePercent}%`, formatAmount(l.igst), formatAmount(l.total)];
    desc.forEach((d, i) => text(d, M, y - i * 10, { size: 8 }));
    vals.forEach((v, i) => text(v, cols[i + 1]!.x, y, { size: 8, right: !!cols[i + 1]!.r }));
    y -= Math.max(desc.length, 1) * 10 + 6;
    hr(y + 2);
    y -= 10;
  }

  // Totals
  ensure(120);
  const row = (k: string, v: string, strong = false) => {
    text(k, col2, y, { size: strong ? 9 : 8, font: strong ? bold : reg, color: strong ? INK : MUTED });
    text(v, W - M, y, { size: strong ? 9.5 : 8.5, font: strong ? bold : reg, right: true });
    y -= strong ? 16 : 12;
  };
  y -= 2;
  row('Taxable value', `Rs. ${formatAmount(doc.totals.taxable)}`);
  if (doc.totals.cgst || doc.totals.sgst) {
    row('CGST', `Rs. ${formatAmount(doc.totals.cgst)}`);
    row('SGST', `Rs. ${formatAmount(doc.totals.sgst)}`);
  }
  if (doc.totals.igst) row('IGST', `Rs. ${formatAmount(doc.totals.igst)}`);
  row(doc.kind === 'credit_note' ? 'Credit total' : 'Total', `Rs. ${formatAmount(doc.totals.total)}`, !doc.advanceAdjusted);
  if (doc.advanceAdjusted) {
    row('Less advance received', `- Rs. ${formatAmount(doc.advanceAdjusted)}`);
    row('Balance paid', `Rs. ${formatAmount(doc.amountPayable)}`, true);
  }
  y -= 4;
  for (const l of wrap(doc.amountInWords, bold, 8, W - 2 * M)) {
    text(l, M, y, { size: 8, font: bold });
    y -= 11;
  }
  y -= 6;
  for (const n of doc.notes) {
    for (const l of wrap(n, reg, 7.5, W - 2 * M)) {
      ensure(12);
      text(l, M, y, { size: 7.5, color: MUTED });
      y -= 10;
    }
  }
  y -= 18;
  ensure(40);
  text(`For ${doc.seller.legalName}`, W - M, y, { size: 8, right: true });
  text('Computer-generated document; no signature required.', W - M, y - 12, { size: 7, color: MUTED, right: true });

  // Footer on every page
  pdf.getPages().forEach((p, i, all) => {
    p.drawLine({ start: { x: M, y: M - 6 }, end: { x: W - M, y: M - 6 }, thickness: 0.5, color: RULE });
    p.drawText(pdfSafe(`${doc.number}  ·  nowhenceclothings.com`), { x: M, y: M - 18, size: 6.5, font: reg, color: MUTED });
    const pg = `${i + 1} / ${all.length}`;
    p.drawText(pg, { x: W - M - reg.widthOfTextAtSize(pg, 6.5), y: M - 18, size: 6.5, font: reg, color: MUTED });
  });
  return pdf.save({ useObjectStreams: false });
}

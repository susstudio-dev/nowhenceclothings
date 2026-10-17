// Minimal, safe markdown parser for static/editorial copy (WS-E).
// Produces a plain tree that React renders as elements — never raw HTML — so
// admin-edited copy cannot inject markup. Supports: #/##/### headings,
// paragraphs, - / 1. lists, **bold**, *italic*, [links](href).

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; v: string }
  | { t: 'em'; v: string }
  | { t: 'link'; v: string; href: string };

export type MdBlock =
  | { t: 'h'; level: 2 | 3 | 4; inline: Inline[] }
  | { t: 'p'; inline: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] };

/** Only same-site paths, https and mailto/tel links survive. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (h.startsWith('#')) return h;
  if (/^(https:|mailto:|tel:)/i.test(h)) return h;
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'strong', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'em', v: m[2] });
    else {
      const href = safeHref(m[4]);
      out.push(href ? { t: 'link', v: m[3], href } : { t: 'text', v: m[3] });
    }
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
  return out;
}

export function parseMarkdown(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let list: { t: 'ul' | 'ol'; items: Inline[][] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ t: 'p', inline: parseInline(para.join(' ')) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ t: 'h', level: (h[1].length + 1) as 2 | 3 | 4, inline: parseInline(h[2]) });
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (!list || list.t !== kind) {
        flushList();
        list = { t: kind, items: [] };
      }
      list.items.push(parseInline((ul ?? ol)![1]));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/** Replace `{{key}}` tokens; unknown or empty values become `[[TBD]]`. */
export function fillTemplate(text: string, vars: Record<string, string | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k]?.trim() || '[[TBD]]');
}

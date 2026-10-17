import Link from 'next/link';
import type { ReactNode } from 'react';

// Minimal, safe Markdown subset for admin rich text: #/##/### headings,
// paragraphs, "- " lists, **bold**, *italic*, [text](href). No raw HTML.

function safeHref(href: string): string | null {
  return /^(\/|https?:\/\/|mailto:)/i.test(href) ? href : null;
}

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k}>{m[2]}</em>);
    else {
      const href = safeHref(m[4]);
      if (!href) out.push(m[3]);
      else if (href.startsWith('/')) out.push(<Link key={k} href={href} className="underline">{m[3]}</Link>);
      else out.push(<a key={k} href={href} className="underline" rel="noopener noreferrer" target="_blank">{m[3]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className ?? 'space-y-4 leading-relaxed'}>
      {blocks.map((b, i) => {
        const h = /^(#{1,3})\s+(.*)$/.exec(b);
        if (h) {
          const level = h[1].length;
          const cls = level === 1 ? 'font-display text-3xl' : level === 2 ? 'font-display text-2xl' : 'text-lg font-medium';
          const Tag = (`h${level + 1}`) as 'h2' | 'h3' | 'h4';
          return <Tag key={i} className={cls}>{inline(h[2], i)}</Tag>;
        }
        const lines = b.split('\n');
        if (lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*]\s+/, ''), i * 100 + j)}</li>)}
            </ul>
          );
        }
        return <p key={i}>{inline(lines.join(' '), i)}</p>;
      })}
    </div>
  );
}

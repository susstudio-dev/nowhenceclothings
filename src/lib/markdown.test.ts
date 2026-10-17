import { describe, expect, it } from 'vitest';
import { fillTemplate, parseInline, parseMarkdown, safeHref } from './markdown';

describe('markdown', () => {
  it('parses headings, paragraphs and lists', () => {
    const b = parseMarkdown('# Title\n\nOne\ntwo\n\n- a\n- b\n1. c');
    expect(b.map((x) => x.t)).toEqual(['h', 'p', 'ul', 'ol']);
    expect(b[1]).toEqual({ t: 'p', inline: [{ t: 'text', v: 'One two' }] });
  });

  it('parses inline marks and drops unsafe links', () => {
    const out = parseInline('**b** *i* [ok](/x) [bad](javascript:void)');
    expect(out).toContainEqual({ t: 'strong', v: 'b' });
    expect(out).toContainEqual({ t: 'em', v: 'i' });
    expect(out).toContainEqual({ t: 'link', v: 'ok', href: '/x' });
    expect(out).toContainEqual({ t: 'text', v: 'bad' });
    expect(out.some((n) => n.t === 'link' && n.href.startsWith('javascript'))).toBe(false);
    expect(safeHref('//evil.test')).toBeNull();
    expect(safeHref('http://x')).toBeNull();
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
  });

  it('fills templates, using [[TBD]] for blanks', () => {
    expect(fillTemplate('{{a}} {{b}} {{c}}', { a: 'x', b: ' ' })).toBe('x [[TBD]] [[TBD]]');
  });
});

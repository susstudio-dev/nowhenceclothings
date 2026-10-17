'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SiteContentDoc } from '@/lib/schemas/site-content';
import { CONTENT_SECTIONS, type ContentSection } from '@/lib/admin/content';
import { Button, Input } from '@/components/ui';
import { adminFetch } from './api-client';

type Version = { key: string; at: string };
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const SECTION_LABELS: Record<ContentSection, string> = {
  announcement: 'Announcement bar',
  nav: 'Navigation',
  home: 'Home page',
  pages: 'Static pages',
  lookbook: 'Lookbook',
  journal: 'Journal',
};

const AUTOSAVE_MS = 1500;

/**
 * A6 content studio (furor pattern): edits go to the DRAFT with debounced
 * autosave; Preview renders the draft; Publish snapshots live into
 * versions/ and copies the draft over it; any version can be restored into
 * the draft. Structured sections are edited as validated JSON.
 */
export function ContentEditor({
  initial,
  initialChanged,
  versions: initialVersions,
  canPublish,
}: {
  initial: SiteContentDoc;
  initialChanged: ContentSection[];
  versions: Version[];
  canPublish: boolean;
}) {
  const [doc, setDoc] = useState(initial);
  const [tab, setTab] = useState<ContentSection>('announcement');
  const [text, setText] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState('');
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(initialChanged);
  const [versions, setVersions] = useState(initialVersions);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(doc);

  const save = useCallback(async () => {
    setState('saving');
    const sent = latest.current;
    try {
      const res = await adminFetch<{ draft: SiteContentDoc; changed: ContentSection[] }>('/api/admin/content', {
        method: 'PUT',
        body: sent,
      });
      setChanged(res.changed);
      // Edits made while this save was in flight are picked up by their own timer.
      setState(latest.current === sent ? 'saved' : 'dirty');
      setError('');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Autosave failed');
    }
  }, []);

  function update(next: SiteContentDoc) {
    latest.current = next;
    setDoc(next);
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === 'dirty' || state === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  function sectionText(s: ContentSection) {
    return text[s] ?? JSON.stringify(doc[s], null, 2);
  }

  function onJson(s: ContentSection, value: string) {
    setText((t) => ({ ...t, [s]: value }));
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (e) {
      setJsonError(`JSON: ${e instanceof Error ? e.message : 'invalid'}`);
      return;
    }
    const res = SiteContentDoc.safeParse({ ...doc, [s]: parsed });
    if (!res.success) {
      const i = res.error.issues[0];
      setJsonError(`${i.path.join('.')}: ${i.message}`);
      return;
    }
    setJsonError('');
    update(res.data);
  }

  async function publish() {
    const warnings: string[] = [];
    if (doc.home.blocks.length === 0) warnings.push('- The home page has NO blocks (the site will fall back to the default home).');
    if (doc.nav.primary.length === 0) warnings.push('- The primary navigation is EMPTY (the site will fall back to the default menu).');
    const msg = warnings.length
      ? `Warning:\n${warnings.join('\n')}\n\nPublish the draft to the live site anyway?`
      : 'Publish the draft to the live site?';
    if (!window.confirm(msg)) return;
    if (timer.current) clearTimeout(timer.current);
    if (state !== 'saved') await save();
    try {
      await adminFetch('/api/admin/content/publish', { method: 'POST' });
      setChanged([]);
      const { versions: v } = await adminFetch<{ versions: Version[] }>('/api/admin/content/versions');
      setVersions(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    }
  }

  async function restore(key: string) {
    if (!window.confirm('Replace the current draft with this version? (The live site is unchanged until you publish.)')) return;
    try {
      const { draft } = await adminFetch<{ draft: SiteContentDoc }>('/api/admin/content/versions', { body: { key } });
      latest.current = draft;
      setDoc(draft);
      setText({});
      setState('saved');
      setChanged(CONTENT_SECTIONS.slice());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    }
  }

  const a = doc.announcement;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-4">
        <div role="tablist" className="flex flex-wrap gap-2 border-b border-line">
          {CONTENT_SECTIONS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={tab === s}
              type="button"
              onClick={() => {
                setTab(s);
                setJsonError('');
              }}
              className={`px-3 py-2 text-sm ${tab === s ? 'border-b-2 border-ink' : 'text-muted'}`}
            >
              {SECTION_LABELS[s]}
              {changed.includes(s) && <span className="ml-1 text-accent" aria-label="unpublished changes">•</span>}
            </button>
          ))}
        </div>

        {tab === 'announcement' ? (
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={a.enabled} onChange={(e) => update({ ...doc, announcement: { ...a, enabled: e.target.checked } })} />
              Show announcement bar
            </label>
            <Input label="Text" value={a.text} maxLength={160} onChange={(e) => update({ ...doc, announcement: { ...a, text: e.target.value } })} />
            <Input
              label="Link (optional)"
              value={a.href ?? ''}
              onChange={(e) => update({ ...doc, announcement: { ...a, href: e.target.value || undefined } })}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Edit as JSON. Blocks: hero, richText, image, gallery, productGrid, featuredDrop, categoryTiles, story, quote,
              faq, newsletter. Changes autosave once valid.
            </p>
            <textarea
              aria-label={`${SECTION_LABELS[tab]} JSON`}
              spellCheck={false}
              rows={28}
              value={sectionText(tab)}
              onChange={(e) => onJson(tab, e.target.value)}
              className="w-full border border-line bg-paper p-3 font-mono text-xs focus:border-ink focus:outline-none"
            />
            {jsonError && (
              <p role="alert" className="text-xs text-sale">
                {jsonError} — not saved
              </p>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4 text-sm">
        <p role="status">
          Draft:{' '}
          {state === 'saved' ? 'saved' : state === 'saving' ? 'saving…' : state === 'dirty' ? 'unsaved changes' : 'save failed'}
        </p>
        {error && <p className="text-sale">{error}</p>}
        <div className="flex flex-col gap-2">
          <a href="/admin/content/preview" target="_blank" rel="noreferrer" className="underline">
            Preview draft
          </a>
          {canPublish ? (
            <Button onClick={publish} disabled={!changed.length && state === 'saved'}>
              Publish{changed.length ? ` (${changed.length})` : ''}
            </Button>
          ) : (
            <p className="text-muted">A manager or owner publishes drafts.</p>
          )}
        </div>
        <div>
          <h2 className="mb-2 font-medium">Version history</h2>
          {versions.length === 0 && <p className="text-muted">No published versions yet.</p>}
          <ul className="space-y-1">
            {versions.map((v) => (
              <li key={v.key} className="flex justify-between gap-2">
                <time dateTime={v.at}>{v.at.slice(0, 16).replace('T', ' ')}</time>
                <button type="button" className="underline" onClick={() => restore(v.key)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

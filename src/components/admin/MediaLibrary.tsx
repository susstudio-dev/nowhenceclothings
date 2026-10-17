'use client';

import { useRef, useState } from 'react';
import type { MediaLibraryItem } from '@/lib/schemas/media';
import { searchLibrary } from '@/lib/admin/media-library';
import { adminFetch } from './api-client';
import { mediaPreviewSrc, uploadImage } from './MediaUploader';
import { useMediaLibrary } from './MediaPicker';

/** A9c media library: upload, edit alt text, copy a reference for reuse. */
export function MediaLibrary() {
  const lib = useMediaLibrary();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    try {
      for (const f of Array.from(files)) await uploadImage(f);
      await lib.reload();
      setMsg({ ok: true, text: `Uploaded ${files.length} image${files.length === 1 ? '' : 's'}` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveAlt(item: MediaLibraryItem, alt: string) {
    if (alt === item.alt) return;
    try {
      const r = await adminFetch<{ item: MediaLibraryItem }>('/api/admin/media', { method: 'PATCH', body: { id: item.id, alt } });
      lib.setItems((cur) => cur?.map((x) => (x.id === item.id ? r.item : x)) ?? cur);
      setMsg({ ok: true, text: 'Alt text saved' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    }
  }

  const items = lib.items ? searchLibrary(lib.items, q) : null;
  const sel = lib.items?.find((x) => x.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer border border-ink px-4 py-2 text-sm">
          {busy ? 'Uploading…' : 'Upload images'}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        <input
          type="search"
          aria-label="Search media"
          placeholder="Search name, alt text or id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-60 flex-1 border border-line px-3 py-2 text-sm"
        />
        {msg && (
          <span role="status" className={msg.ok ? 'text-sm' : 'text-sm text-sale'}>
            {msg.text}
          </span>
        )}
      </div>
      {lib.error && <p className="text-sm text-sale">{lib.error}</p>}
      {sel && (
        <div className="space-y-1 border border-line p-3 text-sm">
          <p>
            Reuse <b>{sel.name || sel.id}</b>: pick it with “Choose from library” in Settings, or paste this reference.
          </p>
          <code className="block overflow-auto whitespace-pre bg-paper-deep/60 p-2 text-xs">
            {JSON.stringify({ id: sel.id, alt: sel.alt, width: sel.width, height: sel.height, widths: sel.widths })}
          </code>
          <button
            type="button"
            className="underline"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(JSON.stringify({ id: sel.id, alt: sel.alt, width: sel.width, height: sel.height, widths: sel.widths }))
                .then(() => setMsg({ ok: true, text: 'Reference copied' }))
            }
          >
            Copy reference
          </button>
        </div>
      )}
      {items === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">{q ? 'No matches.' : 'No images yet. Uploads from products and settings also appear here.'}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((m) => (
            <li key={m.id} className={`space-y-1 border p-2 ${selected === m.id ? 'border-ink' : 'border-line'}`}>
              <button type="button" className="block w-full" onClick={() => setSelected(m.id)} aria-label={`Select ${m.name || m.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaPreviewSrc(m)} alt={m.alt} className="aspect-square w-full bg-paper-deep/50 object-contain" loading="lazy" />
              </button>
              <p className="truncate text-xs text-muted" title={m.id}>
                {m.name || m.id} · {m.width}×{m.height}
              </p>
              <input
                aria-label={`Alt text for ${m.name || m.id}`}
                placeholder="Alt text (describe the image)"
                defaultValue={m.alt}
                onBlur={(e) => void saveAlt(m, e.target.value)}
                className={`w-full border px-1 py-0.5 text-xs ${m.alt ? 'border-line' : 'border-sale'}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

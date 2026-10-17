'use client';

import { useEffect, useRef, useState } from 'react';
import type { MediaRef } from '@/lib/schemas/common';
import type { MediaLibraryItem } from '@/lib/schemas/media';
import { searchLibrary, toMediaRef } from '@/lib/admin/media-library';
import { adminFetch } from './api-client';
import { mediaPreviewSrc, uploadImage } from './MediaUploader';

/** Load the media library (A9c). */
export function useMediaLibrary(enabled = true) {
  const [items, setItems] = useState<MediaLibraryItem[] | null>(null);
  const [error, setError] = useState('');
  const reload = async () => {
    try {
      const r = await adminFetch<{ items: MediaLibraryItem[] }>('/api/admin/media');
      setItems(r.items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load media');
    }
  };
  useEffect(() => {
    if (enabled) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return { items, error, reload, setItems };
}

/**
 * Single-image field: shows the current image, lets the owner pick one from
 * the media library or upload a new one (which joins the library).
 */
export function MediaPickerField({
  label,
  value,
  onChange,
  disabled,
  hint,
  previewClassName = 'h-16 w-auto max-w-[12rem] object-contain',
}: {
  label: string;
  value: MediaRef | undefined;
  onChange: (next: MediaRef | undefined) => void;
  disabled?: boolean;
  hint?: string;
  previewClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lib = useMediaLibrary(open);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      const m = await uploadImage(f, value?.alt ?? '');
      onChange(m);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-h-16 min-w-24 items-center justify-center border border-line bg-paper-deep/50 p-2">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaPreviewSrc(value)} alt={value.alt} className={previewClassName} />
          ) : (
            <span className="text-xs text-muted">None</span>
          )}
        </div>
        <button type="button" disabled={disabled} className="border border-line px-3 py-1.5 text-sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close library' : 'Choose from library'}
        </button>
        <label className={`cursor-pointer border border-dashed border-line px-3 py-1.5 text-sm ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? 'Uploading…' : 'Upload new'}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {value && !disabled && (
          <button type="button" className="text-sm text-sale" onClick={() => onChange(undefined)}>
            Remove
          </button>
        )}
      </div>
      {value && (
        <input
          aria-label={`${label} alt text`}
          placeholder="Alt text"
          disabled={disabled}
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          className="w-full max-w-sm border border-line px-2 py-1 text-sm"
        />
      )}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {(err || lib.error) && <p className="text-xs text-sale">{err || lib.error}</p>}
      {open && (
        <div className="space-y-2 border border-line p-3">
          <input
            type="search"
            aria-label="Search media"
            placeholder="Search by name or alt text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full border border-line px-2 py-1 text-sm"
          />
          {lib.items === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : lib.items.length === 0 ? (
            <p className="text-sm text-muted">The library is empty. Upload an image.</p>
          ) : (
            <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-auto sm:grid-cols-5">
              {searchLibrary(lib.items, q).map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(toMediaRef(m));
                      setOpen(false);
                    }}
                    aria-pressed={value?.id === m.id}
                    className={`block w-full border p-1 ${value?.id === m.id ? 'border-ink' : 'border-line'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaPreviewSrc(m)} alt={m.alt || m.name} className="aspect-square w-full object-contain" />
                    <span className="block truncate text-[10px] text-muted">{m.name || m.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

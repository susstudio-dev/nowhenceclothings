'use client';

import { useRef, useState } from 'react';
import type { MediaRef } from '@/lib/schemas/common';
import { MEDIA_WIDTHS, targetWidths } from '@/lib/admin/media';
import { moveItem } from '@/lib/admin/catalogue-mutations';
import { adminFetch } from './api-client';

/** Encode one width in the browser. Returns null when the format is unsupported. */
async function encode(bitmap: ImageBitmap, width: number, type: 'image/webp' | 'image/avif'): Promise<Blob | null> {
  const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type, quality: type === 'image/avif' ? 0.6 : 0.82 });
  // Browsers that cannot encode a type silently return PNG.
  return blob.type === type ? blob : null;
}

/** Resize in the browser (furor pattern), post every variant, get a MediaRef. */
export async function uploadImage(file: File, alt = ''): Promise<MediaRef> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    throw new Error('This browser cannot prepare images. Use a recent Chrome, Edge, Firefox or Safari.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const form = new FormData();
    const widths = targetWidths(bitmap.width, MEDIA_WIDTHS);
    for (const w of widths) {
      const webp = await encode(bitmap, w, 'image/webp');
      if (!webp) throw new Error('This browser cannot encode WebP');
      form.append(`w${w}.webp`, webp, `${w}.webp`);
      const avif = await encode(bitmap, w, 'image/avif');
      if (avif) form.append(`w${w}.avif`, avif, `${w}.avif`);
    }
    form.append('width', String(bitmap.width));
    form.append('height', String(bitmap.height));
    form.append('alt', alt);
    form.append('name', file.name);
    const { media } = await adminFetch<{ media: MediaRef }>('/api/admin/media', { form });
    return media;
  } finally {
    bitmap.close();
  }
}

export function mediaPreviewSrc(m: MediaRef): string {
  if (m.src) return m.src;
  const w = m.widths.find((x) => x >= 400) ?? m.widths[m.widths.length - 1] ?? 0;
  return `/media/${m.id}/${w}.webp`;
}

/**
 * Image list editor: upload, drag (or arrow-button) reorder, alt text, remove.
 * The first image is the primary one.
 */
export function MediaListEditor({
  value,
  onChange,
  label = 'Images',
  defaultAlt = '',
}: {
  value: MediaRef[];
  onChange: (next: MediaRef[]) => void;
  label?: string;
  defaultAlt?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dragFrom = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    const added: MediaRef[] = [];
    try {
      for (const f of Array.from(files)) added.push(await uploadImage(f, defaultAlt));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      if (added.length) onChange([...value, ...added]);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <ul className="flex flex-wrap gap-3">
        {value.map((m, i) => (
          <li
            key={m.id}
            draggable
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom.current !== null) onChange(moveItem(value, dragFrom.current, i));
              dragFrom.current = null;
            }}
            className="w-36 space-y-1 border border-line p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaPreviewSrc(m)} alt={m.alt} className="aspect-[4/5] w-full cursor-move object-cover" />
            <input
              aria-label={`Alt text for image ${i + 1}`}
              placeholder="Alt text"
              value={m.alt}
              onChange={(e) => onChange(value.map((x) => (x.id === m.id ? { ...x, alt: e.target.value } : x)))}
              className="w-full border border-line px-1 py-0.5 text-xs"
            />
            <div className="flex justify-between text-xs">
              <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => onChange(moveItem(value, i, i - 1))}>
                ←
              </button>
              <button type="button" className="text-sale" onClick={() => onChange(value.filter((x) => x.id !== m.id))}>
                Remove
              </button>
              <button
                type="button"
                aria-label="Move right"
                disabled={i === value.length - 1}
                onClick={() => onChange(moveItem(value, i, i + 1))}
              >
                →
              </button>
            </div>
          </li>
        ))}
      </ul>
      <label className="inline-block cursor-pointer border border-dashed border-line px-3 py-2 text-sm">
        {busy ? 'Uploading…' : 'Add images'}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
      {error && <p className="text-xs text-sale">{error}</p>}
    </fieldset>
  );
}

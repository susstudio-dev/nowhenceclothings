// Pure media-library mutations (A9c). Newest first; ids unique.
import type { MediaRef } from '@/lib/schemas/common';
import type { MediaLibraryDoc, MediaLibraryItem } from '@/lib/schemas/media';

export const MAX_LIBRARY_ITEMS = 5000;

/** Add (or replace by id) an uploaded image at the top of the library. */
export function addToLibrary(
  doc: MediaLibraryDoc,
  media: MediaRef,
  meta: { name?: string; uploadedAt: string; uploadedBy?: string },
): MediaLibraryDoc {
  const item: MediaLibraryItem = { ...media, name: meta.name ?? '', uploadedAt: meta.uploadedAt, uploadedBy: meta.uploadedBy ?? '' };
  return { items: [item, ...doc.items.filter((x) => x.id !== media.id)].slice(0, MAX_LIBRARY_ITEMS) };
}

/** Set alt text on one item. Throws when the id is unknown. */
export function setLibraryAlt(doc: MediaLibraryDoc, id: string, alt: string): MediaLibraryDoc {
  if (!doc.items.some((x) => x.id === id)) throw new Error(`Unknown media ${id}`);
  const clean = alt.replace(/\s+/g, ' ').trim().slice(0, 300);
  return { items: doc.items.map((x) => (x.id === id ? { ...x, alt: clean } : x)) };
}

/** Strip library-only fields to get a MediaRef to embed elsewhere. */
export function toMediaRef(item: MediaLibraryItem): MediaRef {
  const { name: _n, uploadedAt: _u, uploadedBy: _b, ...ref } = item;
  return ref;
}

/** Case-insensitive search on name, alt and id. */
export function searchLibrary(items: MediaLibraryItem[], q: string): MediaLibraryItem[] {
  const t = q.trim().toLowerCase();
  if (!t) return items;
  return items.filter((x) => `${x.name} ${x.alt} ${x.id}`.toLowerCase().includes(t));
}

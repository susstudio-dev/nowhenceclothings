import { describe, expect, it } from 'vitest';
import { MediaLibraryDoc } from '@/lib/schemas/media';
import { addToLibrary, searchLibrary, setLibraryAlt, toMediaRef } from './media-library';

const ref = (id: string) => ({ id, alt: '', width: 800, height: 1000, widths: [480, 800] });

describe('media library', () => {
  it('adds newest first and replaces duplicates', () => {
    let doc = MediaLibraryDoc.parse({});
    doc = addToLibrary(doc, ref('a'), { uploadedAt: '1' });
    doc = addToLibrary(doc, ref('b'), { uploadedAt: '2', name: 'Shirt.jpg' });
    doc = addToLibrary(doc, ref('a'), { uploadedAt: '3' });
    expect(doc.items.map((x) => x.id)).toEqual(['a', 'b']);
    expect(MediaLibraryDoc.parse(doc)).toEqual(doc);
  });

  it('edits alt text and rejects unknown ids', () => {
    const doc = addToLibrary({ items: [] }, ref('a'), { uploadedAt: '1' });
    expect(setLibraryAlt(doc, 'a', '  Ecru  tee ').items[0].alt).toBe('Ecru tee');
    expect(() => setLibraryAlt(doc, 'zz', 'x')).toThrow();
  });

  it('converts to MediaRef and searches', () => {
    const doc = addToLibrary({ items: [] }, { ...ref('tee-1'), alt: 'Ecru tee' }, { uploadedAt: '1', name: 'tee.jpg' });
    expect(toMediaRef(doc.items[0])).toEqual({ ...ref('tee-1'), alt: 'Ecru tee' });
    expect(searchLibrary(doc.items, 'ECRU')).toHaveLength(1);
    expect(searchLibrary(doc.items, 'nope')).toHaveLength(0);
  });
});

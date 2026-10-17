import { describe, expect, it } from 'vitest';
import { MediaRef } from '@/lib/schemas/common';
import { mediaFormats, mediaSrcSet } from './media-src';

const base = { id: 'tee-1a2b', width: 1200, height: 1500, widths: [480, 1200] };

describe('Image srcset formats (QA F5)', () => {
  it('treats a MediaRef without formats as WebP only', () => {
    const m = MediaRef.parse(base);
    expect(m.formats).toBeUndefined();
    expect(mediaFormats(m)).toEqual(['webp']);
    expect(mediaSrcSet(m, 'avif')).toBeUndefined();
    expect(mediaSrcSet(m, 'webp')).toBe('/media/tee-1a2b/480.webp 480w, /media/tee-1a2b/1200.webp 1200w');
  });
  it('lists AVIF only when stored', () => {
    const m = MediaRef.parse({ ...base, formats: ['avif', 'webp'] });
    expect(mediaSrcSet(m, 'avif')).toContain('/media/tee-1a2b/480.avif 480w');
  });
  it('rejects unknown formats and skips srcset for direct src', () => {
    expect(MediaRef.safeParse({ ...base, formats: ['gif'] }).success).toBe(false);
    expect(mediaSrcSet(MediaRef.parse({ ...base, src: '/x.jpg' }), 'webp')).toBeUndefined();
  });
});

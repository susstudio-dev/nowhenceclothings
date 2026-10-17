import { z } from 'zod';
import { putMedia, readJson, writeJsonCas } from '@/lib/storage';
import { MEDIA_LIBRARY_KEY, MediaLibraryDoc } from '@/lib/schemas/media';
import { addToLibrary, setLibraryAlt } from '@/lib/admin/media-library';
import { MediaRef } from '@/lib/schemas/common';
import { adminRoute, HttpError, json, readBody } from '@/lib/admin/api';
import { MAX_UPLOAD_BYTES, MAX_VARIANT_FILES, newMediaId, parseVariantField, sniffImage } from '@/lib/admin/media';

export const dynamic = 'force-dynamic';

/**
 * A2 media upload. The browser resizes (components/admin/MediaUploader) and
 * posts multipart fields named `w{width}.{webp|avif}` plus `width`, `height`
 * (natural size of the largest variant), `alt` and `name`. Every width must
 * have a WebP (the storefront fallback). Returns the MediaRef to embed.
 */
export async function POST(req: Request) {
  return adminRoute({ cap: 'media.write' }, async ({ log, admin }) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, 'Expected multipart form data');
    }
    const files: { width: number; format: 'avif' | 'webp' | 'jpg' | 'png'; bytes: Uint8Array }[] = [];
    for (const [name, value] of form.entries()) {
      const spec = parseVariantField(name);
      if (!spec || typeof value === 'string') continue;
      if (value.size > MAX_UPLOAD_BYTES) throw new HttpError(413, `${name} is larger than 8 MB`);
      const bytes = new Uint8Array(await value.arrayBuffer());
      const real = sniffImage(bytes);
      if (real !== spec.format) throw new HttpError(415, `${name} is not a ${spec.format} image`);
      if (spec.width > 4000) throw new HttpError(400, `${name} is too wide`);
      files.push({ ...spec, bytes });
    }
    if (files.length === 0) throw new HttpError(400, 'No image variants in upload');
    if (files.length > MAX_VARIANT_FILES) throw new HttpError(400, 'Too many variants');

    const widths = [...new Set(files.map((f) => f.width))].sort((a, b) => a - b);
    for (const w of widths) {
      if (!files.some((f) => f.width === w && f.format === 'webp')) {
        throw new HttpError(400, `Width ${w} is missing its WebP variant`);
      }
    }
    const natW = Number(form.get('width'));
    const natH = Number(form.get('height'));
    if (!Number.isInteger(natW) || !Number.isInteger(natH) || natW <= 0 || natH <= 0) {
      throw new HttpError(400, 'width and height are required');
    }
    const largest = widths[widths.length - 1];
    const id = newMediaId(String(form.get('name') ?? 'img'));
    for (const f of files) await putMedia(id, f.width, f.format, f.bytes);

    const media = MediaRef.parse({
      id,
      alt: String(form.get('alt') ?? '').slice(0, 300),
      width: largest,
      height: Math.max(1, Math.round((natH * largest) / natW)),
      widths,
      // F5: only formats present at every width, so srcset never links a missing file.
      formats: (['avif', 'webp', 'jpg', 'png'] as const).filter((fmt) =>
        widths.every((w) => files.some((f) => f.width === w && f.format === fmt)),
      ),
    });
    // A9c: index it in the media library for reuse (best effort; the upload stands).
    const name = String(form.get('name') ?? '').slice(0, 200);
    await writeJsonCas(MEDIA_LIBRARY_KEY, MediaLibraryDoc, (cur) =>
      addToLibrary(cur ?? { items: [] }, media, { name, uploadedAt: new Date().toISOString(), uploadedBy: admin.email }),
    { initial: () => ({ items: [] }) }).catch(() => undefined);
    await log('media_upload', `media/${id}/`, `${files.length} files, widths ${widths.join('/')}`);
    return json({ media }, 201);
  });
}

/** A9c media library listing (newest first). */
export async function GET() {
  return adminRoute({ cap: 'media.write' }, async () => {
    const doc = (await readJson(MEDIA_LIBRARY_KEY, MediaLibraryDoc)) ?? { items: [] };
    return json({ items: doc.items });
  });
}

const AltPatch = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), alt: z.string().max(300) });

/** Edit alt text of a library item. Products/content keep their own copy of alt. */
export async function PATCH(req: Request) {
  return adminRoute({ cap: 'media.write' }, async ({ log }) => {
    const { id, alt } = await readBody(req, AltPatch);
    const doc = await writeJsonCas(MEDIA_LIBRARY_KEY, MediaLibraryDoc, (cur) => {
      try {
        return setLibraryAlt(cur ?? { items: [] }, id, alt);
      } catch {
        throw new HttpError(404, 'Image not found in the library');
      }
    });
    await log('media_alt', `media/${id}/`, alt.slice(0, 80));
    return json({ item: doc.items.find((x) => x.id === id) });
  });
}

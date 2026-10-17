import { putMedia } from '@/lib/storage';
import { MediaRef } from '@/lib/schemas/common';
import { adminRoute, HttpError, json } from '@/lib/admin/api';
import { MAX_UPLOAD_BYTES, MAX_VARIANT_FILES, newMediaId, parseVariantField, sniffImage } from '@/lib/admin/media';

export const dynamic = 'force-dynamic';

/**
 * A2 media upload. The browser resizes (components/admin/MediaUploader) and
 * posts multipart fields named `w{width}.{webp|avif}` plus `width`, `height`
 * (natural size of the largest variant), `alt` and `name`. Every width must
 * have a WebP (the storefront fallback). Returns the MediaRef to embed.
 */
export async function POST(req: Request) {
  return adminRoute({ cap: 'media.write' }, async ({ log }) => {
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
    });
    await log('media_upload', `media/${id}/`, `${files.length} files, widths ${widths.join('/')}`);
    return json({ media }, 201);
  });
}

// Small helpers for the commerce route handlers.
import { NextResponse } from 'next/server';
import type { ZodType, ZodTypeDef } from 'zod';

export const MAX_BODY = 32 * 1024;

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Reads and validates a JSON body. Returns the data or an error response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const text = await req.text();
  if (text.length > MAX_BODY) return { ok: false, response: jsonError(413, 'Request too large') };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, 'Invalid JSON') };
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    return {
      ok: false,
      response: jsonError(400, 'Please check the highlighted fields.', {
        fields: res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    };
  }
  return { ok: true, data: res.data };
}

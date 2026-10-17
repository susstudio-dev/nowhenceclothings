import 'server-only';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { authorizeAdmin, type AdminSubject } from '@/lib/guard';
import { audit } from '@/lib/audit';
import { CasConflictError, DocValidationError } from '@/lib/storage';
import type { Capability } from '@/lib/roles';
import type { RoleId } from '@/lib/schemas/users';
import { NotFoundError } from './catalogue-mutations';
import { OrderTransitionError } from './orders';
import { TeamError } from './team';

/** A 4xx the client should see verbatim. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

/** Parse and validate a JSON body; throws HttpError(400) on failure. */
export async function readBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    const first = res.error.issues[0];
    throw new HttpError(400, `${first.path.join('.') || 'body'}: ${first.message}`);
  }
  return res.data;
}

/** Map known errors to HTTP responses. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  if (err instanceof NotFoundError) return json({ error: err.message }, 404);
  if (err instanceof OrderTransitionError || err instanceof TeamError) return json({ error: err.message }, 409);
  if (err instanceof CasConflictError) return json({ error: 'Someone else saved at the same time. Reload and retry.' }, 409);
  if (err instanceof DocValidationError) {
    const issues = Array.isArray(err.issues) ? (err.issues as { path: (string | number)[]; message: string }[]) : [];
    const first = issues[0];
    return json({ error: first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed' }, 400);
  }
  if (err instanceof ZodError) return json({ error: err.issues[0]?.message ?? 'Validation failed' }, 400);
  if (err instanceof Error && /must|cannot|already|exceed|Add a tracking/i.test(err.message)) {
    return json({ error: err.message }, 400);
  }
  console.error('admin api error', err);
  return json({ error: 'Something went wrong' }, 500);
}

export interface AdminContext {
  admin: AdminSubject;
  /** Append an audit entry attributed to this admin (best effort). */
  log: (action: string, target?: string, detail?: string) => Promise<void>;
}

/**
 * Route wrapper: authorize (role + optional capability) first, then run the
 * handler with error mapping. Every admin route goes through this.
 */
export async function adminRoute(
  opts: { role?: RoleId; cap?: Capability },
  handler: (ctx: AdminContext) => Promise<Response>,
): Promise<Response> {
  const auth = await authorizeAdmin(opts.role ?? 'editor', opts.cap);
  if (!auth.ok) return auth.response;
  const admin = auth.admin;
  const ctx: AdminContext = {
    admin,
    log: (action, target, detail) => audit({ actor: admin.email, action, target, detail }),
  };
  try {
    return await handler(ctx);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Reject cross-site form posts: Origin (when present) must match Host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
  } catch {
    return false;
  }
}

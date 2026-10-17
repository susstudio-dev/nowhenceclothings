import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Ported from furor-web. Runs on /admin only (CPU cost on Workers). Verifies
// signature/issuer/audience and redirects to login; authorization itself
// stays in the admin layout and each page's guard (src/lib/guard.ts).
// Constants mirror src/lib/auth.ts (not imported: that module pulls in
// next/headers and storage, which do not belong in the middleware bundle).
const COOKIE_NAME = 'nowhence_admin';
const JWT_ISSUER = 'nowhence';
const JWT_AUDIENCE = 'nowhence-admin';

function getSecret(): Uint8Array | null {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === 'production') return null;
  return new TextEncoder().encode('dev-only-secret-change-me-in-production-32b');
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

// Server components cannot read the pathname; the admin layout needs it to
// exempt the login page from its own guard.
function withPath(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-admin-path', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // CSRF defence in depth for admin API writes: a cross-site Origin is refused
  // before any handler runs (auth itself is enforced per route by adminRoute).
  if (pathname.startsWith('/api/')) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return NextResponse.next();
    const origin = req.headers.get('origin');
    if (origin) {
      let ok = false;
      try {
        ok = new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
      } catch {}
      if (!ok) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
    }
    return NextResponse.next();
  }
  if (pathname === '/admin/login') return withPath(req);

  const toLogin = () => {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  };

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = getSecret();
  if (!token || !secret) return toLogin();
  try {
    await jwtVerify(token, secret, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    return withPath(req);
  } catch {
    return toLogin();
  }
}

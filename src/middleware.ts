
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const protectedAdminRoutes = ['/admin'];
const publicRoutes = ['/admin/login', '/loan/connect'];

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // ✅ Edge-safe nonce using Web Crypto
  const nonce = btoa(self.crypto.randomUUID()); // base64 encode UUID

  // Build CSP header
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https://placehold.co https://play-lh.googleusercontent.com https://github.com;
    connect-src 'self';
    frame-ancestors 'self';
    media-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    worker-src 'self';
    manifest-src 'self';
  `.replace(/\s{2,}/g, ' ').trim();

  // Clone request headers and add nonce
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set security headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Admin authentication
  if (!publicRoutes.includes(path)) {
    const isProtected = protectedAdminRoutes.some((prefix) => path.startsWith(prefix));
    if (isProtected) {
      const session = await getSession();
      if (!session?.userId) {
        return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin).toString());
      }
    }
  }

  return response;
}

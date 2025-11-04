
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const protectedAdminRoutes = ['/admin'];
const publicRoutes = ['/admin/login', '/loan/connect'];

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  
  // Create a response object to modify headers
  const response = NextResponse.next();

  // Admin authentication
  if (!publicRoutes.includes(path)) {
    const isProtected = protectedAdminRoutes.some((prefix) => path.startsWith(prefix));
    if (isProtected) {
      const session = await getSession();
      if (!session?.userId) {
        const url = new URL('/admin/login', req.nextUrl.origin);
        return NextResponse.redirect(url.toString());
      }
    }
  }

  return response;
}


import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default async function middleware(req: NextRequest) {
  // Create a response object to modify headers if needed in the future
  const response = NextResponse.next();

  // Middleware logic is simplified for now to avoid dynamic API errors.
  // Auth checks are primarily handled in the layouts and page components.

  return response;
}

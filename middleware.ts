import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth';

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  const email = verifySessionCookie(cookie?.value);

  // Inject email header for downstream API routes
  const response = NextResponse.next();
  if (email) {
    response.headers.set('x-user-email', email);
  }

  const path = req.nextUrl.pathname;

  // Routes that require authentication (no guest access)
  const authRequired = path.startsWith('/setup') || path.startsWith('/api/user');
  if (authRequired && !email) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  return response;
}

export const config = {
  matcher: ['/setup/:path*', '/pipeline/:path*', '/api/user/:path*'],
};

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'yt-session';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

async function verifySession(cookieValue: string | undefined): Promise<string | null> {
  if (!cookieValue) return null;

  const parts = cookieValue.split(':');
  if (parts.length !== 3) return null;

  const [email, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > MAX_AGE) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  // Web Crypto HMAC (Edge Runtime compatible)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${email}:${timestampStr}`));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (signature !== expected) return null;
  return email;
}

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  const email = await verifySession(cookie?.value);

  const response = NextResponse.next();
  if (email) {
    response.headers.set('x-user-email', email);
  }

  const path = req.nextUrl.pathname;

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

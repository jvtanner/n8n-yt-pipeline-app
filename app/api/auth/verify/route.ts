import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/auth';
import { findAuthToken, markTokenUsed, findUserByEmail, updateUser } from '@/lib/notion';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/?error=invalid', req.url));
  }

  try {
    const authToken = await findAuthToken(token);

    if (!authToken) {
      return NextResponse.redirect(new URL('/?error=invalid', req.url));
    }

    if (authToken.used) {
      return NextResponse.redirect(new URL('/?error=used', req.url));
    }

    if (new Date(authToken.expiresAt) < new Date()) {
      return NextResponse.redirect(new URL('/?error=expired', req.url));
    }

    // Mark token as used
    await markTokenUsed(authToken.pageId);

    // Update last login
    const user = await findUserByEmail(authToken.email);
    if (user) {
      await updateUser(user.pageId, { lastLogin: new Date().toISOString() });
    }

    // Set session cookie and redirect to home
    const session = createSessionCookie(authToken.email);
    const response = NextResponse.redirect(new URL('/', req.url));
    response.cookies.set(session.name, session.value, session.options as Parameters<typeof response.cookies.set>[2]);

    return response;
  } catch (err) {
    console.error('verify error:', err);
    return NextResponse.redirect(new URL('/?error=server', req.url));
  }
}

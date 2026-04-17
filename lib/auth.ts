import { createHmac } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'yt-session';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  return secret;
}

function sign(email: string, timestamp: number): string {
  const data = `${email}:${timestamp}`;
  const signature = createHmac('sha256', getSecret()).update(data).digest('hex');
  return `${data}:${signature}`;
}

function verify(cookieValue: string): string | null {
  const parts = cookieValue.split(':');
  if (parts.length !== 3) return null;

  const [email, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return null;

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > MAX_AGE) return null;

  // Verify signature
  const expected = createHmac('sha256', getSecret())
    .update(`${email}:${timestampStr}`)
    .digest('hex');

  if (signature !== expected) return null;

  return email;
}

export function createSessionCookie(email: string): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    name: COOKIE_NAME,
    value: sign(email, timestamp),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: MAX_AGE,
    },
  };
}

export function clearSessionCookie(): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
  return {
    name: COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
    },
  };
}

export function verifySessionCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  return verify(cookieValue);
}

export async function getSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return verifySessionCookie(cookie?.value);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

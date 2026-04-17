import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  const cleared = clearSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cleared.name, cleared.value, cleared.options as Parameters<typeof response.cookies.set>[2]);
  return response;
}

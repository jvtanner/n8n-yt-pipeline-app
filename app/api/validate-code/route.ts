import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { code } = await req.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ valid: false });
  }

  const input = code.trim().toLowerCase();

  // Check env var first
  const envCodes = (process.env.ACCESS_CODES || '')
    .split(',')
    .map(c => c.trim().toLowerCase())
    .filter(Boolean);

  if (envCodes.includes(input)) {
    return NextResponse.json({ valid: true });
  }

  // Check remote URL if configured
  const codesUrl = process.env.ACCESS_CODES_URL;
  if (codesUrl) {
    try {
      const res = await fetch(codesUrl, { cache: 'no-store' });
      const remoteCodes: string[] = await res.json();
      if (Array.isArray(remoteCodes)) {
        const found = remoteCodes.some(c =>
          typeof c === 'string' && c.trim().toLowerCase() === input
        );
        if (found) {
          return NextResponse.json({ valid: true });
        }
      }
    } catch {
      // Remote fetch failed — fall through to invalid
    }
  }

  return NextResponse.json({ valid: false });
}

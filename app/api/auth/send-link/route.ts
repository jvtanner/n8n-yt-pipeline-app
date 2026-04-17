import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { findUserByEmail, saveAuthToken } from '@/lib/notion';

const N8N_WEBHOOK_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL || 'https://joshuavtanner.app.n8n.cloud/webhook';

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ status: 'error', message: 'Email required' }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  try {
    const user = await findUserByEmail(normalized);

    if (!user || !user.accessGranted) {
      return NextResponse.json({ status: 'not_found' });
    }

    // Generate token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Save token to Notion
    await saveAuthToken(token, normalized, expiresAt);

    // Build login URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youtube.echelonadvisory.ai';
    const loginUrl = `${baseUrl}/api/auth/verify?token=${token}`;

    // Trigger n8n magic link email
    const emailRes = await fetch(`${N8N_WEBHOOK_BASE}/yt-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized, token, loginUrl }),
    });

    if (!emailRes.ok) {
      console.error('Magic link email failed:', emailRes.status);
      return NextResponse.json(
        { status: 'error', message: 'Failed to send email. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ status: 'sent' });
  } catch (err) {
    console.error('send-link error:', err);
    return NextResponse.json(
      { status: 'error', message: 'Failed to send login link' },
      { status: 500 },
    );
  }
}

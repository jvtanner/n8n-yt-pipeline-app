import { NextRequest, NextResponse } from 'next/server';
import { getSessionEmail } from '@/lib/auth';
import { findUserByEmail, updateUser } from '@/lib/notion';

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      email: user.email,
      creatorName: user.creatorName,
      voiceProfile: user.voiceProfile ? JSON.parse(user.voiceProfile) : null,
      ideaBank: user.ideaBank ? JSON.parse(user.ideaBank) : [],
      youtubeChannelId: user.youtubeChannelId,
      youtubeChannelUrl: user.youtubeChannelUrl,
      freeRunUsed: user.freeRunUsed,
    });
  } catch (err) {
    console.error('profile GET error:', err);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Parameters<typeof updateUser>[1] = {};

    if (body.creatorName !== undefined) updates.creatorName = body.creatorName;
    if (body.voiceProfile !== undefined) updates.voiceProfile = JSON.stringify(body.voiceProfile);
    if (body.ideaBank !== undefined) updates.ideaBank = JSON.stringify(body.ideaBank);
    if (body.youtubeChannelId !== undefined) updates.youtubeChannelId = body.youtubeChannelId;
    if (body.youtubeChannelUrl !== undefined) updates.youtubeChannelUrl = body.youtubeChannelUrl;
    if (body.freeRunUsed !== undefined) updates.freeRunUsed = body.freeRunUsed;

    await updateUser(user.pageId, updates);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('profile PUT error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

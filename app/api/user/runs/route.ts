import { NextResponse } from 'next/server';
import { getSessionEmail } from '@/lib/auth';
import { findUserByEmail, queryRunsByCreator } from '@/lib/notion';

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

    const creatorName = user.creatorName || email;
    const runs = await queryRunsByCreator(creatorName, 50);

    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.pageId,
        date: r.createdAt,
        name: r.name,
        rawIdea: r.rawIdea,
        chosenClaim: r.chosenClaim,
        chosenHook: r.chosenHook,
        chosenIntro: r.chosenIntro,
        chosenThumbnailText: r.chosenThumbnailText,
        chosenTitle: r.chosenTitle,
        status: r.status,
        lane: r.lane,
      })),
    });
  } catch (err) {
    console.error('runs GET error:', err);
    return NextResponse.json({ error: 'Failed to load runs' }, { status: 500 });
  }
}

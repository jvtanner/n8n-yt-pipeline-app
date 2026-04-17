import { NextRequest, NextResponse } from 'next/server';
import { getSessionEmail } from '@/lib/auth';
import { queryRunsByEmail, createRun } from '@/lib/notion';

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const runs = await queryRunsByEmail(email, 50);

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
        thumbnailImageUrl: r.thumbnailImageUrl || undefined,
        status: r.status,
        lane: r.lane,
      })),
    });
  } catch (err) {
    console.error('runs GET error:', err);
    return NextResponse.json({ error: 'Failed to load runs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const run = await createRun({
      email,
      creatorName: body.creatorName || email,
      name: body.chosenTitle || body.rawIdea?.slice(0, 60) || 'Untitled',
      rawIdea: body.rawIdea || '',
      chosenClaim: body.chosenClaim || '',
      chosenHook: body.chosenHook || '',
      chosenIntro: body.chosenIntro,
      chosenThumbnailText: body.chosenThumbnailText || '',
      chosenTitle: body.chosenTitle || '',
      thumbnailImageUrl: body.thumbnailImageUrl,
      lane: body.lane,
    });

    return NextResponse.json({ ok: true, pageId: run.pageId });
  } catch (err) {
    console.error('runs POST error:', err);
    return NextResponse.json({ error: 'Failed to save run' }, { status: 500 });
  }
}

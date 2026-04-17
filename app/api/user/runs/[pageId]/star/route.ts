import { NextRequest, NextResponse } from 'next/server';
import { getSessionEmail } from '@/lib/auth';
import { getRunById, updateRunStarredItems } from '@/lib/notion';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { pageId } = await params;

  try {
    const run = await getRunById(pageId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Ownership check — only the run's author can star items
    if (run.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, item } = body as {
      action: 'add' | 'remove';
      item: { type: string; text: string; metadata?: Record<string, string> };
    };

    // Parse existing starred items
    let starred: { type: string; text: string; metadata?: Record<string, string> }[] = [];
    if (run.starredItems) {
      try { starred = JSON.parse(run.starredItems); } catch { starred = []; }
    }

    if (action === 'add') {
      // Don't duplicate
      const exists = starred.some((s) => s.type === item.type && s.text === item.text);
      if (!exists) {
        starred.push(item);
      }
    } else if (action === 'remove') {
      starred = starred.filter((s) => !(s.type === item.type && s.text === item.text));
    }

    await updateRunStarredItems(pageId, JSON.stringify(starred));

    return NextResponse.json({ ok: true, starred });
  } catch (err) {
    console.error('star PUT error:', err);
    return NextResponse.json({ error: 'Failed to update starred items' }, { status: 500 });
  }
}

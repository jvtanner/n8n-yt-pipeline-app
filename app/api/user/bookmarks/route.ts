import { NextResponse } from 'next/server';
import { getSessionEmail } from '@/lib/auth';
import { queryRunsByEmail } from '@/lib/notion';

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const runs = await queryRunsByEmail(email, 100);

    // Flatten starred items from all runs
    const bookmarks: {
      id: string;
      runPageId: string;
      runName: string;
      type: string;
      text: string;
      metadata: Record<string, string>;
      savedAt: string;
    }[] = [];

    for (const run of runs) {
      if (!run.starredItems) continue;
      try {
        const items = JSON.parse(run.starredItems) as {
          type: string;
          text: string;
          metadata?: Record<string, string>;
        }[];
        for (const item of items) {
          bookmarks.push({
            id: `${run.pageId}:${item.type}:${item.text.slice(0, 50)}`,
            runPageId: run.pageId,
            runName: run.name,
            type: item.type,
            text: item.text,
            metadata: item.metadata ?? {},
            savedAt: run.createdAt,
          });
        }
      } catch {
        // Invalid JSON in starred items — skip
      }
    }

    return NextResponse.json({ bookmarks });
  } catch (err) {
    console.error('bookmarks GET error:', err);
    return NextResponse.json({ error: 'Failed to load bookmarks' }, { status: 500 });
  }
}

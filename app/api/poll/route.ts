import { NextRequest, NextResponse } from 'next/server';

const N8N_API_BASE = 'https://joshuavtanner.app.n8n.cloud/api/v1';

export async function GET(req: NextRequest) {
  const workflowId = req.nextUrl.searchParams.get('workflowId');
  const startedAfter = req.nextUrl.searchParams.get('startedAfter');

  if (!workflowId || !startedAfter) {
    return NextResponse.json(
      { status: 'error', message: 'Missing workflowId or startedAfter' },
      { status: 400 },
    );
  }

  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: 'error', message: 'N8N_API_KEY not configured' },
      { status: 500 },
    );
  }

  const headers = { 'X-N8N-API-KEY': apiKey };

  try {
    // List recent executions for this workflow (no data — fast)
    const listRes = await fetch(
      `${N8N_API_BASE}/executions?workflowId=${workflowId}&limit=5`,
      { headers },
    );
    if (!listRes.ok) {
      return NextResponse.json(
        { status: 'error', message: `n8n API returned ${listRes.status}` },
        { status: 502 },
      );
    }

    const listData = await listRes.json();
    const executions = listData.data ?? listData.results ?? [];

    // Find execution started after our timestamp (2s tolerance for clock skew)
    const threshold = new Date(startedAfter).getTime() - 2000;
    const match = executions.find(
      (ex: { startedAt: string }) => new Date(ex.startedAt).getTime() >= threshold,
    );

    if (!match) {
      return NextResponse.json({ status: 'waiting' });
    }

    if (match.status === 'running' || match.status === 'new' || match.status === 'waiting') {
      return NextResponse.json({ status: 'running', executionId: match.id });
    }

    if (match.status === 'error' || match.status === 'crashed') {
      return NextResponse.json({
        status: 'error',
        message: `n8n execution ${match.id} failed`,
      });
    }

    if (match.status === 'success') {
      // Fetch full execution data to extract output
      const detailRes = await fetch(
        `${N8N_API_BASE}/executions/${match.id}?includeData=true`,
        { headers },
      );
      if (!detailRes.ok) {
        return NextResponse.json(
          { status: 'error', message: 'Failed to fetch execution data' },
          { status: 502 },
        );
      }

      const detail = await detailRes.json();

      // Extract Respond to Webhook output — handle both raw API and wrapped formats
      const output =
        // Raw n8n REST API format
        detail.data?.resultData?.runData?.['Respond to Webhook']?.[0]?.data?.main?.[0]?.[0]?.json
        // Alternate format (some n8n versions)
        ?? detail.data?.nodes?.['Respond to Webhook']?.data?.output?.[0]?.[0]?.json;

      if (!output) {
        return NextResponse.json({
          status: 'error',
          message: 'Execution completed but no output found',
        });
      }

      return NextResponse.json({ status: 'complete', data: output });
    }

    // Unknown status — treat as still running
    return NextResponse.json({ status: 'waiting' });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Poll failed' },
      { status: 500 },
    );
  }
}

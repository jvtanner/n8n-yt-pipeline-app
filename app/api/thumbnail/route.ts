export const maxDuration = 180;

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(
    `${process.env.N8N_WEBHOOK_BASE_URL}/yt-thumbnail-gen`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

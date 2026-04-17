const NOTION_API = 'https://api.notion.com/v1';

function getHeaders() {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error('NOTION_API_KEY not configured');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  };
}

function getUsersDbId(): string {
  const id = process.env.NOTION_USERS_DB_ID;
  if (!id) throw new Error('NOTION_USERS_DB_ID not configured');
  return id;
}

function getAuthTokensDbId(): string {
  const id = process.env.NOTION_AUTH_TOKENS_DB_ID;
  if (!id) throw new Error('NOTION_AUTH_TOKENS_DB_ID not configured');
  return id;
}

// ── User queries ──────────────────────────────────────────────────────────

export interface NotionUser {
  pageId: string;
  email: string;
  creatorName: string;
  voiceProfile: string;
  ideaBank: string;
  youtubeChannelId: string;
  youtubeChannelUrl: string;
  accessGranted: boolean;
  freeRunUsed: boolean;
  lastLogin: string | null;
  created: string | null;
}

function extractRichText(prop: { rich_text?: { plain_text: string }[] }): string {
  return prop.rich_text?.map((t) => t.plain_text).join('') ?? '';
}

function chunkRichText(text: string, maxLen = 2000): { text: { content: string } }[] {
  if (!text) return [{ text: { content: '' } }];
  const chunks: { text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push({ text: { content: text.slice(i, i + maxLen) } });
  }
  return chunks;
}

function extractTitle(prop: { title?: { plain_text: string }[] }): string {
  return prop.title?.map((t) => t.plain_text).join('') ?? '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToUser(page: any): NotionUser {
  const p = page.properties;
  return {
    pageId: page.id,
    email: extractTitle(p['Email']),
    creatorName: extractRichText(p['Creator Name']),
    voiceProfile: extractRichText(p['Voice Profile']),
    ideaBank: extractRichText(p['Idea Bank']),
    youtubeChannelId: extractRichText(p['YouTube Channel ID']),
    youtubeChannelUrl: extractRichText(p['YouTube Channel URL']),
    accessGranted: p['Access Granted']?.checkbox ?? false,
    freeRunUsed: p['Free Run Used']?.checkbox ?? false,
    lastLogin: p['Last Login']?.date?.start ?? null,
    created: p['Created']?.date?.start ?? null,
  };
}

export async function findUserByEmail(email: string): Promise<NotionUser | null> {
  const res = await fetch(`${NOTION_API}/databases/${getUsersDbId()}/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filter: {
        property: 'Email',
        title: { equals: email.toLowerCase().trim() },
      },
      page_size: 1,
    }),
  });

  if (!res.ok) throw new Error(`Notion query failed: ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) return null;
  return pageToUser(data.results[0]);
}

export async function updateUser(
  pageId: string,
  updates: Partial<{
    creatorName: string;
    voiceProfile: string;
    ideaBank: string;
    youtubeChannelId: string;
    youtubeChannelUrl: string;
    accessGranted: boolean;
    freeRunUsed: boolean;
    lastLogin: string;
  }>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (updates.creatorName !== undefined) {
    properties['Creator Name'] = { rich_text: [{ text: { content: updates.creatorName } }] };
  }
  if (updates.voiceProfile !== undefined) {
    properties['Voice Profile'] = { rich_text: chunkRichText(updates.voiceProfile) };
  }
  if (updates.ideaBank !== undefined) {
    properties['Idea Bank'] = { rich_text: chunkRichText(updates.ideaBank) };
  }
  if (updates.youtubeChannelId !== undefined) {
    properties['YouTube Channel ID'] = { rich_text: [{ text: { content: updates.youtubeChannelId } }] };
  }
  if (updates.youtubeChannelUrl !== undefined) {
    properties['YouTube Channel URL'] = { rich_text: [{ text: { content: updates.youtubeChannelUrl } }] };
  }
  if (updates.accessGranted !== undefined) {
    properties['Access Granted'] = { checkbox: updates.accessGranted };
  }
  if (updates.freeRunUsed !== undefined) {
    properties['Free Run Used'] = { checkbox: updates.freeRunUsed };
  }
  if (updates.lastLogin !== undefined) {
    properties['Last Login'] = { date: { start: updates.lastLogin } };
  }

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) throw new Error(`Notion update failed: ${res.status}`);
}

export async function createUser(email: string, creatorName?: string): Promise<NotionUser> {
  const now = new Date().toISOString().split('T')[0];
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      parent: { database_id: getUsersDbId() },
      properties: {
        'Email': { title: [{ text: { content: email.toLowerCase().trim() } }] },
        'Creator Name': { rich_text: [{ text: { content: creatorName || '' } }] },
        'Access Granted': { checkbox: true },
        'Created': { date: { start: now } },
      },
    }),
  });

  if (!res.ok) throw new Error(`Notion create failed: ${res.status}`);
  const page = await res.json();
  return pageToUser(page);
}

// ── Auth token queries ────────────────────────────────────────────────────

export async function saveAuthToken(token: string, email: string, expiresAt: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      parent: { database_id: getAuthTokensDbId() },
      properties: {
        'Token': { title: [{ text: { content: token } }] },
        'Email': { rich_text: [{ text: { content: email } }] },
        'Expires At': { rich_text: [{ text: { content: expiresAt } }] },
        'Used': { checkbox: false },
      },
    }),
  });

  if (!res.ok) throw new Error(`Notion create token failed: ${res.status}`);
}

export interface AuthToken {
  pageId: string;
  token: string;
  email: string;
  expiresAt: string;
  used: boolean;
}

export async function findAuthToken(token: string): Promise<AuthToken | null> {
  const res = await fetch(`${NOTION_API}/databases/${getAuthTokensDbId()}/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filter: {
        property: 'Token',
        title: { equals: token },
      },
      page_size: 1,
    }),
  });

  if (!res.ok) throw new Error(`Notion query failed: ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) return null;

  const page = data.results[0];
  const p = page.properties;
  return {
    pageId: page.id,
    token: extractTitle(p['Token']),
    email: extractRichText(p['Email']),
    expiresAt: extractRichText(p['Expires At']),
    used: p['Used']?.checkbox ?? false,
  };
}

// ── Pipeline run queries (ChatGPT Notion DB) ────────────────────────────

function getRunsDbId(): string {
  const id = process.env.NOTION_RUNS_DB_ID;
  if (!id) throw new Error('NOTION_RUNS_DB_ID not configured');
  return id;
}

export interface PipelineRunRecord {
  pageId: string;
  name: string;
  email: string;
  rawIdea: string;
  status: string;
  lane: string;
  chosenClaim: string;
  chosenHook: string;
  chosenIntro: string;
  chosenThumbnailText: string;
  chosenTitle: string;
  thumbnailImageUrl: string;
  starredItems: string;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToRun(page: any): PipelineRunRecord {
  const p = page.properties;
  return {
    pageId: page.id,
    name: extractTitle(p['Name']),
    email: p['Email']?.email ?? '',
    rawIdea: extractRichText(p['Raw Idea']),
    status: p['Status']?.select?.name ?? '',
    lane: extractRichText(p['Lane']),
    chosenClaim: extractRichText(p['Chosen Claim']),
    chosenHook: extractRichText(p['Chosen Hook']),
    chosenIntro: extractRichText(p['Chosen Intro']),
    chosenThumbnailText: extractRichText(p['Chosen Thumbnail Text']),
    chosenTitle: extractRichText(p['Chosen Title']),
    thumbnailImageUrl: p['Thumbnail Image URL']?.url ?? '',
    starredItems: extractRichText(p['Starred Items']),
    createdAt: page.created_time ?? '',
  };
}

export async function queryRunsByEmail(email: string, limit = 50): Promise<PipelineRunRecord[]> {
  const res = await fetch(`${NOTION_API}/databases/${getRunsDbId()}/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      filter: {
        property: 'Email',
        email: { equals: email.toLowerCase().trim() },
      },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: Math.min(limit, 100),
    }),
  });

  if (!res.ok) throw new Error(`Notion query runs failed: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map(pageToRun);
}

export async function createRun(run: {
  email: string;
  creatorName: string;
  name: string;
  rawIdea: string;
  chosenClaim: string;
  chosenHook: string;
  chosenIntro?: string;
  chosenThumbnailText: string;
  chosenTitle: string;
  thumbnailImageUrl?: string;
  lane?: string;
}): Promise<PipelineRunRecord> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      parent: { database_id: getRunsDbId() },
      properties: {
        'Name': { title: [{ text: { content: run.name || run.chosenTitle || 'Untitled' } }] },
        'Email': { email: run.email.toLowerCase().trim() },
        'Creator Name': { rich_text: [{ text: { content: run.creatorName } }] },
        'Raw Idea': { rich_text: chunkRichText(run.rawIdea) },
        'Chosen Claim': { rich_text: chunkRichText(run.chosenClaim) },
        'Chosen Hook': { rich_text: chunkRichText(run.chosenHook) },
        'Chosen Intro': { rich_text: chunkRichText(run.chosenIntro || '') },
        'Chosen Thumbnail Text': { rich_text: [{ text: { content: run.chosenThumbnailText || '' } }] },
        'Chosen Title': { rich_text: [{ text: { content: run.chosenTitle || '' } }] },
        ...(run.thumbnailImageUrl ? { 'Thumbnail Image URL': { url: run.thumbnailImageUrl } } : {}),
        'Status': { select: { name: 'Complete' } },
        ...(run.lane ? { 'Lane': { rich_text: [{ text: { content: run.lane } }] } } : {}),
      },
    }),
  });

  if (!res.ok) throw new Error(`Notion create run failed: ${res.status}`);
  const page = await res.json();
  return pageToRun(page);
}

export async function updateRunStarredItems(pageId: string, starredItems: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      properties: {
        'Starred Items': { rich_text: chunkRichText(starredItems) },
      },
    }),
  });

  if (!res.ok) throw new Error(`Notion update starred failed: ${res.status}`);
}

export async function getRunById(pageId: string): Promise<PipelineRunRecord | null> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) return null;
  const page = await res.json();
  return pageToRun(page);
}

// ── Auth token queries ────────────────────────────────────────────────────

export async function markTokenUsed(pageId: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      properties: {
        'Used': { checkbox: true },
      },
    }),
  });

  if (!res.ok) throw new Error(`Notion update token failed: ${res.status}`);
}

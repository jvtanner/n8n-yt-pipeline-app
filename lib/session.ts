export interface PipelineSession {
  stage: string;
  script: string;
  creatorName: string;
  claims: unknown[];
  chosenClaim: unknown | null;
  hooks: unknown[];
  chosenHook: unknown | null;
  intros: unknown[];
  chosenIntro: unknown | null;
  thumbnailTexts: unknown[];
  chosenThumbnail: unknown | null;
  thumbnailImageUrl: string | null;
  titles: unknown[];
  chosenTitle: unknown | null;
}

const SESSION_KEY = 'ytPipelineSession';

export function saveSession(session: PipelineSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadSession(): PipelineSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: PipelineSession = JSON.parse(raw);
    // If stage was loading-*, fall back to previous selection stage
    if (session.stage.startsWith('loading-')) {
      const fallbackMap: Record<string, string> = {
        'loading-claims': 'script',
        'loading-hooks': 'select-claim',
        'loading-intros': 'select-hook',
        'loading-thumbnails': 'select-intro',
        'loading-thumbnail-image': 'select-thumbnail',
        'loading-titles': 'select-thumbnail',
      };
      session.stage = fallbackMap[session.stage] || 'script';
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

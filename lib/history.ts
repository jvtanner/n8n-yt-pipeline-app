const STORAGE_KEY = 'ytPipelineHistory';
const MAX_RUNS = 50;

export interface PipelineRun {
  id: string;
  date: string;
  creatorName: string;
  rawIdea: string;
  chosenClaim: string;
  chosenHook: string;
  chosenIntro?: string;
  chosenThumbnailText: string;
  thumbnailImageUrl?: string;
  chosenTitle: string;
  videoBrief?: {
    target_audience?: string;
    pain_point?: string;
    video_format?: string;
  };
}

export function getHistory(): PipelineRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: Omit<PipelineRun, 'id' | 'date'>): PipelineRun {
  const entry: PipelineRun = {
    ...run,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    rawIdea: run.rawIdea.slice(0, 200),
  };
  const history = getHistory();
  history.unshift(entry);
  if (history.length > MAX_RUNS) {
    history.length = MAX_RUNS;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return entry;
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

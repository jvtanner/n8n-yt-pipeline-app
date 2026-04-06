export interface SavedItem {
  id: string;
  type: 'hook' | 'title' | 'claim' | 'thumbnailText';
  text: string;
  metadata: Record<string, string>;
  savedFrom: string;
  savedAt: string;
}

const BANK_KEY = 'ytPipelineIdeaBank';
const MAX_ITEMS = 100;

export function loadIdeaBank(): SavedItem[] {
  try {
    return JSON.parse(localStorage.getItem(BANK_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveToIdeaBank(item: Omit<SavedItem, 'id' | 'savedAt'>): void {
  const bank = loadIdeaBank();
  bank.unshift({
    ...item,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  });
  if (bank.length > MAX_ITEMS) bank.length = MAX_ITEMS;
  localStorage.setItem(BANK_KEY, JSON.stringify(bank));
}

export function removeFromIdeaBank(id: string): void {
  const bank = loadIdeaBank().filter(item => item.id !== id);
  localStorage.setItem(BANK_KEY, JSON.stringify(bank));
}

export function isInIdeaBank(type: string, text: string): boolean {
  return loadIdeaBank().some(item => item.type === type && item.text === text);
}

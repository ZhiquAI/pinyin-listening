import { DictationItem } from '../content/dictation';

const STORAGE_KEY = 'pinyin_dictation_starred_ids_v1';

export function loadStarredIds(): Record<string, boolean> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Failed to load starred ids from localStorage:', err);
    return {};
  }
}

export function saveStarredIds(starredIds: Record<string, boolean>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(starredIds));
  } catch (err) {
    console.error('Failed to save starred ids to localStorage:', err);
  }
}

export function filterStarredItems(
  items: DictationItem[],
  starredIds: Record<string, boolean>
): DictationItem[] {
  return items.filter((item) => !!starredIds[item.id]);
}

export interface CompletionStats {
  totalCount: number;
  starredCount: number;
  masteredCount: number;
  isAllCorrect: boolean;
}

export function calculateCompletionStats(
  totalCount: number,
  starredCount: number
): CompletionStats {
  const isAllCorrect = starredCount === 0 && totalCount > 0;
  return {
    totalCount,
    starredCount,
    masteredCount: Math.max(0, totalCount - starredCount),
    isAllCorrect,
  };
}

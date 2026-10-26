import { describe, expect, it } from 'vitest';
import { DictationItem } from '../src/content/dictation';
import {
  filterStarredItems,
  calculateCompletionStats,
} from '../src/features/reviewSession';

describe('课时通关与错题二轮复习逻辑', () => {
  const mockItems: DictationItem[] = [
    { id: 'item1', character: '爸爸', pinyin: 'bà ba', week: 6, dayLabel: '课时1', category: '两拼', teachingSteps: ['b', 'à'] },
    { id: 'item2', character: '妈妈', pinyin: 'mā ma', week: 6, dayLabel: '课时1', category: '两拼', teachingSteps: ['m', 'ā'] },
    { id: 'item3', character: '抹布', pinyin: 'mā bù', week: 6, dayLabel: '课时1', category: '两拼', teachingSteps: ['m', 'ā'] },
  ];

  it('能准确筛选出标记为错题的词条', () => {
    const starredIds = { item2: true };
    const starred = filterStarredItems(mockItems, starredIds);
    expect(starred.length).toBe(1);
    expect(starred[0].character).toBe('妈妈');
  });

  it('计算无错题时的全对统计', () => {
    const stats = calculateCompletionStats(3, 0);
    expect(stats.isAllCorrect).toBe(true);
    expect(stats.masteredCount).toBe(3);
  });

  it('计算有错题时的待复习统计', () => {
    const stats = calculateCompletionStats(3, 1);
    expect(stats.isAllCorrect).toBe(false);
    expect(stats.starredCount).toBe(1);
    expect(stats.masteredCount).toBe(2);
  });
});

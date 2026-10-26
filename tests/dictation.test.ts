import { describe, expect, it } from 'vitest';
import {
  dictationWeeks,
  dictationItems,
  getItemsByWeek,
  DictationItemSchema,
  getAvailableWeeks,
} from '../src/content/dictation';
import { getSpokenTextForDictation } from '../src/features/audio';

describe('听写词库与周次数据', () => {
  it('涵盖第5周至第9周的全部教学周次', () => {
    const weeks = getAvailableWeeks();
    expect(weeks).toEqual([5, 6, 7, 8, 9]);
    expect(dictationWeeks.length).toBe(5);
  });

  it('所有词条均通过 Zod Schema 校验', () => {
    expect(dictationItems.length).toBeGreaterThan(50);
    for (const item of dictationItems) {
      const res = DictationItemSchema.safeParse(item);
      if (!res.success) {
        console.error('Invalid item:', item, res.error);
      }
      expect(res.success).toBe(true);
    }
  });

  it('每一周均有对应的练习词条且按天组织', () => {
    for (const week of [5, 6, 7, 8, 9]) {
      const weekItems = getItemsByWeek(week);
      expect(weekItems.length).toBeGreaterThan(0);
      const days = new Set(weekItems.map((item) => item.dayLabel));
      expect(days.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('词条包含汉字、拼音和拆拼步骤', () => {
    const baba = dictationItems.find((i) => i.character === '爸爸');
    expect(baba).toBeDefined();
    expect(baba?.pinyin).toBe('bà ba');
    expect(baba?.week).toBe(6);
    expect(baba?.teachingSteps.length).toBeGreaterThan(0);
  });
});

describe('发音文本策略', () => {
  it('优先将汉字词语用于浏览器标准中文发音', () => {
    const spoken = getSpokenTextForDictation({
      character: '爸爸',
      pinyin: 'bà ba',
    });
    expect(spoken).toBe('爸爸');
  });

  it('单韵母带调通过示范词或汉字音标发音，不直接暴露生僻读法', () => {
    const spokenA = getSpokenTextForDictation({
      character: 'ā',
      pinyin: 'ā',
      speechHint: '一声 阿',
    });
    expect(spokenA).toBe('一声 阿');
  });
});

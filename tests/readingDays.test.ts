import { describe, expect, it } from 'vitest';
import readingDays from '../src/content/readingDays.json';
import { getWritingGlyph, layoutPinyinWriting } from '../src/content/pinyinWriting';

describe('每日拼读 PDF 内容', () => {
  it('保留 19 天全部 436 个词条及源表顺序', () => {
    expect(readingDays).toHaveLength(19);
    expect(readingDays.reduce((count, day) => count + day.items.length, 0)).toBe(436);
    expect(readingDays[0].items.slice(0, 3).map((item) => [item.character, item.pinyin])).toEqual([
      ['爸爸', 'bà ba'], ['妈妈', 'mā ma'], ['伯伯', 'bó bo'],
    ]);
    expect(readingDays[18].items.at(-1)).toMatchObject({ character: '水彩笔', pinyin: 'shuǐ cǎi bǐ' });
  });

  it('保留规范拼音，声调和 ü 都能逐笔演示', () => {
    expect(readingDays[10].items.find((item) => item.character === '葡萄')?.pinyin).toBe('pú tao');
    expect(readingDays[17].items.find((item) => item.character === '长颈鹿')?.pinyin).toBe('cháng jǐng lù');
    for (const day of readingDays) {
      for (const item of day.items) {
        for (const character of item.pinyin.normalize('NFC')) {
          if (!/\s/.test(character)) expect(getWritingGlyph(character), `${item.character}: ${character}`).toBeDefined();
        }
      }
    }
  });
  it('多音节词语的拼音始终横向排列在同一组四线三格内', () => {
    for (const pinyin of ['zhuō yǐ', 'zuò guǎng bō tǐ cāo']) {
      const layout = layoutPinyinWriting(pinyin);
      expect(layout.rows).toBe(1);
      expect(layout.height).toBe(160);
      const z = layout.strokes.find((stroke) => stroke.character === 'z');
      const last = layout.strokes.find((stroke) => stroke.character === (pinyin === 'zhuō yǐ' ? 'ǐ' : 'ō'));
      expect(last?.x).toBeGreaterThan(z?.x ?? Infinity);
    }
  });

});

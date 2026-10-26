import { describe, expect, it } from 'vitest';
import {
  generateTeacherSpellingPrompt,
  getSpellingSyllables,
} from '../src/features/spellingEngine';

describe('老师式自然拼读文本与音节生成', () => {
  it('两拼音节生成自然拼读提示词', () => {
    const prompt = generateTeacherSpellingPrompt({
      character: '爸',
      pinyin: 'bà',
    });
    // 应该包含声母、韵母和拼合直读
    expect(prompt).toContain('b');
    expect(prompt).toContain('à');
    expect(prompt).toContain('bà');
  });

  it('三拼音节生成包含声母、介母、韵母的拼读提示词', () => {
    const prompt = generateTeacherSpellingPrompt({
      character: '火',
      pinyin: 'huǒ',
    });
    expect(prompt).toContain('h');
    expect(prompt).toContain('u');
    expect(prompt).toContain('huǒ');
  });

  it('词语生成分字拼读和整词连读', () => {
    const prompt = generateTeacherSpellingPrompt({
      character: '爸爸',
      pinyin: 'bà ba',
    });
    expect(prompt).toContain('bà');
    expect(prompt).toContain('ba');
    expect(prompt).toContain('爸爸');
  });

  it('整体认读音节给出整体直读提示', () => {
    const prompt = generateTeacherSpellingPrompt({
      character: '自己',
      pinyin: 'zì jǐ',
    });
    expect(prompt).toContain('zì');
    expect(prompt).toContain('自己');
  });
});

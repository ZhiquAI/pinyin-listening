import { describe, expect, it } from 'vitest';
import {
  pinyinToAudioName,
  getPinyinAudioUrl,
  parseSpellingSequence,
} from '../src/features/pinyinSound';

describe('拼音真人音频映射', () => {
  it('能将声母正确映射到呼读音音频', () => {
    expect(pinyinToAudioName('b')).toBe('bo1');
    expect(pinyinToAudioName('p')).toBe('po1');
    expect(pinyinToAudioName('m')).toBe('mo1');
    expect(pinyinToAudioName('d')).toBe('de1');
    expect(pinyinToAudioName('g')).toBe('ge1');
    expect(pinyinToAudioName('h')).toBe('he1');
    expect(pinyinToAudioName('zh')).toBe('zhi1');
  });

  it('能将带声调音节转换为标准音频文件名', () => {
    expect(pinyinToAudioName('huǒ')).toBe('huo3');
    expect(pinyinToAudioName('bà')).toBe('ba4');
    expect(pinyinToAudioName('zhī')).toBe('zhi1');
    expect(pinyinToAudioName('cā')).toBe('ca1');
  });

  it('能正确处理 ü 转换为 uu', () => {
    expect(pinyinToAudioName('lǜ')).toBe('luu4');
    expect(pinyinToAudioName('nǚ')).toBe('nuu3');
  });

  it('返回本地优先的音频 URL', () => {
    const url = getPinyinAudioUrl('huo3');
    expect(url).toContain('/audio/pinyin/huo3.mp3');
  });
});

describe('分步拼读序列生成', () => {
  it('两拼音节生成 声母-韵母-整体 拼读步序', () => {
    const seq = parseSpellingSequence('bà');
    expect(seq.map((s) => s.label)).toEqual(['b', 'à', 'bà']);
    expect(seq.map((s) => s.audioName)).toEqual(['bo1', 'a4', 'ba4']);
  });

  it('三拼音节生成 声母-介母-韵母-整体 拼读步序', () => {
    const seq = parseSpellingSequence('huǒ');
    expect(seq.map((s) => s.label)).toEqual(['h', 'u', 'ǒ', 'huǒ']);
    expect(seq.map((s) => s.audioName)).toEqual(['he1', 'wu1', 'o3', 'huo3']);
  });

  it('整体认读音节直接整读', () => {
    const seq = parseSpellingSequence('zhī');
    expect(seq.map((s) => s.label)).toEqual(['zhī']);
    expect(seq.map((s) => s.audioName)).toEqual(['zhi1']);
  });
});

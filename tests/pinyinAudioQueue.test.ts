import { describe, expect, it } from 'vitest';
import { dictationItems } from '../src/content/dictation';
import { getPinyinAudioQueue } from '../src/features/pinyinSound';

describe('拼音音频队列解析', () => {
  it('所有词条均能成功解析出非空的音频队列', () => {
    for (const item of dictationItems) {
      const queue = getPinyinAudioQueue(item.pinyin);
      expect(queue.length).toBeGreaterThan(0);
      for (const file of queue) {
        expect(file).toMatch(/^[a-z0-9]+\.mp3$/);
      }
    }
  });

  it('单音节词条返回 1 个音频文件名', () => {
    expect(getPinyinAudioQueue('ā')).toEqual(['a1.mp3']);
    expect(getPinyinAudioQueue('yú')).toEqual(['yu2.mp3']);
  });

  it('双音节词条返回 2 个音频文件名', () => {
    expect(getPinyinAudioQueue('bà ba')).toEqual(['ba4.mp3', 'ba1.mp3']);
    expect(getPinyinAudioQueue('jú zi')).toEqual(['ju2.mp3', 'zi1.mp3']);
  });

  it('三字词条返回 3 个音频文件名', () => {
    expect(getPinyinAudioQueue('cā zhuō zi')).toEqual(['ca1.mp3', 'zhuo1.mp3', 'zi1.mp3']);
  });
});

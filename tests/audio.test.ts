import { describe, expect, it } from 'vitest';
import { canUseBrowserSpeech } from '../src/features/audio';

describe('拼音示范音策略', () => {
  it('不把拉丁字母或拼音串交给浏览器英文朗读', () => {
    expect(canUseBrowserSpeech('b')).toBe(false);
    expect(canUseBrowserSpeech('zhī')).toBe(false);
    expect(canUseBrowserSpeech('huǒ')).toBe(false);
  });

  it('中文提示可以使用浏览器中文朗读', () => {
    expect(canUseBrowserSpeech('三声')).toBe(true);
    expect(canUseBrowserSpeech('火')).toBe(true);
  });
});

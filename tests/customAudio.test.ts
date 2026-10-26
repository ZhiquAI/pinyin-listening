import { describe, expect, it } from 'vitest';
import {
  saveCustomAudioData,
  getCustomAudioData,
  deleteCustomAudioData,
  hasCustomAudioData,
} from '../src/features/customAudio';

describe('自录音频本地存储与替换', () => {
  it('能保存并读取自录音频数据', () => {
    const mockAudioData = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC...';
    saveCustomAudioData('w6_baba', mockAudioData);
    expect(hasCustomAudioData('w6_baba')).toBe(true);
    expect(getCustomAudioData('w6_baba')).toBe(mockAudioData);
  });

  it('能删除自定义音频恢复默认', () => {
    saveCustomAudioData('w6_mama', 'data:audio/webm;base64,...');
    expect(hasCustomAudioData('w6_mama')).toBe(true);
    deleteCustomAudioData('w6_mama');
    expect(hasCustomAudioData('w6_mama')).toBe(false);
    expect(getCustomAudioData('w6_mama')).toBeNull();
  });
});

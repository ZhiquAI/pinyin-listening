/**
 * 听写发音核心模块
 * 100% 采用实时自录真实人声配音，彻底移除机械合成音与浏览器机械朗读。
 */

import { getCustomAudioData } from './customAudio';

export interface PlayItemTarget {
  id: string;
  character: string;
  pinyin: string;
  speechHint?: string;
}

export interface PlayOptions {
  onStart?: () => void;
  onPlaybackStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  onNeedRecord?: () => void;
}

let activeCustomWordAudio: HTMLAudioElement | null = null;

export function stopAnySpeech(): void {
  if (activeCustomWordAudio) {
    activeCustomWordAudio.pause();
    activeCustomWordAudio.currentTime = 0;
    activeCustomWordAudio = null;
  }
}

/**
 * 播放词条发音：100% 仅播放实时录制真人原声
 */
export function playItemNaturally(target: PlayItemTarget, options: PlayOptions = {}): boolean {
  stopAnySpeech();

  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    options.onEnd?.();
    return false;
  }

  // 100% 仅播放用户实时自录的原声
  if (target.id) {
    const customData = getCustomAudioData(target.id);
    if (customData) {
      options.onStart?.();
      const audio = new Audio(customData);
      activeCustomWordAudio = audio;
      audio.onplay = () => options.onPlaybackStart?.();
      audio.onended = () => {
        activeCustomWordAudio = null;
        options.onEnd?.();
      };
      audio.onerror = (e) => {
        activeCustomWordAudio = null;
        options.onError?.(e);
      };
      audio.play().catch((err) => {
        activeCustomWordAudio = null;
        options.onError?.(err);
      });
      return true;
    }
  }

  // 未录音时绝不播放机械音，直接触发需要录音提示
  options.onNeedRecord?.();
  options.onEnd?.();
  return false;
}

export function canUseBrowserSpeech(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

export function getSpokenTextForDictation(target: { character: string; pinyin?: string; speechHint?: string }): string {
  if (canUseBrowserSpeech(target.character)) {
    return target.character;
  }
  return target.speechHint || target.character;
}

export function speakText(_text: string, options: PlayOptions = {}): void {
  options.onNeedRecord?.();
  options.onEnd?.();
}

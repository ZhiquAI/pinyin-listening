/**
 * 听写发音核心路由器
 * 优先且全面采用本地高保真 MP3 真人普通话播音员原声
 */

import {
  playNaturalWordAudio,
  stopPinyinAudio,
} from './pinyinSound';
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
}

let activeCustomWordAudio: HTMLAudioElement | null = null;

export function stopAnySpeech(): void {
  stopPinyinAudio();
  if (activeCustomWordAudio) {
    activeCustomWordAudio.pause();
    activeCustomWordAudio.currentTime = 0;
    activeCustomWordAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * 播放词条发音：100% 优先播放家长自录音频，其次本地真人播音员 MP3
 */
export function playItemNaturally(target: PlayItemTarget, options: PlayOptions = {}): void {
  stopAnySpeech();

  // 0. 优先播放家长自录音频
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
      return;
    }
  }

  // 直接调用本地 MP3 队列发音
  playNaturalWordAudio(target.pinyin, {
    onStart: options.onStart,
    onPlaybackStart: options.onPlaybackStart,
    onEnd: options.onEnd,
    onError: (err) => {
      console.warn('MP3 playback failed, fallback to SpeechSynthesis:', err);
      fallbackBrowserSpeech(target, options);
    },
  });
}

export function canUseBrowserSpeech(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

function fallbackBrowserSpeech(target: PlayItemTarget, options: PlayOptions): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return;
  }

  const textToSpeak = canUseBrowserSpeech(target.character)
    ? target.character
    : target.speechHint || target.character;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.onstart = () => options.onPlaybackStart?.();

    utterance.onend = () => options.onEnd?.();
    utterance.onerror = (e) => {
      options.onError?.(e);
      options.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    options.onError?.(err);
    options.onEnd?.();
  }
}

export function speakText(text: string, options: { rate?: number; onEnd?: () => void } = {}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = options.rate ?? 0.85;
    if (options.onEnd) utterance.onend = options.onEnd;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

export function getSpokenTextForDictation(target: { character: string; pinyin: string; speechHint?: string }): string {
  if (target.speechHint && target.speechHint.trim().length > 0) {
    return target.speechHint;
  }
  if (canUseBrowserSpeech(target.character)) {
    return target.character;
  }
  return target.pinyin;
}

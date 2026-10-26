/**
 * 小学一年级语文老师教学级自然拼读引擎
 * 拥有本地独立的拼读 MP3 库 (public/audio/spelling/*.mp3)，100% 覆盖所有词条
 * 例如：b—à—bà，爸爸！
 */

import { stopPinyinAudio } from './pinyinSound';
import { getCustomAudioData } from './customAudio';

export interface SpellingUnit {
  id?: string;
  character: string;
  pinyin: string;
}

export function getSpellingAudioUrl(itemId: string): string {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}audio/spelling/${itemId}.mp3`;
}

let activeSpellingAudio: HTMLAudioElement | null = null;
let activeSpellingSessionId = 0;

export function stopSpellingAudio(): void {
  activeSpellingSessionId++;
  stopPinyinAudio();
  if (activeSpellingAudio) {
    activeSpellingAudio.pause();
    activeSpellingAudio.currentTime = 0;
    activeSpellingAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * 核心拼读播放函数：
 * 优先播放本地专属的拼读 MP3 文件（如 /audio/spelling/w6_baba.mp3）
 * 包含真正的 "b—à—bà" 老师带读原声！
 */
export function playTeacherSpelling(
  unit: SpellingUnit,
  options: {
    onStart?: () => void;
    onPlaybackStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  } = {}
): void {
  stopSpellingAudio();
  const sessionId = ++activeSpellingSessionId;
  let playbackStarted = false;
  const notifyPlaybackStart = () => {
    if (!playbackStarted && sessionId === activeSpellingSessionId) {
      playbackStarted = true;
      options.onPlaybackStart?.();
    }
  };

  options.onStart?.();

  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    options.onEnd?.();
    return;
  }

  // 0. 优先检测家长自录真人音频
  if (unit.id) {
    const customData = getCustomAudioData(unit.id);
    if (customData) {
      const customAudio = new Audio(customData);
      activeSpellingAudio = customAudio;
      customAudio.onplaying = notifyPlaybackStart;

      let customEnded = false;
      const finishCustom = () => {
        if (!customEnded) {
          customEnded = true;
          if (activeSpellingAudio === customAudio) {
            activeSpellingAudio = null;
          }
          if (sessionId === activeSpellingSessionId) {
            options.onEnd?.();
          }
        }
      };

      customAudio.onended = finishCustom;
      customAudio.onerror = () => {
        if (!customEnded && sessionId === activeSpellingSessionId) {
          options.onEnd?.();
        }
      };

      customAudio.play().catch(() => {
        finishCustom();
      });
      return;
    }
  }

  // 1. 如果有 id，尝试播放本地预生成的专属拼读 MP3 库
  if (unit.id) {
    const mp3Url = getSpellingAudioUrl(unit.id);
    const audio = new Audio(mp3Url);
    activeSpellingAudio = audio;
    audio.onplaying = notifyPlaybackStart;

    let ended = false;
    const finish = () => {
      if (!ended) {
        ended = true;
        if (activeSpellingAudio === audio) {
          activeSpellingAudio = null;
        }
        if (sessionId === activeSpellingSessionId) {
          options.onEnd?.();
        }
      }
    };

    audio.onended = finish;

    audio.onerror = () => {
      console.warn('Spelling MP3 failed, fallback to dynamic speech:', mp3Url);
      if (!ended && sessionId === activeSpellingSessionId) {
        fallbackDynamicSpelling(unit, { ...options, onPlaybackStart: notifyPlaybackStart }, sessionId);
      }
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Audio play interrupted or blocked:', err);
        if (!ended && sessionId === activeSpellingSessionId) {
          fallbackDynamicSpelling(unit, { ...options, onPlaybackStart: notifyPlaybackStart }, sessionId);
        }
      });
    }
    return;
  }

  // 没有 id 时使用动态语音
  fallbackDynamicSpelling(unit, { ...options, onPlaybackStart: notifyPlaybackStart }, sessionId);
}

function fallbackDynamicSpelling(
  unit: SpellingUnit,
  options: { onPlaybackStart?: () => void; onEnd?: () => void; onError?: (err: unknown) => void },
  sessionId: number
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return;
  }

  const promptText = generateTeacherSpellingPrompt(unit);

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(promptText);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    utterance.onstart = () => {
      if (sessionId === activeSpellingSessionId) options.onPlaybackStart?.();
    };

    utterance.onend = () => {
      if (sessionId === activeSpellingSessionId) {
        options.onEnd?.();
      }
    };
    utterance.onerror = () => {
      if (sessionId === activeSpellingSessionId) {
        options.onEnd?.();
      }
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    options.onError?.(err);
    options.onEnd?.();
  }
}

const INITIAL_NAMES: Record<string, string> = {
  b: '波', p: '坡', m: '摸', f: '佛',
  d: '得', t: '特', n: '讷', l: '勒',
  g: '哥', k: '科', h: '喝',
  j: '基', q: '欺', x: '希',
  zh: '知', ch: '吃', sh: '诗', r: '日',
  z: '资', c: '疵', s: '思',
  y: '衣', w: '乌',
};

const WHOLE_SYLLABLES = new Set([
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying',
]);

const TONE_CLEAN: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'u', ǘ: 'u', ǚ: 'u', ǜ: 'u', ü: 'u',
};

export interface SyllableDecomposition {
  rawPinyin: string;
  hanzi: string;
  isWhole: boolean;
  isThree: boolean;
  initial: string;
  medial?: string;
  final: string;
  speechText: string;
}

export function decomposeSyllable(pinyin: string, hanzi: string = ''): SyllableDecomposition {
  const raw = pinyin.trim().toLowerCase();
  const plain = raw.replace(/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜü]/g, (m) => TONE_CLEAN[m] || m);

  if (WHOLE_SYLLABLES.has(plain)) {
    return {
      rawPinyin: raw,
      hanzi,
      isWhole: true,
      isThree: false,
      initial: '',
      final: raw,
      speechText: hanzi ? `整体认读，${raw}，${hanzi}` : `整体认读，${raw}`,
    };
  }

  const inits = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  let init = '';
  for (const it of inits) {
    if (raw.startsWith(it)) {
      init = it;
      break;
    }
  }

  if (!init) {
    return {
      rawPinyin: raw,
      hanzi,
      isWhole: false,
      isThree: false,
      initial: '',
      final: raw,
      speechText: hanzi ? `${raw}，${hanzi}` : raw,
    };
  }

  const finalPart = raw.slice(init.length);
  const plainFinal = finalPart.replace(/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜü]/g, (m) => TONE_CLEAN[m] || m);

  const isThree =
    (plainFinal.startsWith('u') && plainFinal.length > 1 && !plainFinal.startsWith('un')) ||
    (plainFinal.startsWith('i') && plainFinal.length > 1 && !plainFinal.startsWith('in') && !plainFinal.startsWith('ing')) ||
    (plainFinal.startsWith('uu') && plainFinal.length > 2);

  const initName = INITIAL_NAMES[init] || init;

  if (isThree) {
    const medial = finalPart[0];
    const mainFinal = finalPart.slice(1);
    const medialName = medial === 'i' ? '衣' : medial === 'u' ? '乌' : '迂';

    return {
      rawPinyin: raw,
      hanzi,
      isWhole: false,
      isThree: true,
      initial: init,
      medial,
      final: mainFinal,
      speechText: `${initName}，${medialName}，${mainFinal}，${raw}。`,
    };
  }

  return {
    rawPinyin: raw,
    hanzi,
    isWhole: false,
    isThree: false,
    initial: init,
    final: finalPart,
    speechText: `${initName}，${finalPart}，${raw}。`,
  };
}

export function generateTeacherSpellingPrompt(unit: SpellingUnit): string {
  const pinyins = unit.pinyin.trim().split(/\s+/).filter(Boolean);
  const hanzis = Array.from(unit.character);

  if (pinyins.length === 1) {
    return decomposeSyllable(pinyins[0], unit.character).speechText;
  }

  const parts: string[] = [];
  for (let i = 0; i < pinyins.length; i++) {
    const hz = hanzis[i] || '';
    const decomp = decomposeSyllable(pinyins[i], hz);
    parts.push(decomp.speechText);
  }

  parts.push(unit.character);
  return parts.join('；');
}

export function getSpellingSyllables(pinyin: string): string[] {
  return pinyin.trim().split(/\s+/).filter(Boolean);
}

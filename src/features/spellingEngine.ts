/**
 * 小学一年级语文自然拼读引擎
 * 100% 采用家长/教师实时自录原声，彻底移除所有机械合成音与机器人朗读。
 */

import { getCustomAudioData } from './customAudio';

export interface SpellingUnit {
  id?: string;
  character: string;
  pinyin: string;
}

let activeSpellingAudio: HTMLAudioElement | null = null;
let activeSpellingSessionId = 0;

export function stopSpellingAudio(): void {
  activeSpellingSessionId++;
  if (activeSpellingAudio) {
    activeSpellingAudio.pause();
    activeSpellingAudio.currentTime = 0;
    activeSpellingAudio = null;
  }
}

/**
 * 核心拼读播放函数：100% 仅播放实时录制真人原声
 */
export function playTeacherSpelling(
  unit: SpellingUnit,
  options: {
    onStart?: () => void;
    onPlaybackStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
    onNeedRecord?: () => void;
  } = {}
): boolean {
  stopSpellingAudio();
  const sessionId = ++activeSpellingSessionId;
  let playbackStarted = false;
  const notifyPlaybackStart = () => {
    if (!playbackStarted && sessionId === activeSpellingSessionId) {
      playbackStarted = true;
      options.onPlaybackStart?.();
    }
  };

  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    options.onEnd?.();
    return false;
  }

  // 100% 仅播放家长/教师实时录制真人音频
  if (unit.id) {
    const customData = getCustomAudioData(unit.id);
    if (customData) {
      options.onStart?.();
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
      return true;
    }
  }

  // 若未录音，绝不播放任何机械音，直接触发需要录音提示
  options.onNeedRecord?.();
  options.onEnd?.();
  return false;
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

const MEDIALS = new Set(['i', 'u', 'ü', 'v']);

export interface DecomposedSyllable {
  rawPinyin: string;
  cleanPinyin: string;
  initial?: string;
  medial?: string;
  final?: string;
  isWhole: boolean;
  isThree: boolean;
}

export function cleanTone(pinyin: string): string {
  const map: Record<string, string> = {
    ā: 'a', á: 'a', ǎ: 'a', à: 'a',
    ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
    ē: 'e', é: 'e', ě: 'e', è: 'e',
    ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
    ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
    ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü', ü: 'ü', v: 'ü',
  };
  return pinyin
    .split('')
    .map((c) => map[c] || c)
    .join('');
}

export function decomposeSyllable(pinyinWithTone: string): DecomposedSyllable {
  const clean = cleanTone(pinyinWithTone).toLowerCase();

  if (WHOLE_SYLLABLES.has(clean)) {
    return {
      rawPinyin: pinyinWithTone,
      cleanPinyin: clean,
      isWhole: true,
      isThree: false,
    };
  }

  let initial = '';
  for (const testInit of ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']) {
    if (clean.startsWith(testInit)) {
      initial = testInit;
      break;
    }
  }

  const remainder = clean.slice(initial.length);

  if (remainder.length >= 2 && MEDIALS.has(remainder[0])) {
    return {
      rawPinyin: pinyinWithTone,
      cleanPinyin: clean,
      initial: initial || undefined,
      medial: remainder[0],
      final: remainder.slice(1),
      isWhole: false,
      isThree: true,
    };
  }

  return {
    rawPinyin: pinyinWithTone,
    cleanPinyin: clean,
    initial: initial || undefined,
    final: remainder || undefined,
    isWhole: false,
    isThree: false,
  };
}

export function getSpellingSyllables(pinyinStr: string): string[] {
  return pinyinStr.trim().split(/\s+/).filter(Boolean);
}

export function generateTeacherSpellingPrompt(unit: SpellingUnit): string {
  const syllables = getSpellingSyllables(unit.pinyin);
  const chars = Array.from(unit.character);

  const parts: string[] = [];

  for (let i = 0; i < syllables.length; i++) {
    const raw = syllables[i];
    const dec = decomposeSyllable(raw);
    const currChar = chars[i] || '';

    if (dec.isWhole) {
      parts.push(`整体认读音节，${dec.rawPinyin}，${currChar}`);
    } else if (dec.isThree && dec.initial && dec.medial && dec.final) {
      const initName = INITIAL_NAMES[dec.initial] || dec.initial;
      parts.push(`${initName}——${dec.medial}——${dec.final}——${dec.rawPinyin}，${currChar}`);
    } else if (dec.initial && dec.final) {
      const initName = INITIAL_NAMES[dec.initial] || dec.initial;
      parts.push(`${initName}——${dec.final}——${dec.rawPinyin}，${currChar}`);
    } else {
      parts.push(`${dec.rawPinyin}，${currChar}`);
    }
  }

  if (chars.length > 1) {
    parts.push(unit.character);
  }

  return parts.join('；');
}

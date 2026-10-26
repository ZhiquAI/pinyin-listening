/**
 * 拼音真人发音引擎与本地高保真 MP3 播放器
 * 1. 采用本地 public/audio/pinyin/ 的 160+ 个高质量真人普通话播音员原声音频；
 * 2. 100% 覆盖词库中的所有单音节与多音节词汇（如 'bà ba' -> ba4.mp3 + ba1.mp3）；
 * 3. 彻底摆脱浏览器 SpeechSynthesis 偶发静音与挂起缺陷；
 * 4. 具备严格的播放控制单例，杜绝自我打断与多次点击重叠。
 */

export const INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
] as const;

export const INITIAL_AUDIO_MAP: Record<string, string> = {
  b: 'bo1',
  p: 'po1',
  m: 'mo1',
  f: 'fo1',
  d: 'de1',
  t: 'te1',
  n: 'ne1',
  l: 'le1',
  g: 'ge1',
  k: 'ke1',
  h: 'he1',
  j: 'ji1',
  q: 'qi1',
  x: 'xi1',
  zh: 'zhi1',
  ch: 'chi1',
  sh: 'shi1',
  r: 'ri4',
  z: 'zi1',
  c: 'ci1',
  s: 'si1',
  y: 'yi1',
  w: 'wu1',
};

export const WHOLE_SYLLABLES = new Set([
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying',
]);

const TONE_CHAR_MAP: Record<string, { base: string; tone: string }> = {
  ā: { base: 'a', tone: '1' },
  á: { base: 'a', tone: '2' },
  ǎ: { base: 'a', tone: '3' },
  à: { base: 'a', tone: '4' },
  ō: { base: 'o', tone: '1' },
  ó: { base: 'o', tone: '2' },
  ǒ: { base: 'o', tone: '3' },
  ò: { base: 'o', tone: '4' },
  ē: { base: 'e', tone: '1' },
  é: { base: 'e', tone: '2' },
  ě: { base: 'e', tone: '3' },
  è: { base: 'e', tone: '4' },
  ī: { base: 'i', tone: '1' },
  í: { base: 'i', tone: '2' },
  ǐ: { base: 'i', tone: '3' },
  ì: { base: 'i', tone: '4' },
  ū: { base: 'u', tone: '1' },
  ú: { base: 'u', tone: '2' },
  ǔ: { base: 'u', tone: '3' },
  ù: { base: 'u', tone: '4' },
  ǖ: { base: 'uu', tone: '1' },
  ǘ: { base: 'uu', tone: '2' },
  ǚ: { base: 'uu', tone: '3' },
  ǜ: { base: 'uu', tone: '4' },
  ü: { base: 'uu', tone: '1' },
};

/**
 * 将单个带调拼音转为本地 MP3 音频文件名 (如 huǒ -> huo3, bà -> ba4, lǜ -> luu4)
 */
export function pinyinToAudioName(pinyin: string): string {
  const clean = pinyin.trim().toLowerCase();
  if (INITIAL_AUDIO_MAP[clean]) {
    return INITIAL_AUDIO_MAP[clean];
  }

  let tone = '1';
  let baseStr = '';
  for (const ch of clean) {
    if (TONE_CHAR_MAP[ch]) {
      baseStr += TONE_CHAR_MAP[ch].base;
      tone = TONE_CHAR_MAP[ch].tone;
    } else {
      baseStr += ch;
    }
  }

  baseStr = baseStr.replace(/ü/g, 'uu');
  baseStr = baseStr.replace(/[^a-z]/g, '');

  if (baseStr === 'u') return 'wu1';
  if (baseStr === 'i') return 'yi1';
  if (baseStr === 'uu') return 'yu1';
  if (!baseStr) return 'a1';

  return baseStr + tone;
}

export function getPinyinAudioUrl(audioName: string): string {
  const file = audioName.endsWith('.mp3') ? audioName : `${audioName}.mp3`;
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}audio/pinyin/${file}`;
}

export function getFallbackCdnUrl(audioName: string): string {
  const file = audioName.endsWith('.mp3') ? audioName : `${audioName}.mp3`;
  return `https://cdn.jsdelivr.net/gh/davinfifield/mp3-chinese-pinyin-sound/mp3/${file}`;
}

/**
 * 将词语的所有拼音拆分为按顺序播放的 MP3 队列
 * 例如 'bà ba' -> ['ba4.mp3', 'ba1.mp3']
 * 'cā zhuō zi' -> ['ca1.mp3', 'zhuo1.mp3', 'zi1.mp3']
 */
export function getPinyinAudioQueue(pinyin: string): string[] {
  const syllables = pinyin.trim().split(/\s+/).filter(Boolean);
  return syllables.map((s) => `${pinyinToAudioName(s)}.mp3`);
}

export interface SpellingStep {
  label: string;
  audioName: string;
}

export function parseSpellingSequence(syllable: string): SpellingStep[] {
  const raw = syllable.trim().toLowerCase();
  const wholeCandidate = raw.replace(/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜü]/g, (m) => TONE_CHAR_MAP[m]?.base || m);

  if (WHOLE_SYLLABLES.has(wholeCandidate)) {
    return [{ label: raw, audioName: pinyinToAudioName(raw) }];
  }

  let matchedInitial = '';
  for (const init of INITIALS) {
    if (raw.startsWith(init)) {
      matchedInitial = init;
      break;
    }
  }

  if (!matchedInitial) {
    return [{ label: raw, audioName: pinyinToAudioName(raw) }];
  }

  const finalPart = raw.slice(matchedInitial.length);
  if (!finalPart) {
    return [{ label: raw, audioName: INITIAL_AUDIO_MAP[matchedInitial] || 'bo1' }];
  }

  const plainFinal = finalPart.replace(/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜü]/g, (m) => TONE_CHAR_MAP[m]?.base || m);
  const isThreePinyin =
    (plainFinal.startsWith('u') && plainFinal.length > 1 && !plainFinal.startsWith('un')) ||
    (plainFinal.startsWith('i') && plainFinal.length > 1 && !plainFinal.startsWith('in') && !plainFinal.startsWith('ing')) ||
    (plainFinal.startsWith('uu') && plainFinal.length > 2);

  if (isThreePinyin) {
    const medialChar = finalPart[0];
    const mainFinalPart = finalPart.slice(1);
    const medialAudio = medialChar === 'i' ? 'yi1' : medialChar === 'u' ? 'wu1' : 'yu1';

    return [
      { label: matchedInitial, audioName: INITIAL_AUDIO_MAP[matchedInitial] },
      { label: medialChar, audioName: medialAudio },
      { label: mainFinalPart, audioName: pinyinToAudioName(mainFinalPart) },
      { label: raw, audioName: pinyinToAudioName(raw) },
    ];
  }

  return [
    { label: matchedInitial, audioName: INITIAL_AUDIO_MAP[matchedInitial] },
    { label: finalPart, audioName: pinyinToAudioName(finalPart) },
    { label: raw, audioName: pinyinToAudioName(raw) },
  ];
}

export function buildWordFullSpelling(pinyin: string): SpellingStep[] {
  const syllables = pinyin.trim().split(/\s+/).filter(Boolean);
  const steps: SpellingStep[] = [];
  for (let i = 0; i < syllables.length; i++) {
    steps.push(...parseSpellingSequence(syllables[i]));
  }
  if (syllables.length > 1) {
    for (const syl of syllables) {
      steps.push({ label: syl, audioName: pinyinToAudioName(syl) });
    }
  }
  return steps;
}

// 全局播放控制器，确保任何时刻只有一个音频队列在发声
let activePlaybackSessionId = 0;
let currentHtmlAudio: HTMLAudioElement | null = null;

export function stopPinyinAudio(): void {
  activePlaybackSessionId++;
  if (currentHtmlAudio) {
    currentHtmlAudio.pause();
    currentHtmlAudio.currentTime = 0;
    currentHtmlAudio = null;
  }
}

/**
 * 播放单个音频文件
 */
function playAudioFile(fileName: string, sessionId: number, onPlaybackStart?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(true);
      return;
    }

    if (sessionId !== activePlaybackSessionId) {
      resolve(false);
      return;
    }

    const audio = new Audio(getPinyinAudioUrl(fileName));
    currentHtmlAudio = audio;
    let finished = false;
    audio.onplaying = () => {
      if (!finished && sessionId === activePlaybackSessionId) onPlaybackStart?.();
    };

    const cleanup = () => {
      if (currentHtmlAudio === audio) {
        currentHtmlAudio = null;
      }
    };

    audio.onended = () => {
      if (!finished) {
        finished = true;
        cleanup();
        resolve(sessionId === activePlaybackSessionId);
      }
    };

    audio.onerror = () => {
      // 本地若加载异常则尝试 CDN
      if (!finished) {
        audio.src = getFallbackCdnUrl(fileName);
        audio.play().catch(() => {
          finished = true;
          cleanup();
          resolve(sessionId === activePlaybackSessionId);
        });
      }
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Audio play failed or interrupted:', err);
        // 如果是因为自动播放拦截，静默 resolve
        if (!finished) {
          finished = true;
          cleanup();
          resolve(false);
        }
      });
    }
  });
}

/**
 * 核心发音函数：连续播放一个词的所有音节 MP3
 * 自然间隔 70ms，流畅顺耳
 */
export async function playNaturalWordAudio(
  pinyin: string,
  options: {
    onStart?: () => void;
    onPlaybackStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  } = {}
): Promise<void> {
  stopPinyinAudio();
  const sessionId = ++activePlaybackSessionId;

  options.onStart?.();

  let playbackStarted = false;
  const notifyPlaybackStart = () => {
    if (!playbackStarted && sessionId === activePlaybackSessionId) {
      playbackStarted = true;
      options.onPlaybackStart?.();
    }
  };
  const queue = getPinyinAudioQueue(pinyin);

  try {
    for (let i = 0; i < queue.length; i++) {
      if (sessionId !== activePlaybackSessionId) break;

      const continueNext = await playAudioFile(queue[i], sessionId, notifyPlaybackStart);
      if (!continueNext || sessionId !== activePlaybackSessionId) break;

      // 音节之间的短促过渡
      if (i < queue.length - 1) {
        await new Promise((r) => setTimeout(r, 70));
      }
    }
  } catch (err) {
    options.onError?.(err);
  } finally {
    if (sessionId === activePlaybackSessionId) {
      options.onEnd?.();
    }
  }
}

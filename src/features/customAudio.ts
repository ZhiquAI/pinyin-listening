/**
 * 家长自录真人原声管理模块
 * 1. 允许家长在网页内直接点击录音并一键绑定到指定词条；
 * 2. 音频数据安全持久化保存在当前设备浏览器；
 * 3. 优先级最高：一旦检测到家长自录音频，点读时 100% 播放家长的温暖原声；
 * 4. 支持导入、导出备份及上传本地文件替换。
 */

const STORAGE_PREFIX = 'pinyin_custom_audio_';

// 内存轻量缓存（兼容测试与无 window 环境）
const memoryStore: Record<string, string> = {};

export function hasCustomAudioData(itemId: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return !!memoryStore[itemId];
  }
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + itemId) !== null;
  } catch {
    return !!memoryStore[itemId];
  }
}

export function getCustomAudioData(itemId: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryStore[itemId] || null;
  }
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + itemId) || memoryStore[itemId] || null;
  } catch {
    return memoryStore[itemId] || null;
  }
}

export function saveCustomAudioData(itemId: string, dataUrl: string): void {
  memoryStore[itemId] = dataUrl;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + itemId, dataUrl);
    } catch (e) {
      console.warn('LocalStorage save failed, cached in memory:', e);
    }
  }
}

export function deleteCustomAudioData(itemId: string): void {
  delete memoryStore[itemId];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + itemId);
    } catch {}
  }
}

export function getAllCustomRecordedIds(): string[] {
  const ids: string[] = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          ids.push(key.slice(STORAGE_PREFIX.length));
        }
      }
    } catch {}
  }
  return Array.from(new Set([...ids, ...Object.keys(memoryStore)]));
}

/**
 * 导出全部自录音频为 JSON 字符串
 */
export function exportAllCustomAudioJson(): string {
  const ids = getAllCustomRecordedIds();
  const dump: Record<string, string> = {};
  for (const id of ids) {
    const val = getCustomAudioData(id);
    if (val) {
      dump[id] = val;
    }
  }
  return JSON.stringify(dump, null, 2);
}

/**
 * 导入自录音频数据
 */
export function importCustomAudioJson(jsonStr: string): number {
  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed !== 'object' || parsed === null) return 0;
    let count = 0;
    for (const [id, dataUrl] of Object.entries(parsed)) {
      if (typeof id === 'string' && typeof dataUrl === 'string' && dataUrl.startsWith('data:audio/')) {
        saveCustomAudioData(id, dataUrl);
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * 家长自录真人原声管理模块
 * 1. 允许家长在网页内直接点击录音并一键绑定到指定词条；
 * 2. 支持本地开发环境自动持久化写入 public/audio/custom/{itemId}.wav 并同步至 GitHub 仓库；
 * 3. 部署到 GitHub Pages 后，公共音频库（public/audio/custom/）对所有设备访客可见；
 * 4. 本地用户自录享有最高优先覆盖权。
 */

import publicAudioManifest from '../../public/audio/custom/manifest.json';

const STORAGE_PREFIX = 'pinyin_custom_audio_';

// 内存轻量缓存（兼容测试与无 window 环境）
const memoryStore: Record<string, string> = {};

export function getPublicStaticAudioUrl(itemId: string): string | null {
  const manifest = publicAudioManifest as Record<string, string>;
  const fileName = manifest[itemId];
  if (!fileName) return null;
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}audio/custom/${fileName}`;
}

export function hasCustomAudioData(itemId: string): boolean {
  if (memoryStore[itemId]) return true;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (window.localStorage.getItem(STORAGE_PREFIX + itemId) !== null) {
        return true;
      }
    } catch {}
  }
  // 检查 GitHub 公共音频库中是否已有此录音
  return !!getPublicStaticAudioUrl(itemId);
}

export function getCustomAudioData(itemId: string): string | null {
  if (memoryStore[itemId]) return memoryStore[itemId];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + itemId);
      if (saved) return saved;
    } catch {}
  }
  // 回退至 GitHub 静态公共音频库
  return getPublicStaticAudioUrl(itemId);
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

  // 若处于本地 Vite 开发环境，自动将音频落盘为 public/audio/custom/{itemId}.wav
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    fetch('/__api/save-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, dataUrl }),
    }).catch(() => {});
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

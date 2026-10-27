/**
 * iPad / 前端直连 GitHub 仓库同步模块
 * 允许用户直接在 iPad 浏览器中通过 GitHub REST API 将录制的音频文件与 manifest 同步至 GitHub 仓库。
 */

import { getAllCustomRecordedIds, getCustomAudioData } from './customAudio';

const GITHUB_TOKEN_KEY = 'pinyin_github_token';
const GITHUB_REPO_KEY = 'pinyin_github_repo';
const DEFAULT_REPO = 'ZhiquAI/pinyin-listening';

const memoryConfig: Record<string, string> = {};

export function getGitHubToken(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryConfig[GITHUB_TOKEN_KEY] || '';
  }
  try {
    return window.localStorage.getItem(GITHUB_TOKEN_KEY) || memoryConfig[GITHUB_TOKEN_KEY] || '';
  } catch {
    return memoryConfig[GITHUB_TOKEN_KEY] || '';
  }
}

export function saveGitHubToken(token: string): void {
  const trimmed = token.trim();
  memoryConfig[GITHUB_TOKEN_KEY] = trimmed;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (trimmed) {
        window.localStorage.setItem(GITHUB_TOKEN_KEY, trimmed);
      } else {
        window.localStorage.removeItem(GITHUB_TOKEN_KEY);
      }
    } catch {}
  }
}

export function getGitHubRepo(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryConfig[GITHUB_REPO_KEY] || DEFAULT_REPO;
  }
  try {
    return window.localStorage.getItem(GITHUB_REPO_KEY) || memoryConfig[GITHUB_REPO_KEY] || DEFAULT_REPO;
  } catch {
    return memoryConfig[GITHUB_REPO_KEY] || DEFAULT_REPO;
  }
}

export function saveGitHubRepo(repo: string): void {
  const val = repo.trim() || DEFAULT_REPO;
  memoryConfig[GITHUB_REPO_KEY] = val;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(GITHUB_REPO_KEY, val);
    } catch {}
  }
}

interface GitHubFileResponse {
  sha?: string;
  message?: string;
}

/**
 * 获取 GitHub 仓库上某个文件当前的 SHA（若不存在返回 null）
 */
async function getFileSha(
  repo: string,
  filePath: string,
  token: string
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (res.ok) {
      const data = (await res.json()) as GitHubFileResponse;
      return data.sha || null;
    }
    if (res.status === 404) return null;
    throw new Error(`读取 GitHub 文件失败（${res.status}）`);
  } catch (error) {
    throw error;
  }
}

/**
 * 通过 GitHub REST API 创建或更新单个文件
 */
export async function pushFileToGitHub(
  repo: string,
  filePath: string,
  contentBase64: string,
  commitMessage: string,
  token: string
): Promise<boolean> {
  const sha = await getFileSha(repo, filePath, token);

  const bodyPayload: Record<string, string> = {
    message: commitMessage,
    content: contentBase64,
    branch: 'main',
  };
  if (sha) {
    bodyPayload.sha = sha;
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API Error (${res.status}): ${errText}`);
  }
  return true;
}

/**
 * 同步单个词条音频到 GitHub
 */
export async function syncSingleAudioToGitHub(
  itemId: string,
  dataUrl: string,
  characterName: string = ''
): Promise<boolean> {
  const token = getGitHubToken();
  const repo = getGitHubRepo();
  if (!token) {
    throw new Error('未配置 GitHub Token，请先在设置中填入 Token');
  }

  // 剥离 dataUrl 头部，纯 Base64 内容
  const match = /^data:audio\/(wav|wave|x-wav|webm|mp4|aac)(?:;[^,]*)?;base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) throw new Error('不支持此录音格式');
  const extension = ['wave', 'x-wav'].includes(match[1]) ? 'wav' : match[1];
  const base64Content = match[2];
  const filePath = `public/audio/custom/${itemId}.${extension}`;
  const commitMsg = `feat(audio): iPad录入原声 [${characterName || itemId}]`;

  // 1. 上传音频本身
  await pushFileToGitHub(repo, filePath, base64Content, commitMsg, token);

  // 2. 更新 manifest.json
  try {
    const manifestPath = 'public/audio/custom/manifest.json';
    let manifest: Record<string, string> = {};
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${manifestPath}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    let manifestSha: string | null = null;
    if (res.ok) {
      const data = await res.json();
      manifestSha = data.sha;
      if (data.content) {
        // Base64 解码 JSON
        const rawJson = decodeURIComponent(
          escape(atob(data.content.replace(/\s+/g, '')))
        );
        manifest = JSON.parse(rawJson);
      }
    }
    if (!res.ok && res.status !== 404) throw new Error(`读取录音索引失败（${res.status}）`);
    manifest[itemId] = `${itemId}.${extension}`;

    const newManifestJson = JSON.stringify(manifest, null, 2);
    // Base64 编码 UTF-8 字符串
    const encodedManifest = btoa(unescape(encodeURIComponent(newManifestJson)));

    const manifestPayload: Record<string, string> = {
      message: `chore(audio): 更新录音索引清单 [${itemId}]`,
      content: encodedManifest,
      branch: 'main',
    };
    if (manifestSha) {
      manifestPayload.sha = manifestSha;
    }

    const updateResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${manifestPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manifestPayload),
    });
    if (!updateResponse.ok) throw new Error(`更新录音索引失败（${updateResponse.status}）`);
  } catch (manifestErr) {
    throw new Error(`录音已上传，但索引更新失败：${manifestErr instanceof Error ? manifestErr.message : String(manifestErr)}`);
  }

  return true;
}

/**
 * 一键将 iPad 上录制的所有音频批量同步到 GitHub
 */
export async function syncAllAudiosToGitHub(
  onProgress?: (current: number, total: number, itemName: string) => void
): Promise<{ success: number; failed: number }> {
  const token = getGitHubToken();
  const repo = getGitHubRepo();
  if (!token) {
    throw new Error('未配置 GitHub Token，请先在设置中填入 Token');
  }

  const ids = getAllCustomRecordedIds();
  if (ids.length === 0) {
    return { success: 0, failed: 0 };
  }

  let successCount = 0;
  let failedCount = 0;
  const manifestUpdates: Record<string, string> = {};

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const dataUrl = getCustomAudioData(id);
    if (!dataUrl || !dataUrl.startsWith('data:audio/')) continue;

    onProgress?.(i + 1, ids.length, id);
    try {
      const match = /^data:audio\/(wav|wave|x-wav|webm|mp4|aac)(?:;[^,]*)?;base64,([\s\S]+)$/.exec(dataUrl);
      if (!match) throw new Error('不支持此录音格式');
      const extension = ['wave', 'x-wav'].includes(match[1]) ? 'wav' : match[1];
      const base64Content = match[2];
      const filePath = `public/audio/custom/${id}.${extension}`;
      await pushFileToGitHub(
        repo,
        filePath,
        base64Content,
        `feat(audio): iPad批量同步原声 [${id}]`,
        token
      );
      manifestUpdates[id] = `${id}.${extension}`;
      successCount++;
    } catch (err) {
      console.error(`Failed to push audio for ${id}:`, err);
      failedCount++;
    }
  }

  // 统一更新一次远程 manifest.json
  if (Object.keys(manifestUpdates).length > 0) {
    try {
      const manifestPath = 'public/audio/custom/manifest.json';
      let manifest: Record<string, string> = {};
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${manifestPath}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      let manifestSha: string | null = null;
      if (res.ok) {
        const data = await res.json();
        manifestSha = data.sha;
        if (data.content) {
          const rawJson = decodeURIComponent(
            escape(atob(data.content.replace(/\s+/g, '')))
          );
          manifest = JSON.parse(rawJson);
        }
      }
      if (!res.ok && res.status !== 404) throw new Error(`读取录音索引失败（${res.status}）`);
      Object.assign(manifest, manifestUpdates);
      const newManifestJson = JSON.stringify(manifest, null, 2);
      const encodedManifest = btoa(unescape(encodeURIComponent(newManifestJson)));

      const manifestPayload: Record<string, string> = {
        message: `chore(audio): 批量更新录音索引清单 (${Object.keys(manifestUpdates).length}首)`,
        content: encodedManifest,
        branch: 'main',
      };
      if (manifestSha) {
        manifestPayload.sha = manifestSha;
      }

      const updateResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${manifestPath}`, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(manifestPayload),
      });
      if (!updateResponse.ok) throw new Error(`更新录音索引失败（${updateResponse.status}）`);
    } catch (err) {
      throw new Error(`录音已上传，但索引更新失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { success: successCount, failed: failedCount };
}

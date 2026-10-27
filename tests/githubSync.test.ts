import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getGitHubToken,
  saveGitHubToken,
  getGitHubRepo,
  saveGitHubRepo,
} from '../src/features/githubSync';

describe('githubSync iPad 前端直连同步模块', () => {
  beforeEach(() => {
    saveGitHubToken('');
    saveGitHubRepo('ZhiquAI/pinyin-listening');
  });

  it('能保存并读取 GitHub Token', () => {
    expect(getGitHubToken()).toBe('');
    saveGitHubToken('ghp_test123456789');
    expect(getGitHubToken()).toBe('ghp_test123456789');
  });

  it('能读取并修改自定义 GitHub 仓库路径', () => {
    expect(getGitHubRepo()).toBe('ZhiquAI/pinyin-listening');
    saveGitHubRepo('myuser/custom-repo');
    expect(getGitHubRepo()).toBe('myuser/custom-repo');
  });
});

it('索引上传失败时不会报告同步成功', async () => {
  const { syncSingleAudioToGitHub } = await import('../src/features/githubSync');
  saveGitHubToken('test-token');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ sha: 'old', content: btoa('{}') }), { status: 200 }))
    .mockResolvedValueOnce(new Response('conflict', { status: 409 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(syncSingleAudioToGitHub('word1', 'data:audio/wav;base64,dGVzdA==')).rejects.toThrow();
  vi.unstubAllGlobals();
});

it('读取索引失败时不会用空索引覆盖已有记录', async () => {
  const { syncSingleAudioToGitHub } = await import('../src/features/githubSync');
  saveGitHubToken('test-token');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    .mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(syncSingleAudioToGitHub('word1', 'data:audio/wav;base64,dGVzdA==')).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  vi.unstubAllGlobals();
});

it('保留录音的实际格式供其他设备播放', async () => {
  const { syncSingleAudioToGitHub } = await import('../src/features/githubSync');
  saveGitHubToken('test-token');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ sha: 'old', content: btoa('{}') }), { status: 200 }))
    .mockResolvedValueOnce(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await syncSingleAudioToGitHub('word1', 'data:audio/webm;base64,dGVzdA==');
  expect(fetchMock.mock.calls[1][0]).toContain('/word1.webm');
  const manifestBody = JSON.parse(fetchMock.mock.calls[3][1].body);
  expect(JSON.parse(atob(manifestBody.content))).toEqual({ word1: 'word1.webm' });
  vi.unstubAllGlobals();
});

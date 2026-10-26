import { describe, it, expect, beforeEach } from 'vitest';
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

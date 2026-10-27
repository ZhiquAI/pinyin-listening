// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInlineRecording } from '../src/features/useInlineRecording';
import { saveCustomAudioData } from '../src/features/customAudio';
import { getGitHubToken, syncSingleAudioToGitHub } from '../src/features/githubSync';

vi.mock('../src/features/audioDSP', () => ({ enhanceAudioBlob: vi.fn(async () => 'data:audio/wav;base64,dGVzdA==') }));
vi.mock('../src/features/customAudio', () => ({ saveCustomAudioData: vi.fn() }));
vi.mock('../src/features/githubSync', () => ({ getGitHubToken: vi.fn(() => ''), syncSingleAudioToGitHub: vi.fn(async () => true) }));
vi.mock('../src/features/spellingEngine', () => ({ stopSpellingAudio: vi.fn() }));

class TestRecorder {
  static isTypeSupported() { return true; }
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly stream: MediaStream) {}
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function Recorder({ itemId }: { itemId: string }) {
  const recorder = useInlineRecording(itemId, () => {});
  return <button onClick={recorder.toggle}>{recorder.status}</button>;
}

describe('页面内录音', () => {
  let container: HTMLDivElement;
  let root: Root;
  let stopTrack: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    stopTrack = vi.fn();
    Object.defineProperty(globalThis, 'MediaRecorder', { value: TestRecorder, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) }, configurable: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('配置令牌后录音完成自动上传当前词条', async () => {
    vi.mocked(getGitHubToken).mockReturnValue('test-token');
    await act(async () => root.render(<Recorder itemId="word1" />));
    await act(async () => container.querySelector('button')!.click());
    await act(async () => container.querySelector('button')!.click());
    expect(syncSingleAudioToGitHub).toHaveBeenCalledWith('word1', 'data:audio/wav;base64,dGVzdA==');
  });

  it('切换词语时将录音保存到开始录制的词条', async () => {
    await act(async () => root.render(<Recorder itemId="first" />));
    await act(async () => container.querySelector('button')!.click());
    expect(container.textContent).toBe('recording');
    await act(async () => root.render(<Recorder itemId="second" />));
    expect(saveCustomAudioData).toHaveBeenCalledWith('first', 'data:audio/wav;base64,dGVzdA==');
    expect(saveCustomAudioData).not.toHaveBeenCalledWith('second', expect.anything());
    expect(stopTrack).toHaveBeenCalled();
  });

  it('切换词语后才获得麦克风权限时，立即释放麦克风', async () => {
    let release!: (stream: { getTracks: () => { stop: typeof stopTrack }[] }) => void;
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => new Promise((resolve) => { release = resolve; }) }, configurable: true });
    await act(async () => root.render(<Recorder itemId="first" />));
    await act(async () => { container.querySelector('button')!.click(); });
    expect(container.textContent).toBe('requesting');
    await act(async () => root.render(<Recorder itemId="second" />));
    await act(async () => release({ getTracks: () => [{ stop: stopTrack }] }));
    expect(stopTrack).toHaveBeenCalled();
    expect(saveCustomAudioData).not.toHaveBeenCalled();
    expect(container.textContent).toBe('idle');
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { enhanceAudioBlob } from './audioDSP';
import { saveCustomAudioData } from './customAudio';
import { stopSpellingAudio } from './spellingEngine';
import { getGitHubToken, syncSingleAudioToGitHub } from './githubSync';

type Status = 'idle' | 'requesting' | 'recording' | 'saving';
interface Session { id: string; recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: number | null }

function readAudio(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取录音'));
    reader.onerror = () => reject(new Error('无法读取录音'));
    reader.readAsDataURL(blob);
  });
}

/** 轻触开始，再次轻触完成；切换词条时保留录到原词条的声音。 */
export function useInlineRecording(itemId: string, onSaved: () => void) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const currentId = useRef(itemId);
  const savedCallback = useRef(onSaved);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const sequence = useRef(0);
  const latestForItem = useRef(new Map<string, number>());
  const active = useRef<Session | null>(null);
  currentId.current = itemId;
  savedCallback.current = onSaved;

  const stop = useCallback(() => {
    const session = active.current;
    if (!session) {
      requestVersion.current++;
      if (mounted.current) { setStatus('idle'); setMessage(''); }
      return;
    }
    active.current = null;
    if (session.timer !== null) window.clearTimeout(session.timer);
    if (session.recorder.state === 'recording') {
      if (mounted.current && currentId.current === session.id) { setStatus('saving'); setMessage('正在保存…'); }
      try { session.recorder.stop(); } catch {
        session.stream.getTracks().forEach((track) => track.stop());
        if (mounted.current && currentId.current === session.id) { setStatus('idle'); setMessage('录音未成功，请重试。'); }
      }
    } else {
      session.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestVersion.current++; stop(); };
  }, [stop]);
  useEffect(() => {
    setStatus('idle'); setMessage('');
    return () => { requestVersion.current++; stop(); };
  }, [itemId, stop]);

  const toggle = useCallback(async () => {
    if (active.current) { stop(); return; }
    if (status !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('当前浏览器暂不支持录音，请换用支持麦克风的浏览器。'); return;
    }
    const targetId = itemId;
    const requestId = ++requestVersion.current;
    stopSpellingAudio(); setStatus('requesting'); setMessage('正在连接麦克风…');
    let stream: MediaStream;
    try {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false } }); }
      catch {
        if (!mounted.current || requestId !== requestVersion.current || currentId.current !== targetId) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      if (mounted.current && requestId === requestVersion.current) { setStatus('idle'); setMessage('无法使用麦克风，请在浏览器中允许麦克风权限。'); }
      return;
    }
    if (!mounted.current || requestId !== requestVersion.current || currentId.current !== targetId) { stream.getTracks().forEach((track) => track.stop()); return; }
    try {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const token = ++sequence.current;
      const session: Session = { id: targetId, recorder, stream, chunks: [], timer: null };
      recorder.ondataavailable = (event) => { if (event.data.size > 0) session.chunks.push(event.data); };
      recorder.onerror = () => {
        if (active.current === session) active.current = null;
        if (session.timer !== null) window.clearTimeout(session.timer);
        stream.getTracks().forEach((track) => track.stop());
        if (mounted.current && currentId.current === targetId) { setStatus('idle'); setMessage('录音未成功，请重试。'); }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        try {
          const blob = new Blob(session.chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          if (!blob.size) throw new Error('没有录到声音，请重试。');
          let data: string;
          try { data = await enhanceAudioBlob(blob); } catch { data = await readAudio(new Blob([blob], { type: blob.type.split(';')[0] || 'audio/webm' })); }
          if (latestForItem.current.get(targetId) !== token) return;
          saveCustomAudioData(targetId, data);
          let stored = false;
          try { stored = localStorage.getItem(`pinyin_custom_audio_${targetId}`) === data; } catch {}
          if (mounted.current) savedCallback.current();
          if (mounted.current && currentId.current === targetId) { setStatus('idle'); setMessage(stored ? '已保存，点一下就能听。' : '录音暂存在当前页面，请检查浏览器存储空间。'); }
          if (getGitHubToken()) {
            if (mounted.current && currentId.current === targetId) setMessage('已保存，正在同步…');
            try {
              await syncSingleAudioToGitHub(targetId, data);
              if (mounted.current && currentId.current === targetId) setMessage('已上传，网站发布后可在其他设备收听。');
            } catch {
              if (mounted.current && currentId.current === targetId) setMessage('已保存在本机，同步失败，请检查网络和令牌。');
            }
          }
        } catch (error) {
          if (mounted.current && currentId.current === targetId) { setStatus('idle'); setMessage(error instanceof Error ? error.message : '保存失败，请重试。'); }
        }
      };
      recorder.start(100);
      latestForItem.current.set(targetId, token);
      active.current = session;
      session.timer = window.setTimeout(stop, 30000);
      setStatus('recording'); setMessage('录音中，再点一下完成。');
    } catch {
      active.current = null;
      stream.getTracks().forEach((track) => track.stop());
      if (mounted.current && currentId.current === targetId) { setStatus('idle'); setMessage('无法开始录音，请重试。'); }
    }
  }, [itemId, status, stop]);

  return { status, message, toggle, stop };
}

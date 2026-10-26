import React, { useState, useEffect, useRef } from 'react';
import { DictationItem } from '../content/dictation';
import {
  hasCustomAudioData,
  getCustomAudioData,
  saveCustomAudioData,
  deleteCustomAudioData,
} from '../features/customAudio';
import { playTeacherSpelling, stopSpellingAudio } from '../features/spellingEngine';

interface ParentRecordingModalProps {
  item: DictationItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAudioUpdated: (itemId: string) => void;
  itemsList?: DictationItem[];
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
}

export const ParentRecordingModal: React.FC<ParentRecordingModalProps> = ({
  item,
  isOpen,
  onClose,
  onAudioUpdated,
  itemsList,
  currentIndex = 0,
  onNavigate,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedBase64, setRecordedBase64] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasExistingCustom, setHasExistingCustom] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 初始化已有录音状态
  useEffect(() => {
    if (isOpen && item) {
      const exists = hasCustomAudioData(item.id);
      setHasExistingCustom(exists);
      const existingData = getCustomAudioData(item.id);
      if (existingData) {
        setRecordedBase64(existingData);
        setRecordedBlobUrl(existingData);
      } else {
        setRecordedBase64(null);
        setRecordedBlobUrl(null);
      }
      setErrorMessage(null);
      setIsRecording(false);
      setRecordSeconds(0);
      setSaveToast(null);
    }
  }, [isOpen, item]);

  // 清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  if (!isOpen || !item) return null;

  // 推荐台词生成（如：j—ú—jú · zi，橘子）
  const recommendedScript =
    item.teachingSteps && item.teachingSteps.length > 0
      ? `${item.teachingSteps.join(' · ')}，${item.character}！`
      : `${item.pinyin}，${item.character}！`;

  // 播放系统示范拼读
  const handlePlayDemo = () => {
    stopSpellingAudio();
    playTeacherSpelling({
      id: item.id,
      character: item.character,
      pinyin: item.pinyin,
    });
  };

  // 开始浏览器录音
  const startRecording = async () => {
    setErrorMessage(null);
    setSaveToast(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('您的浏览器环境不支持直接录音，建议使用本地文件上传功能。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        const blobUrl = URL.createObjectURL(audioBlob);
        setRecordedBlobUrl(blobUrl);

        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setRecordedBase64(reader.result);
          }
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setErrorMessage('无法获取麦克风权限，请在浏览器地址栏允许麦克风权限，或上传本地录音文件。');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // 试听当前录制/已有的声音
  const playPreview = () => {
    if (!recordedBlobUrl) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(recordedBlobUrl);
    previewAudioRef.current = audio;
    setIsPlayingPreview(true);

    audio.onended = () => {
      setIsPlayingPreview(false);
    };
    audio.onerror = () => {
      setIsPlayingPreview(false);
    };
    audio.play().catch(() => setIsPlayingPreview(false));
  };

  // 保存录音
  const handleSave = () => {
    if (!recordedBase64 || !item) return;
    saveCustomAudioData(item.id, recordedBase64);
    setHasExistingCustom(true);
    onAudioUpdated(item.id);

    // 如果是流水线模式，并且有下一题，自动切到下一题
    if (itemsList && onNavigate && currentIndex < itemsList.length - 1) {
      setSaveToast(`已保存！自动前往下一词：${itemsList[currentIndex + 1].character}`);
      setTimeout(() => {
        setSaveToast(null);
        onNavigate(currentIndex + 1);
      }, 800);
    } else {
      setSaveToast('录音保存成功！已设为默认发音。');
      setTimeout(() => setSaveToast(null), 1500);
    }
  };

  // 删除自录原声，恢复默认
  const handleDelete = () => {
    if (!item) return;
    deleteCustomAudioData(item.id);
    setHasExistingCustom(false);
    setRecordedBase64(null);
    setRecordedBlobUrl(null);
    onAudioUpdated(item.id);
    setSaveToast('已恢复系统默认发音。');
    setTimeout(() => setSaveToast(null), 1200);
  };

  // 处理本地音频文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        setRecordedBase64(result);
        setRecordedBlobUrl(result);
        setErrorMessage(null);
      }
    };
    reader.onerror = () => {
      setErrorMessage('读取音频文件失败，请确保格式为 mp3、wav 或 m4a。');
    };
    reader.readAsDataURL(file);
  };

  const hasPaging = itemsList && itemsList.length > 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="recording-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>🎙 家长真人原声录制室</h3>
            <p className="modal-subtitle">
              {item.dayLabel} · 亲切读给宝贝听
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 流水线快速切换导航条 */}
        {hasPaging && onNavigate && (
          <div className="pipeline-nav-bar">
            <button
              className="pipeline-nav-btn"
              disabled={currentIndex <= 0}
              onClick={() => onNavigate(currentIndex - 1)}
            >
              ◀ 上一词
            </button>
            <span className="pipeline-progress-text">
              词条 {currentIndex + 1} / {itemsList.length}
            </span>
            <button
              className="pipeline-nav-btn"
              disabled={currentIndex >= itemsList.length - 1}
              onClick={() => onNavigate(currentIndex + 1)}
            >
              下一词 ▶
            </button>
          </div>
        )}

        {/* 词条展示与示范 */}
        <div className="recording-target-card">
          <div className="target-hanzi">{item.character}</div>
          <div className="target-pinyin">{item.pinyin}</div>

          <div className="target-script-box">
            <span className="script-label">建议录音台词：</span>
            <span className="script-text">“{recommendedScript}”</span>
            <button className="demo-play-btn" onClick={handlePlayDemo} title="试听系统示范">
              🔊 示范
            </button>
          </div>
        </div>

        {/* 成功提示 */}
        {saveToast && <div className="save-toast-banner">✓ {saveToast}</div>}

        {/* 状态徽章 */}
        <div className="recording-status-strip">
          {hasExistingCustom ? (
            <span className="badge-custom-active">💖 当前已启用家长真人原声</span>
          ) : (
            <span className="badge-custom-empty">当前使用系统内置发音</span>
          )}
        </div>

        {/* 错误提示 */}
        {errorMessage && <div className="recording-error-alert">{errorMessage}</div>}

        {/* 录音主操作区 */}
        <div className="recorder-action-panel">
          {isRecording ? (
            <div className="recording-live-box">
              <div className="recording-pulse-dot" />
              <span className="recording-timer">录制中: {recordSeconds}s</span>
              <button className="btn-record-stop" onClick={stopRecording}>
                ⏹ 结束录音
              </button>
            </div>
          ) : (
            <div className="record-buttons-row">
              <button className="btn-record-start" onClick={startRecording}>
                🔴 开始录音
              </button>
              <button
                className="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
                title="导入手机或电脑录好的音频文件"
              >
                📁 上传音频
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
          )}

          {/* 录音生成后的试听与保存操作 */}
          {recordedBlobUrl && !isRecording && (
            <div className="recorded-preview-box">
              <div className="preview-label">录音已就绪，请试听效果：</div>
              <div className="preview-controls">
                <button
                  className={`btn-preview-play ${isPlayingPreview ? 'playing' : ''}`}
                  onClick={playPreview}
                >
                  {isPlayingPreview ? '🔊 正在试听…' : '▶ 试听我的声音'}
                </button>
                <button className="btn-save-custom" onClick={handleSave}>
                  💾 保存并应用 {hasPaging && currentIndex < itemsList.length - 1 ? '(跳下一词)' : ''}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作与批量说明 */}
        <div className="modal-footer-row">
          {hasExistingCustom && (
            <button className="btn-danger-clear" onClick={handleDelete}>
              🗑 恢复系统发音
            </button>
          )}
          <span className="footer-tip">
            💡 录完自动保存在本机，点读时优先播放。
          </span>
        </div>
      </div>
    </div>
  );
};

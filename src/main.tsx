import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { finalTable, getLearnedItems, initialTable, wholeSyllableTable } from './content/schema';
import { toneLabel } from './content/pinyin';
import { getVocabularyImage } from './content/vocabularyImages';
import {
  dictationWeeks,
  DictationItem,
  getAvailableWeeks,
  getWeekData,
  getCardEmoji,
  DICTATION_EMOJI_MAP,
} from './content/dictation';
import {
  playItemNaturally,
  stopAnySpeech,
  speakText,
} from './features/audio';
import {
  loadStarredIds,
  saveStarredIds,
  filterStarredItems,
  calculateCompletionStats,
} from './features/reviewSession';
import {
  playTeacherSpelling,
  stopSpellingAudio,
} from './features/spellingEngine';
import {
  hasCustomAudioData,
  saveCustomAudioData,
  deleteCustomAudioData,
} from './features/customAudio';
import { ParentRecordingModal } from './components/ParentRecordingModal';
import { PinyinWriting } from './components/PinyinWriting';
import './styles.css';

type Tab = 'read' | 'today' | 'basics' | 'parent';
type MaskMode = 'all' | 'hidePinyin' | 'hideHanzi';
type AudioMode = 'spelling' | 'word';

type IconName = 'down' | 'left' | 'right' | 'check' | 'close' | 'speaker' | 'star' | 'settings' | 'book' | 'trophy' | 'letters' | 'person' | 'mic';
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    down: <path d="m6 9 6 6 6-6" />,
    left: <path d="m15 5-7 7 7 7" />,
    right: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    speaker: <><path d="m11 4-6 5H2v6h3l6 5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
    settings: <><path d="m9 3-.6 2.2-2 .9-2-.6-2 3.5 1.6 1.6v2.3L2.5 15l2 3.5 2-.6 2 .9L9 21h6l.6-2.2 2-.9 2 .6 2-3.5-1.6-2.1v-2.3l1.5-1.6-2-3.5-2 .6-2-.9L15 3Z" /><circle cx="12" cy="12" r="3" /></>,
    book: <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" /></>,
    trophy: <><path d="M7 3h10v7a5 5 0 0 1-10 0Zm0 2H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4m-5 2v6m-4 0h8" /></>,
    letters: <><path d="m3 19 5-14 5 14M5 14h6m6-4h4l-4 9h4" /></>,
    person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const [tab, setTab] = useState<Tab>('read');
  const courseDialogRef = useRef<HTMLDialogElement>(null);
  const settingsDialogRef = useRef<HTMLDialogElement>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(9);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [maskMode, setMaskMode] = useState<MaskMode>('all');

  // 发音模式：'spelling' (带拼读) | 'word' (仅读词)
  const [audioMode, setAudioMode] = useState<AudioMode>('spelling');

  // 当前卡片是否已揭开遮挡
  const [revealed, setRevealed] = useState<boolean>(false);
  // 当前是否正在发音
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [writingReplay, setWritingReplay] = useState({ itemId: '', count: 0 });
  const resetWriting = useCallback(() => setWritingReplay((prev) => ({ ...prev, itemId: '' })), []);
  // 错题/重点收藏 ID 字典
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>(() => loadStarredIds());
  // 翻页是否自动发音
  const [autoPlayOnFlip, setAutoPlayOnFlip] = useState<boolean>(true);

  // 课时通关结算与错题专练状态
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isMistakeReviewOnly, setIsMistakeReviewOnly] = useState<boolean>(false);

  // 滑动手势状态
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const maxDragDistanceRef = useRef<number>(0);

  // 家长真人原声录制室状态
  const [recordingItem, setRecordingItem] = useState<DictationItem | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [, setCustomAudioVersion] = useState<number>(0);

  const openRecordModal = (item: DictationItem) => {
    stopSpellingAudio(); resetWriting();
    setRecordingItem(item);
    setIsRecordModalOpen(true);
  };

  // 卡片实时即录即播状态与智能静音检测
  const [isInlineRecording, setIsInlineRecording] = useState(false);
  const [inlineSeconds, setInlineSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // 0 ~ 1 动态音量波形
  const [silenceStatus, setSilenceStatus] = useState<string>(''); // 智能提示
  const inlineRecorderRef = useRef<MediaRecorder | null>(null);
  const inlineStreamRef = useRef<MediaStream | null>(null);
  const inlineChunksRef = useRef<Blob[]>([]);
  const inlineTimerRef = useRef<number | null>(null);
  const recordingTargetIdRef = useRef<string | null>(null);

  // Web Audio 与静音检测 Ref
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);
  const silenceStartRef = useRef<number | null>(null);

  const stopInlineRecording = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (inlineRecorderRef.current && inlineRecorderRef.current.state === 'recording') {
      try {
        inlineRecorderRef.current.stop();
      } catch {}
    }
    if (inlineStreamRef.current) {
      inlineStreamRef.current.getTracks().forEach((t) => t.stop());
      inlineStreamRef.current = null;
    }
    if (inlineTimerRef.current) {
      clearInterval(inlineTimerRef.current);
      inlineTimerRef.current = null;
    }
    setIsInlineRecording(false);
    setInlineSeconds(0);
    setAudioLevel(0);
    hasSpokenRef.current = false;
    silenceStartRef.current = null;
    setSilenceStatus('✓ 已保存');
    setTimeout(() => setSilenceStatus(''), 1500);
  }, []);

  const handleToggleInlineRecord = useCallback(
    async (itemId: string) => {
      // 若正在录音，再次点击立即手动完成并保存
      if (isInlineRecording) {
        stopInlineRecording();
        return;
      }

      // 开始实时录音
      stopSpellingAudio();
      resetWriting();
      recordingTargetIdRef.current = itemId;
      setSilenceStatus('请开始读…');
      hasSpokenRef.current = false;
      silenceStartRef.current = null;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('您的浏览器暂不支持直接录音，请在设置中允许麦克风权限。');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        inlineStreamRef.current = stream;
        inlineChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        inlineRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            inlineChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const targetId = recordingTargetIdRef.current;
          if (targetId && inlineChunksRef.current.length > 0) {
            const audioBlob = new Blob(inlineChunksRef.current, {
              type: mediaRecorder.mimeType || 'audio/webm',
            });
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                saveCustomAudioData(targetId, reader.result);
                setCustomAudioVersion((v) => v + 1);
              }
            };
            reader.readAsDataURL(audioBlob);
          }
          if (inlineStreamRef.current) {
            inlineStreamRef.current.getTracks().forEach((t) => t.stop());
            inlineStreamRef.current = null;
          }
        };

        // 挂载 Web Audio API 频谱分析器与智能静音检测
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);

          const bufferLen = analyser.frequencyBinCount;
          const dataArr = new Uint8Array(bufferLen);

          const checkWaveformAndSilence = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArr);

            let sum = 0;
            for (let i = 0; i < bufferLen; i++) {
              sum += dataArr[i];
            }
            const avg = sum / bufferLen; // 0 ~ 255
            const level = Math.min(1, avg / 80);
            setAudioLevel(level);

            const now = Date.now();
            // 音量超过 14，判定已经开始发声读拼音
            if (avg > 14) {
              hasSpokenRef.current = true;
              silenceStartRef.current = null;
              setSilenceStatus('正在录音…');
            } else if (hasSpokenRef.current) {
              // 读完后音量降至静音门限（<= 9）
              if (avg <= 9) {
                if (!silenceStartRef.current) {
                  silenceStartRef.current = now;
                  setSilenceStatus('检测停顿中…');
                } else {
                  const silenceElapsed = now - silenceStartRef.current;
                  if (silenceElapsed >= 1000) {
                    // 持续静音满 1 秒，智能自动停止并保存！
                    stopInlineRecording();
                    return;
                  }
                }
              } else {
                silenceStartRef.current = null;
                setSilenceStatus('正在录音…');
              }
            }

            rafIdRef.current = requestAnimationFrame(checkWaveformAndSilence);
          };

          rafIdRef.current = requestAnimationFrame(checkWaveformAndSilence);
        }

        mediaRecorder.start();
        setIsInlineRecording(true);
        setInlineSeconds(0);
        inlineTimerRef.current = window.setInterval(() => {
          setInlineSeconds((s) => {
            // 最长 8 秒自动兜底截止
            if (s >= 7) {
              stopInlineRecording();
            }
            return s + 1;
          });
        }, 1000);
      } catch (err) {
        console.error('Failed to start inline record:', err);
        alert('无法获取麦克风，请在浏览器地址栏允许麦克风权限后重试！');
      }
    },
    [isInlineRecording, resetWriting, stopInlineRecording]
  );

  const handleDeleteCustomAudio = useCallback((itemId: string) => {
    deleteCustomAudioData(itemId);
    setCustomAudioVersion((v) => v + 1);
  }, []);

  // 翻页或换课时自动停止未结束录音
  useEffect(() => {
    if (isInlineRecording) {
      stopInlineRecording();
    }
  }, [currentCardIndex, selectedWeek, selectedDayIndex, stopInlineRecording]);

  // 今日闯关卡旧状态
  const [selectedItem, setSelectedItem] = useState(getLearnedItems()[0]);
  const learned = useMemo(() => getLearnedItems(), []);

  const availableWeeks = useMemo(() => getAvailableWeeks(), []);
  const currentWeekData = useMemo(() => getWeekData(selectedWeek), [selectedWeek]);

  // 错题持久化
  useEffect(() => {
    saveStarredIds(starredIds);
  }, [starredIds]);

  // 当前课时原始所有词条
  const rawDayItems: DictationItem[] = useMemo(() => {
    if (!currentWeekData || !currentWeekData.days[selectedDayIndex]) {
      return currentWeekData?.days[0]?.items ?? [];
    }
    return currentWeekData.days[selectedDayIndex].items;
  }, [currentWeekData, selectedDayIndex]);

  // 实际参与轮转的词条列表
  const currentDayItems: DictationItem[] = useMemo(() => {
    if (isMistakeReviewOnly) {
      const filtered = filterStarredItems(rawDayItems, starredIds);
      return filtered.length > 0 ? filtered : rawDayItems;
    }
    return rawDayItems;
  }, [isMistakeReviewOnly, rawDayItems, starredIds]);

  // 当前展示的唯一单张大卡片
  const currentItem: DictationItem | undefined = currentDayItems[currentCardIndex];
  const currentImageUrl = currentItem?.imageUrl ?? getVocabularyImage(currentItem?.character ?? '');
  const selectedImageUrl = getVocabularyImage(selectedItem.character);

  // 当前课时的完成度统计
  const completionStats = useMemo(() => {
    const starredInThisDay = filterStarredItems(rawDayItems, starredIds);
    return calculateCompletionStats(rawDayItems.length, starredInThisDay.length);
  }, [rawDayItems, starredIds]);

  // 1. 播放老师式自然带读（带拼读）
  const handlePlaySpelling = useCallback(
    (itemToPlay?: DictationItem) => {
      const item = itemToPlay || currentItem;
      if (!item) return;

      stopSpellingAudio(); resetWriting();
      setIsSpeaking(true);

      playTeacherSpelling(item, {
        onStart: () => setIsSpeaking(true),
        onPlaybackStart: () => setWritingReplay((prev) => ({ itemId: item.id, count: prev.count + 1 })),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [currentItem]
  );

  // 2. 播放整词原声（仅读词）
  const handlePlayWord = useCallback(
    (itemToPlay?: DictationItem) => {
      const item = itemToPlay || currentItem;
      if (!item) return;

      stopSpellingAudio(); resetWriting();
      setIsSpeaking(true);

      playItemNaturally(item, {
        onStart: () => setIsSpeaking(true),
        onPlaybackStart: () => setWritingReplay((prev) => ({ itemId: item.id, count: prev.count + 1 })),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [currentItem]
  );

  // 默认发音入口（根据当前 audioMode 决定是带拼读还是仅读词）
  const handlePlayCurrent = useCallback(
    (itemToPlay?: DictationItem) => {
      if (audioMode === 'spelling') {
        handlePlaySpelling(itemToPlay);
      } else {
        handlePlayWord(itemToPlay);
      }
    },
    [audioMode, handlePlaySpelling, handlePlayWord]
  );

  // 翻到下一张
  const handleNextCard = useCallback(() => {
    if (currentCardIndex < currentDayItems.length - 1) {
      const nextIdx = currentCardIndex + 1;
      stopSpellingAudio(); resetWriting();      setIsSpeaking(false);      setCurrentCardIndex(nextIdx);
      setRevealed(false);
      if (autoPlayOnFlip && currentDayItems[nextIdx]) {
        handlePlayCurrent(currentDayItems[nextIdx]);
      }
    } else {
      setIsCompleted(true);
      stopSpellingAudio(); resetWriting();
    }
  }, [currentCardIndex, currentDayItems, autoPlayOnFlip, handlePlayCurrent]);

  // 翻到上一张
  const handlePrevCard = useCallback(() => {
    if (currentCardIndex > 0) {
      const prevIdx = currentCardIndex - 1;
      stopSpellingAudio(); resetWriting();      setIsSpeaking(false);      setCurrentCardIndex(prevIdx);
      setRevealed(false);
      if (autoPlayOnFlip && currentDayItems[prevIdx]) {
        handlePlayCurrent(currentDayItems[prevIdx]);
      }
    }
  }, [currentCardIndex, currentDayItems, autoPlayOnFlip, handlePlayCurrent]);

  // 重置课时
  useEffect(() => {
    stopSpellingAudio(); resetWriting();    setIsSpeaking(false);    setCurrentCardIndex(0);
    setRevealed(false);
    setDragOffset(0);
    setIsCompleted(false);
    setIsMistakeReviewOnly(false);
  }, [selectedWeek, selectedDayIndex]);

  // 键盘快捷键
  useEffect(() => {
    if (tab !== 'read' || isCompleted) return;

    function onKeyDown(e: KeyboardEvent) {
      if (document.querySelector('dialog[open]') || isRecordModalOpen) return;
      if (e.target instanceof Element && e.target.closest('button, input, select, textarea, a')) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handlePlayCurrent();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tab, isCompleted, isRecordModalOpen, handleNextCard, handlePrevCard, handlePlayCurrent]);

  // 触摸手势
  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    maxDragDistanceRef.current = 0;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    const diffX = e.touches[0].clientX - touchStartXRef.current;
    const diffY = e.touches[0].clientY - (touchStartYRef.current ?? e.touches[0].clientY);
    if (Math.abs(diffY) > Math.abs(diffX)) return;
    maxDragDistanceRef.current = Math.max(maxDragDistanceRef.current, Math.abs(diffX));
    setDragOffset(diffX);
  }

  function handleTouchEnd() {
    if (touchStartXRef.current !== null) {
      const threshold = 55;
      if (dragOffset < -threshold) {
        handleNextCard();
      } else if (dragOffset > threshold && currentCardIndex > 0) {
        handlePrevCard();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  // 鼠标手势
  function handleMouseDown(e: React.MouseEvent) {
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    maxDragDistanceRef.current = 0;
    setIsDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || touchStartXRef.current === null) return;
    const diffX = e.clientX - touchStartXRef.current;
    maxDragDistanceRef.current = Math.max(maxDragDistanceRef.current, Math.abs(diffX));
    setDragOffset(diffX);
  }

  function handleMouseUp() {
    if (isDragging && touchStartXRef.current !== null) {
      const threshold = 55;
      if (dragOffset < -threshold) {
        handleNextCard();
      } else if (dragOffset > threshold && currentCardIndex > 0) {
        handlePrevCard();
      }
    }
    touchStartXRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  // 单击卡片
  function handleCardClick() {
    if (maxDragDistanceRef.current > 12) return;
    if (maskMode !== 'all' && !revealed) {
      setRevealed(true);
    }
    handlePlayCurrent();
  }

  // 切换星标
  function toggleStar(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setStarredIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // 错题二轮复习
  function startMistakeReview() {
    setIsMistakeReviewOnly(true);
    setIsCompleted(false);
    stopSpellingAudio(); resetWriting();    setIsSpeaking(false);    setCurrentCardIndex(0);
    setRevealed(false);
  }

  function restartWholeDay() {
    setIsMistakeReviewOnly(false);
    setIsCompleted(false);
    stopSpellingAudio(); resetWriting();    setIsSpeaking(false);    setCurrentCardIndex(0);
    setRevealed(false);
  }

  function goToNextDay() {
    if (currentWeekData && selectedDayIndex < currentWeekData.days.length - 1) {
      setSelectedDayIndex(selectedDayIndex + 1);
    } else if (selectedWeek < availableWeeks[availableWeeks.length - 1]) {
      setSelectedWeek(selectedWeek + 1);
      setSelectedDayIndex(0);
    }
    setIsCompleted(false);
    setIsMistakeReviewOnly(false);
    stopSpellingAudio(); resetWriting();    setIsSpeaking(false);    setCurrentCardIndex(0);
    setRevealed(false);
  }

  const allStarredItems = useMemo(() => {
    const list: DictationItem[] = [];
    for (const week of dictationWeeks) {
      for (const day of week.days) {
        for (const item of day.items) {
          if (starredIds[item.id]) {
            list.push(item);
          }
        }
      }
    }
    return list;
  }, [starredIds]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><span className="brand-dot" />拼音小岛</div>
        <button className="course-picker" onClick={() => courseDialogRef.current?.showModal()} aria-haspopup="dialog">
          <span>第{selectedWeek}周 · {currentWeekData?.days[selectedDayIndex]?.dayLabel.match(/《(.+?)》/)?.[1] ?? '选择课时'}</span>
          <Icon name="down" />
        </button>
        <button className="icon-button settings-button" aria-label="练习设置" onClick={() => settingsDialogRef.current?.showModal()} aria-haspopup="dialog"><Icon name="settings" /></button>
      </header>

      <main className={tab === 'read' ? 'learning-main' : 'secondary-main'}>
        {/* iPad 滑动卡片点读舞台 */}
        {tab === 'read' && (
          <section className="ipad-stage">
            {/* 错题专练模式提示条 */}
            {isMistakeReviewOnly && (
              <div className="review-mode-banner">
                <span>🎯 正在进行错题巩固专练（共 {currentDayItems.length} 道待攻克）</span>
                <button className="exit-review-btn" onClick={restartWholeDay}>
                  退出错题模式，返回全部
                </button>
              </div>
            )}

            {/* 课时通关结算卡片 */}
            {isCompleted ? (
              <div className="completion-card">
                <div className="completion-celebrate">
                  {completionStats.isAllCorrect ? '🥇' : '🎉'}
                </div>
                <h2 className="completion-title">
                  {completionStats.isAllCorrect ? '太棒了！本课时全对通关！' : '本课时练习完成！'}
                </h2>
                <p className="completion-subtitle">
                  {currentWeekData?.days[selectedDayIndex]?.dayLabel}
                </p>

                {/* 统计指标 */}
                <div className="completion-stats-box">
                  <div className="stat-pill">
                    <b>{completionStats.totalCount}</b>
                    <span>已练总词数</span>
                  </div>
                  <div className="stat-pill">
                    <b>{completionStats.masteredCount}</b>
                    <span>已熟练掌握</span>
                  </div>
                  <div className={`stat-pill ${completionStats.starredCount > 0 ? 'warn' : ''}`}>
                    <b>{completionStats.starredCount}</b>
                    <span>需巩固错题</span>
                  </div>
                </div>

                {/* 错题列表 */}
                {completionStats.starredCount > 0 && (
                  <div className="starred-mistakes-section">
                    <div className="mistakes-title">
                      <span>★ 本次标记的重点错题（点击直接带拼读试听）：</span>
                    </div>
                    <div className="mistakes-grid">
                      {filterStarredItems(rawDayItems, starredIds).map((mItem) => (
                        <div
                          key={mItem.id}
                          className="mistake-chip"
                          onClick={() => handlePlaySpelling(mItem)}
                          title="点击听老师拼读"
                        >
                          <span>{mItem.character}</span>
                          <small>{mItem.pinyin}</small>
                          <span>🎙</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 行动按钮 */}
                <div className="completion-action-row">
                  {completionStats.starredCount > 0 && (
                    <button className="action-big-btn accent" onClick={startMistakeReview}>
                      🔁 针对这 {completionStats.starredCount} 道错题再练一遍
                    </button>
                  )}
                  <button className="action-big-btn secondary" onClick={restartWholeDay}>
                    🔄 从头再刷一遍
                  </button>
                  <button className="action-big-btn primary" onClick={goToNextDay}>
                    ▶ 前往下一课时
                  </button>
                </div>
              </div>
            ) : currentItem ? (
              /* 单张大卡片 (支持左右滑动) */
              <div
                className="swipe-canvas"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={() => { touchStartXRef.current = null; setIsDragging(false); setDragOffset(0); }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  className={`ipad-card ${isDragging ? 'dragging' : 'animating'} ${
                    isSpeaking ? 'speaking' : ''
                  }`}
                  style={{
                    transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.04}deg)`,
                  }}
                  onClick={handleCardClick}
                  aria-label="点读练习卡"
                >
                  <div className="card-top-row">
                    <div className="card-top-left">
                      <span className="card-progress" aria-live="polite">{currentCardIndex + 1} / {currentDayItems.length}</span>
                      {hasCustomAudioData(currentItem.id) ? (
                        <button
                          className="custom-voice-badge active"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRecordModal(currentItem);
                          }}
                          title="已录制家长原声，点击管理"
                        >
                          💖 家长原声
                        </button>
                      ) : (
                        <button
                          className="custom-voice-badge empty"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRecordModal(currentItem);
                          }}
                          title="录入我的声音"
                        >
                          🎙 录我声音
                        </button>
                      )}
                    </div>
                    <button
                      className={`star-btn ${starredIds[currentItem.id] ? 'starred' : ''}`}
                      onClick={(e) => toggleStar(currentItem.id, e)}
                      title={starredIds[currentItem.id] ? '已记入错题' : '标记为错题/需重点复习'}
                      aria-label={starredIds[currentItem.id] ? '取消重点标记' : '标记为重点词'}
                      aria-pressed={Boolean(starredIds[currentItem.id])}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Icon name="star" />
                    </button>
                  </div>

                  <div className="learning-content">
                    <div className={`picture-word ${currentItem.character.length > 3 ? 'long-word' : ''}`}>
                  {/* 词语配图 */}
                  <div
                    className={`card-image-box ${currentImageUrl ? 'has-real-image' : ''} ${
                      isSpeaking ? 'speaking-box' : ''
                    }`}
                  >
                    {currentImageUrl ? (
                      <img
                        src={currentImageUrl}
                        alt={currentItem.character}
                        className="real-card-img"
                        draggable={false}
                      />
                    ) : (
                      <div className="card-placeholder-art">
                        <span className="card-emoji-hero" role="img" aria-label={currentItem.character}>{getCardEmoji(currentItem)}</span>
                      </div>
                    )}
                  </div>

                    <div
                      className={`ipad-hanzi ${
                        maskMode === 'hideHanzi' && !revealed ? 'card-hidden' : ''
                      } ${revealed ? 'revealed' : ''}`}
                    >
                      {currentItem.character}
                    </div>

                    </div>
                    <div className="card-content-center writing-panel">
                      <div className={`writing-board ${maskMode === 'hidePinyin' && !revealed ? 'card-hidden' : ''}`}>
                        <PinyinWriting
                          key={currentItem.id}
                          pinyin={currentItem.pinyin}
                          replay={writingReplay.itemId === currentItem.id ? writingReplay.count : 0}
                        />
                      </div>
                      <p className="writing-caption">听一听，看看拼音怎么写</p>
                    <div className="card-action-buttons">
                      <button
                        className={`listen-button play-btn ${isSpeaking ? 'speaking' : ''} ${hasCustomAudioData(currentItem.id) ? 'has-custom-voice' : ''}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (maskMode !== 'all') setRevealed(true);
                          handlePlayCurrent();
                        }}
                      >
                        <Icon name="speaker" />
                        <span>
                          {isSpeaking
                            ? '正在朗读…'
                            : hasCustomAudioData(currentItem.id)
                            ? '点读我的原声'
                            : audioMode === 'spelling'
                            ? '听老师拼读'
                            : '听词语读音'}
                        </span>
                      </button>

                      <button
                        className={`inline-record-btn ${isInlineRecording ? 'recording' : ''} ${hasCustomAudioData(currentItem.id) ? 'recorded' : ''}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleInlineRecord(currentItem.id);
                        }}
                        title={isInlineRecording ? '点击可提前手动停止' : '点击开始录音（读完停顿1秒自动停止保存）'}
                      >
                        {isInlineRecording ? (
                          <div className="waveform-visualizer" aria-hidden="true">
                            <span className="wave-bar bar-1" style={{ transform: `scaleY(${Math.max(0.2, audioLevel * 1.6)})` }} />
                            <span className="wave-bar bar-2" style={{ transform: `scaleY(${Math.max(0.25, audioLevel * 2.3)})` }} />
                            <span className="wave-bar bar-3" style={{ transform: `scaleY(${Math.max(0.3, audioLevel * 3.0)})` }} />
                            <span className="wave-bar bar-4" style={{ transform: `scaleY(${Math.max(0.25, audioLevel * 2.1)})` }} />
                            <span className="wave-bar bar-5" style={{ transform: `scaleY(${Math.max(0.2, audioLevel * 1.5)})` }} />
                          </div>
                        ) : (
                          <Icon name="mic" />
                        )}
                        <span>
                          {isInlineRecording
                            ? (silenceStatus || `录制中 ${inlineSeconds}s`)
                            : hasCustomAudioData(currentItem.id)
                            ? '重录声音'
                            : '录我声音'}
                        </span>
                      </button>

                      {hasCustomAudioData(currentItem.id) && !isInlineRecording && (
                        <button
                          className="inline-reset-btn"
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomAudio(currentItem.id);
                          }}
                          title="恢复系统默认发音"
                          aria-label="恢复系统发音"
                        >
                          恢复系统音
                        </button>
                      )}
                    </div>
                  </div>
                  </div>

                  {/* 底部翻牌或发音提示 */}
                  <div className="card-tap-indicator">
                    {maskMode !== 'all' && !revealed ? (
                      <span className="reveal-badge">轻触揭晓答案 · 左右滑动换词</span>
                    ) : (
                      <span>{isSpeaking ? '正在朗读，跟着读一读' : '点一下听读，左右滑动换词'}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-report">该课时暂无词条</div>
            )}

            {!isCompleted && currentItem && (
              <div className="word-pager" aria-label="词语翻页">
                <button className="page-arrow" onClick={handlePrevCard} disabled={currentCardIndex === 0} aria-label="上一个词"><Icon name="left" /></button>
                <div className="page-dots">
                  {currentDayItems.map((it, idx) => (
                    <button
                      key={it.id}
                      className={`page-dot ${idx === currentCardIndex ? 'active' : ''}`}
                      aria-current={idx === currentCardIndex ? 'step' : undefined}
                      onClick={() => {
                        stopSpellingAudio(); resetWriting();                        setIsSpeaking(false);                        setCurrentCardIndex(idx);
                        setRevealed(false);
                        if (autoPlayOnFlip) handlePlayCurrent(it);
                      }}
                      aria-label={`第${idx + 1}个词`}
                    ><span /></button>
                  ))}
                </div>
                <button className="page-arrow next" onClick={handleNextCard} aria-label={currentCardIndex === currentDayItems.length - 1 ? '完成本课练习' : '下一个词'}><Icon name={currentCardIndex === currentDayItems.length - 1 ? 'check' : 'right'} /></button>
              </div>
            )}
          </section>
        )}

        {/* 单题闯关卡 */}
        {tab === 'today' && (
          <section className="today-grid">
            <div className="practice-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">学习卡 · 第 1 题</p>
                  <h2>跟着拼一拼</h2>
                </div>
                <span className="soft-tag">声调练习</span>
              </div>
              <div className="lesson-card">
                <div className={`picture-tile ${selectedImageUrl ? 'has-vocabulary-image' : ''}`}>
                  {selectedImageUrl ? (
                    <img src={selectedImageUrl} alt={selectedItem.character} className="real-card-img" draggable={false} />
                  ) : (
                    <span className="flame" role="img" aria-label={selectedItem.character}>
                      {DICTATION_EMOJI_MAP[selectedItem.character] ?? '📖'}
                    </span>
                  )}
                </div>
                <div className="lesson-main">
                  <div className="character-line">
                    <span className="hanzi">{selectedItem.character}</span>
                    <button
                      className="primary-button"
                      style={{ padding: '8px 14px', fontSize: '13px' }}
                      onClick={() => handlePlaySpelling({
                        id: selectedItem.id,
                        character: selectedItem.character,
                        pinyin: selectedItem.pinyin,
                        week: 9,
                        dayLabel: '',
                        category: '',
                        teachingSteps: selectedItem.teachingSteps,
                      })}
                    >
                      🎙 听老师拼读
                    </button>
                  </div>
                  <div className="pinyin-big">{selectedItem.pinyin}</div>
                  <div className="tone-chip">
                    {toneLabel(selectedItem.tone)} · 声调要读到位
                  </div>
                </div>
              </div>
              <div className="answer-row">
                <button
                  className="primary-button"
                  onClick={() => handlePlaySpelling({
                    id: selectedItem.id,
                    character: selectedItem.character,
                    pinyin: selectedItem.pinyin,
                    week: 9,
                    dayLabel: '',
                    category: '',
                    teachingSteps: selectedItem.teachingSteps,
                  })}
                >
                  🎙 听音跟读
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    const next =
                      learned[(learned.indexOf(selectedItem) + 1) % learned.length];
                    setSelectedItem(next);
                  }}
                >
                  换一道
                </button>
              </div>
            </div>
            <aside className="side-panel">
              <div className="side-head">
                <p className="eyebrow">今天先练这些</p>
                <span className="small-muted">已完成 2 / 8</span>
              </div>
              {learned.slice(0, 4).map((item, index) => (
                <button
                  className={
                    item.id === selectedItem.id ? 'queue-item selected' : 'queue-item'
                  }
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                  }}
                >
                  <span className="queue-number">0{index + 1}</span>
                  <span className="queue-word">
                    <b>{item.character}</b>
                    <small>{item.pinyin}</small>
                  </span>
                  <span className={index < 2 ? 'queue-state done-state' : 'queue-state'}>
                    {index < 2 ? '✓' : '待练'}
                  </span>
                </button>
              ))}
            </aside>
          </section>
        )}

        {/* 基础拼音馆 */}
        {tab === 'basics' && (
          <section className="basics-page">
            <div className="basics-intro">
              <div>
                <p className="eyebrow">基础拼音馆</p>
                <h2>标准呼读音，把字母认熟认准。</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => speakText('声母 韵母 整体认读音节')}
              >
                ▶ 听听简介
              </button>
            </div>
            <div className="table-section">
              <div className="table-title">
                <span className="table-icon blue">声</span>
                <div>
                  <h3>声母表 (23个)</h3>
                  <p>发音轻短，点击播放标准呼读音</p>
                </div>
              </div>
              <div className="letter-grid">
                {initialTable.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => handlePlayCurrent({
                      id: letter,
                      character: letter,
                      pinyin: letter,
                      week: 5,
                      dayLabel: '',
                      category: '声母',
                      teachingSteps: [letter],
                    })}
                  >
                    {letter}
                    <small>听呼读</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="table-section warm">
              <div className="table-title">
                <span className="table-icon coral">韵</span>
                <div>
                  <h3>韵母表 (24个)</h3>
                  <p>声音响亮拉长，点击试听原声</p>
                </div>
              </div>
              <div className="letter-grid">
                {finalTable.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => handlePlayCurrent({
                      id: letter,
                      character: letter,
                      pinyin: letter,
                      week: 5,
                      dayLabel: '',
                      category: '韵母',
                      teachingSteps: [letter],
                    })}
                  >
                    {letter}
                    <small>读一读</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="table-section violet">
              <div className="table-title">
                <span className="table-icon violet-icon">读</span>
                <div>
                  <h3>整体认读音节 (16个)</h3>
                  <p>不拼读，直接整读出来</p>
                </div>
              </div>
              <div className="letter-grid whole">
                {wholeSyllableTable.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => handlePlayCurrent({
                      id: letter,
                      character: letter,
                      pinyin: letter,
                      week: 5,
                      dayLabel: '',
                      category: '整体认读',
                      teachingSteps: [letter],
                    })}
                  >
                    {letter}
                    <small>整体读</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 家长记录 */}
        {tab === 'parent' && (
          <section className="parent-page">
            <div className="parent-head">
              <div>
                <p className="eyebrow">家长记录与自测指导</p>
                <h2>今天的错误，变成明天的线索。</h2>
                <p>已接入老师式带拼读引擎与错题持久化存储。</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setStarredIds({});
                }}
              >
                清空错题记录
              </button>
            </div>
            <div className="stats-row">
              <div>
                <b>129</b>
                <span>收录听写词</span>
              </div>
              <div>
                <b className="coral-text">{allStarredItems.length}</b>
                <span>当前累积错题</span>
              </div>
              <div>
                <b className="blue-text">带拼读</b>
                <span>波-à-bà 亲切带读</span>
              </div>
              <div>
                <b className="green-text">100%</b>
                <span>支持纸上听写遮挡自测</span>
              </div>
            </div>

            {/* 错题清单 */}
            {allStarredItems.length > 0 ? (
              <div className="starred-mistakes-section" style={{ maxWidth: '100%', marginTop: '20px' }}>
                <div className="mistakes-title">
                  <span>★ 孩子当前标记的错题清单（点击可发音，随手取消星标）：</span>
                </div>
                <div className="mistakes-grid">
                  {allStarredItems.map((item) => (
                    <div
                      key={item.id}
                      className="mistake-chip"
                      onClick={() => handlePlaySpelling(item)}
                      title="点击听老师拼读"
                    >
                      <span>{item.character}</span>
                      <small>{item.pinyin}</small>
                      <button
                        style={{ border: 0, background: 'none', cursor: 'pointer', color: '#e69a31', fontSize: '15px' }}
                        onClick={(e) => toggleStar(item.id, e)}
                        title="取消错题标记"
                      >
                        ★
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-report">
                <span className="report-icon">☼</span>
                <h3>目前没有累积错题</h3>
                <p>在点读卡片右上角点击星标 ★，错题就会自动收集到这里，方便随时复习！</p>
              </div>
            )}
          </section>
        )}
      </main>

      <nav className="bottom-tabs" aria-label="学习导航">
        {([['read', '学拼读', 'book'], ['today', '闯关', 'trophy'], ['basics', '拼音馆', 'letters'], ['parent', '我的', 'person']] as const).map(([id, label, icon]) => (
          <button key={id} className={tab === id ? 'bottom-tab active' : 'bottom-tab'} aria-current={tab === id ? 'page' : undefined} onClick={() => { stopSpellingAudio(); resetWriting(); setIsSpeaking(false); setTab(id); }}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <dialog ref={courseDialogRef} className="app-dialog" aria-labelledby="course-title">
        <div className="dialog-heading"><h2 id="course-title">选择课时</h2><button className="icon-button" aria-label="关闭选课" onClick={() => courseDialogRef.current?.close()}><Icon name="close" /></button></div>
        <p className="dialog-note">选择周次和当天要练习的内容</p>
        <div className="course-controls">
                <div className="week-selector">
                  {availableWeeks.map((wk) => (
                    <button
                      key={wk}
                      className={wk === selectedWeek ? 'week-pill active' : 'week-pill'}
                      aria-pressed={wk === selectedWeek}
                      onClick={() => {
                        stopSpellingAudio(); resetWriting();
                        setSelectedWeek(wk);
                        setSelectedDayIndex(0);
                      }}
                    >
                      第{wk}周
                    </button>
                  ))}
                </div>

                {/* 课时下拉 */}
                {currentWeekData && (
                  <select
                    className="day-select"
                    value={selectedDayIndex}
                    onChange={(e) => {
                      stopSpellingAudio(); resetWriting();
                      setSelectedDayIndex(parseInt(e.target.value, 10));
                    }}
                    aria-label="选择具体课时"
                  >
                    {currentWeekData.days.map((d, idx) => (
                      <option key={idx} value={idx}>
                        {d.dayLabel} ({d.items.length}词)
                      </option>
                    ))}
                  </select>
                )}

        </div>
        <button className="dialog-done" onClick={() => { stopSpellingAudio(); resetWriting(); setIsSpeaking(false); setTab('read'); courseDialogRef.current?.close(); }}>开始练习</button>
      </dialog>
      <dialog ref={settingsDialogRef} className="app-dialog" aria-labelledby="settings-title">
        <div className="dialog-heading"><h2 id="settings-title">练习设置</h2><button className="icon-button" aria-label="关闭设置" onClick={() => settingsDialogRef.current?.close()}><Icon name="close" /></button></div>
        <section className="setting-section"><h3>朗读方式</h3>
              <div className="playmode-toggle" title="选择默认发音方式">
                <button
                  className={audioMode === 'spelling' ? 'playmode-pill active' : 'playmode-pill'}
                  aria-pressed={audioMode === 'spelling'}
                  onClick={() => setAudioMode('spelling')}
                >
                  老师带拼读
                </button>
                <button
                  className={audioMode === 'word' ? 'playmode-pill active' : 'playmode-pill'}
                  aria-pressed={audioMode === 'word'}
                  onClick={() => setAudioMode('word')}
                >
                  仅读词
                </button>
              </div>


        </section>
        <section className="setting-section"><h3>遮挡自测</h3>
              <div className="mask-mode-toggle">
                <button
                  className={maskMode === 'all' ? 'mask-pill active' : 'mask-pill'}
                  aria-pressed={maskMode === 'all'}
                  onClick={() => {
                    setMaskMode('all');
                    setRevealed(false);
                  }}
                >
                  全显
                </button>
                <button
                  className={maskMode === 'hidePinyin' ? 'mask-pill active' : 'mask-pill'}
                  aria-pressed={maskMode === 'hidePinyin'}
                  onClick={() => {
                    setMaskMode('hidePinyin');
                    setRevealed(false);
                  }}
                  title="遮挡拼音测拼写，点击翻牌核对"
                >
                  遮拼音
                </button>
                <button
                  className={maskMode === 'hideHanzi' ? 'mask-pill active' : 'mask-pill'}
                  aria-pressed={maskMode === 'hideHanzi'}
                  onClick={() => {
                    setMaskMode('hideHanzi');
                    setRevealed(false);
                  }}
                  title="遮挡汉字测认读"
                >
                  遮汉字
                </button>
              </div>

          <p className="dialog-note">点一下卡片或朗读按钮，即可揭晓答案。</p>
        </section>
        <label className="setting-switch"><span>换词时自动朗读</span><input type="checkbox" role="switch" checked={autoPlayOnFlip} onChange={(e) => setAutoPlayOnFlip(e.target.checked)} /></label>
        {currentItem && <button className="record-entry" onClick={() => { settingsDialogRef.current?.close(); openRecordModal(currentItem); }}><Icon name="mic" /><span>{hasCustomAudioData(currentItem.id) ? '管理' : '录制'}「{currentItem.character}」的家长原声</span><Icon name="right" /></button>}
        <button className="dialog-done" onClick={() => settingsDialogRef.current?.close()}>完成</button>
      </dialog>

      {/* 家长自录真人原声工作台 (支持流水线连续录音) */}
      <ParentRecordingModal
        item={recordingItem || currentItem || null}
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onAudioUpdated={() => setCustomAudioVersion((v) => v + 1)}
        itemsList={currentDayItems}
        currentIndex={currentCardIndex}
        onNavigate={(newIdx) => {
          setCurrentCardIndex(newIdx);
          setRecordingItem(currentDayItems[newIdx]);
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

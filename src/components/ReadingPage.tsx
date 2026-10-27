import { useEffect, useMemo, useRef, useState } from 'react';
import readingDays from '../content/readingDays.json';
import { DictationItem, DICTATION_EMOJI_MAP, dictationItems } from '../content/dictation';
import { getVocabularyImage } from '../content/vocabularyImages';
import { hasCustomAudioData } from '../features/customAudio';
import { playTeacherSpelling, stopSpellingAudio } from '../features/spellingEngine';
import { useInlineRecording } from '../features/useInlineRecording';
import { PinyinWriting } from './PinyinWriting';

type ReadingDay = typeof readingDays[number];
type Props = { day: number; onDayChange: (day: number) => void; onOpenDays: () => void; onChallenge: () => void };
type Progress = { count: number; best: number | null };
const progressKey = 'pinyin_reading_progress';
const makeItem = (entry: ReadingDay['items'][number], day: ReadingDay): DictationItem => ({
  ...entry, week: 5, dayLabel: `第${day.day}天 · ${day.title}`, category: '拼读', teachingSteps: entry.pinyin.split(/\s+/),
});

export function ReadingPage({ day, onDayChange, onOpenDays, onChallenge }: Props) {
  const data = readingDays[day - 1] ?? readingDays[0];
  const items = useMemo(() => data.items.map((entry) => makeItem(entry, data)), [data]);
  const [index, setIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [playbackMessage, setPlaybackMessage] = useState('');
  const [voiceVersion, setVoiceVersion] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>(() => {
    try { return JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch { return {}; }
  });
  const wordsDialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const item = items[index] ?? items[0];
  const image = getVocabularyImage(item.character === '桔子' ? '橘子' : item.character);
  const voiceItem = useMemo(() => {
    if (hasCustomAudioData(item.id)) return item;
    const shared = dictationItems.find((candidate) => candidate.character === item.character && candidate.pinyin.normalize('NFC') === item.pinyin.normalize('NFC') && hasCustomAudioData(candidate.id));
    return shared ? { ...item, id: shared.id } : item;
  }, [item, voiceVersion]);
  const hasVoice = hasCustomAudioData(voiceItem.id);
  const recorder = useInlineRecording(voiceItem.id, () => setVoiceVersion((n) => n + 1));
  const currentProgress = progress[String(day)] ?? { count: 0, best: null };
  const formatTime = (time: number) => `${Math.floor(time / 60)}分${String(time % 60).padStart(2, '0')}秒`;

  useEffect(() => {
    const saved = Number(localStorage.getItem(`pinyin_reading_index_${day}`));
    setIndex(Number.isInteger(saved) && saved >= 0 && saved < items.length ? saved : 0);
    setReplay(0); setPlaybackMessage(''); setCompleted(false); setStartedAt(null); setSeconds(0); stopSpellingAudio();
  }, [day, items.length]);
  useEffect(() => () => stopSpellingAudio(), []);
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  useEffect(() => { try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch {} }, [progress]);

  function navigate(next: number) {
    stopSpellingAudio(); setSpeaking(false); setPlaybackMessage(''); setReplay(0); setIndex(next);
    try { localStorage.setItem(`pinyin_reading_index_${day}`, String(next)); } catch {}
  }
  function play() {
    if (!hasCustomAudioData(voiceItem.id)) { setPlaybackMessage('先录音，再点读。'); return; }
    setPlaybackMessage('');
    playTeacherSpelling(voiceItem, {
      onStart: () => setSpeaking(true),
      onPlaybackStart: () => setReplay((n) => n + 1),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }
  function finish() {
    stopSpellingAudio(); recorder.stop(); setSpeaking(false);
    const time = startedAt === null ? null : Math.floor((Date.now() - startedAt) / 1000);
    setLastTime(time); setStartedAt(null); setCompleted(true);
    setProgress((old) => {
      const previous = old[String(day)] ?? { count: 0, best: null };
      return { ...old, [String(day)]: { count: previous.count + 1, best: time === null ? previous.best : previous.best === null ? time : Math.min(previous.best, time) } };
    });
  }
  return <section className="reading-page" aria-label="每日拼读">
    {completed ? <div className="reading-complete">
      <p className="reading-overline">第{day}天 · {data.title}</p>
      <h2>这一组练完了</h2>
      <p>已读 {currentProgress.count} 遍{lastTime !== null ? ` · 本次用时 ${formatTime(lastTime)}` : ''}</p>
      {currentProgress.best !== null && <p>最快用时 {formatTime(currentProgress.best)}</p>}
      <div className="reading-complete-actions">
        <button className="reading-secondary" onClick={() => { setCompleted(false); navigate(0); setSeconds(0); }}>再读一遍</button>
        {day < readingDays.length && <button className="reading-primary" onClick={() => onDayChange(day + 1)}>下一天</button>}
        <button className="reading-secondary" onClick={onOpenDays}>选择其他天</button>
        <button className="reading-secondary" onClick={onChallenge}>去闯关</button>
      </div>
    </div> : <>
      <div className="reading-card" onTouchStart={(event) => {
        if (event.target instanceof Element && event.target.closest('button')) return;
        touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }} onTouchEnd={(event) => {
        if (!touchStart.current) return;
        const dx = event.changedTouches[0].clientX - touchStart.current.x;
        const dy = event.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx > 0 && index > 0) navigate(index - 1);
        else if (dx < 0 && index < items.length - 1) navigate(index + 1);
      }} onTouchCancel={() => { touchStart.current = null; }}>
        <div className="reading-card-header"><span>{index + 1} / {items.length}</span><button className="reading-list-btn" onClick={() => wordsDialog.current?.showModal()}>本组词语</button></div>
        <div className="reading-content">
          <div className="reading-picture">
            {image ? <img src={image} alt={item.character} /> : <span role="img" aria-label={item.character}>{DICTATION_EMOJI_MAP[item.character] ?? '📖'}</span>}
            <strong>{item.character}</strong>
          </div>
          <div className="reading-writing">
            <PinyinWriting key={item.id} pinyin={item.pinyin} replay={replay} />

          </div>
        </div>
        <button className="reading-side prev" disabled={index === 0} aria-label="上一个词" onClick={() => navigate(index - 1)}>‹</button>
        <button className="reading-side next" aria-label={index === items.length - 1 ? '完成一遍' : '下一个词'} onClick={() => index === items.length - 1 ? finish() : navigate(index + 1)}>{index === items.length - 1 ? '✓' : '›'}</button>
      </div>
      <div className="reading-footer">
        <div className="reading-footer-actions">
          <button className={`reading-record ${recorder.status === 'recording' ? 'recording-now' : ''}`} disabled={recorder.status === 'requesting' || recorder.status === 'saving'} onClick={() => { setSpeaking(false); setPlaybackMessage(''); void recorder.toggle(); }}>
            {recorder.status === 'recording' ? '结束并保存' : recorder.status === 'requesting' ? '连接麦克风…' : recorder.status === 'saving' ? '正在保存…' : hasVoice ? '重录' : '录音'}
          </button>
          <button className="reading-primary reading-play" disabled={recorder.status !== 'idle'} onClick={play}>{speaking ? '正在播放…' : '听拼读'}</button>
        </div>
        <div className="reading-footer-meta">
          <button className="reading-text-btn" onClick={() => setReplay((n) => n + 1)}>演示书写</button>
          <button className="reading-text-btn" onClick={() => { if (startedAt === null) { setSeconds(0); setStartedAt(Date.now()); } else { setStartedAt(null); setSeconds(0); } }}>{startedAt === null ? '开始计时' : `计时中 ${formatTime(seconds)} · 取消`}</button>
          <span>已读 {currentProgress.count} 遍{currentProgress.best !== null ? ` · 最快 ${formatTime(currentProgress.best)}` : ''}</span>
        </div>
        {(recorder.message || playbackMessage) && <p className="inline-record-message" role="status">{recorder.message || playbackMessage}</p>}
      </div>
    </>}
    <dialog ref={wordsDialog} className="app-dialog reading-words-dialog" aria-labelledby="reading-words-title">
      <div className="dialog-heading"><h2 id="reading-words-title">第{day}天 · 本组词语</h2><button className="icon-button" aria-label="关闭词语列表" onClick={() => wordsDialog.current?.close()}>✕</button></div>
      <div className="reading-words">{items.map((entry, i) => <button key={entry.id} aria-current={i === index ? 'step' : undefined} onClick={() => { navigate(i); wordsDialog.current?.close(); }}><span>{entry.pinyin}</span><b>{entry.character}</b></button>)}</div>
    </dialog>

  </section>;
}

export { readingDays };

import { useRef, useState } from 'react';
import { initialTable, finalTable, wholeSyllableTable } from '../content/schema';
import { DictationItem } from '../content/dictation';
import { hasCustomAudioData } from '../features/customAudio';
import { playTeacherSpelling, stopSpellingAudio } from '../features/spellingEngine';
import { useInlineRecording } from '../features/useInlineRecording';
import { PinyinWriting } from './PinyinWriting';
import { getVocabularyImage } from '../content/vocabularyImages';
import { letterExamples } from '../content/letterExamples';

type Group = 'initial' | 'final' | 'whole';
const groups = { initial: { label: '声母', letters: initialTable }, final: { label: '韵母', letters: finalTable }, whole: { label: '整体认读', letters: wholeSyllableTable } };
export function LettersPage() {
  const [group, setGroup] = useState<Group>('initial');
  const [letter, setLetter] = useState('');
  const [replay, setReplay] = useState(0);
  const [, setVoiceVersion] = useState(0);
  const detail = useRef<HTMLDialogElement>(null);
  const item: DictationItem = { id: `letter_${letter.replace(/ü/g, 'v')}`, character: letter, pinyin: letter, week: 5, dayLabel: '字母表', category: groups[group].label, teachingSteps: [letter] };
  const recorder = useInlineRecording(item.id, () => setVoiceVersion((n) => n + 1));
  function choose(value: string) { stopSpellingAudio(); setLetter(value); setReplay(0); detail.current?.showModal(); }
  function play() {
    if (!hasCustomAudioData(item.id)) { void recorder.toggle(); return; }
    playTeacherSpelling(item, { onPlaybackStart: () => setReplay((n) => n + 1) });
  }
  return <section className="letters-page">
    <div className="letters-heading"><h1>拼音字母表</h1><p>选一个字母，听一听、看一看</p></div>
    <div className="letters-tabs" role="group" aria-label="拼音分类">
      {(Object.keys(groups) as Group[]).map((key) => <button key={key} aria-pressed={group === key} className={group === key ? 'active' : ''} onClick={() => setGroup(key)}>{groups[key].label}</button>)}
    </div>
    <div className="letters-grid">{groups[group].letters.map((value) => {
      const example = letterExamples[group][value];
      const image = getVocabularyImage(example);
      return <button key={value} onClick={() => choose(value)} aria-label={`${value}，${example}`}>
        {image && <img src={image} alt="" loading="lazy" />}
        <span>{value}</span><small>{example}</small>
      </button>;
    })}</div>
    <dialog ref={detail} onClose={() => { stopSpellingAudio(); recorder.stop(); }} className="app-dialog letter-dialog" aria-labelledby="letter-title">
      <div className="letter-detail-header">
        <button className="letter-back" onClick={() => detail.current?.close()} aria-label="返回字母表">‹ <span>字母表</span></button>
        <h2 id="letter-title">{groups[group].label} · {letter}</h2>
      </div>
      {letter && <div className="letter-detail-content">
        <div className="letter-detail-picture">
          {getVocabularyImage(letterExamples[group][letter]) && <img src={getVocabularyImage(letterExamples[group][letter])} alt={letterExamples[group][letter]} />}
          <strong>{letterExamples[group][letter]}</strong>
        </div>
        <div className="letter-detail-writing">
          <PinyinWriting key={letter} pinyin={letter} replay={replay} />
          <p>听一听，看看怎么写</p>
        </div>
      </div>}
      <div className="letter-detail-footer">
        <div className="letter-actions"><button className="reading-secondary" onClick={() => setReplay((n) => n + 1)}>演示书写</button><button className={`reading-primary ${recorder.status === 'recording' ? 'recording-now' : ''}`} disabled={recorder.status === 'requesting' || recorder.status === 'saving'} onClick={recorder.status === 'recording' ? recorder.toggle : play}>{recorder.status === 'recording' ? '结束并保存' : recorder.status === 'requesting' ? '连接麦克风…' : recorder.status === 'saving' ? '正在保存…' : hasCustomAudioData(item.id) ? '听发音' : '点一下录音'}</button></div>
        {recorder.message && <p className="inline-record-message" role="status">{recorder.message}</p>}
        {hasCustomAudioData(item.id) && recorder.status === 'idle' && <button className="reading-text-btn letter-rerecord" onClick={recorder.toggle}>重录</button>}
      </div>
    </dialog>
  </section>;
}

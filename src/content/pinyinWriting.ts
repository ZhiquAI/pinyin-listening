/** 自绘拼音笔画中心线；四条格线 y=20/60/100/140。
 * 占格与笔顺参考：https://qp.shwfl.edu.cn/2021/1101/c1975a7899/page.htm
 * 使用小学拼音的单层 a、g，不采用印刷体轮廓擦除。
 */
interface LetterShape { width: number; strokes: readonly string[] }
const leftOval = 'M39 65 C31 56 9 58 8 79 C7 101 29 104 39 94';
const letters: Record<string, LetterShape> = {
  a: { width: 52, strokes: [leftOval, 'M40 61 L40 95 Q40 100 47 100'] },
  b: { width: 50, strokes: ['M9 28 L9 100', 'M9 68 C43 40 58 105 23 100 Q14 100 9 94'] },
  c: { width: 47, strokes: ['M39 66 C22 49 6 67 7 82 C7 99 25 107 40 94'] },
  d: { width: 50, strokes: [leftOval, 'M40 28 L40 100'] },
  e: { width: 49, strokes: ['M8 80 L42 80 C43 54 8 53 7 79 C6 101 29 107 42 94'] },
  f: { width: 35, strokes: ['M30 31 Q13 20 13 43 L13 100', 'M3 60 L31 60'] },
  g: { width: 50, strokes: [leftOval, 'M40 61 L40 115 C40 138 15 139 9 125'] },
  h: { width: 49, strokes: ['M9 28 L9 100', 'M9 73 C14 53 40 53 40 78 L40 100'] },
  i: { width: 22, strokes: ['M11 61 L11 100', 'M11 43 L11 44'] },
  j: { width: 26, strokes: ['M17 61 L17 118 Q17 135 5 134', 'M17 43 L17 44'] },
  k: { width: 46, strokes: ['M9 28 L9 100', 'M38 61 L12 80 L40 100'] },
  l: { width: 22, strokes: ['M11 28 L11 100'] },
  m: { width: 68, strokes: ['M9 61 L9 100', 'M9 73 C12 55 33 55 33 76 L33 100', 'M33 73 C36 55 59 55 59 76 L59 100'] },
  n: { width: 49, strokes: ['M9 61 L9 100', 'M9 73 C14 53 40 53 40 78 L40 100'] },
  o: { width: 50, strokes: ['M25 60 C1 60 1 100 25 100 C49 100 49 60 25 60'] },
  p: { width: 50, strokes: ['M9 61 L9 136', 'M9 68 C43 40 58 105 23 100 Q14 100 9 94'] },
  q: { width: 50, strokes: [leftOval, 'M40 61 L40 136'] },
  r: { width: 35, strokes: ['M9 61 L9 100', 'M9 75 Q15 55 30 63'] },
  s: { width: 45, strokes: ['M37 65 C23 51 2 65 12 77 C17 83 37 80 38 91 C39 104 15 104 7 95'] },
  t: { width: 36, strokes: ['M16 36 L16 90 Q16 104 30 98', 'M4 60 L31 60'] },
  u: { width: 50, strokes: ['M9 61 L9 86 C9 107 35 103 40 87', 'M40 61 L40 100'] },
  v: { width: 46, strokes: ['M7 61 L23 100 L40 61'] },
  w: { width: 68, strokes: ['M7 61 L20 100 L34 61 L48 100', 'M48 100 L61 61'] },
  x: { width: 46, strokes: ['M7 61 L40 100', 'M40 61 L7 100'] },
  y: { width: 48, strokes: ['M7 61 L25 99', 'M42 61 L19 124 Q14 138 6 133'] },
  z: { width: 46, strokes: ['M7 61 L40 61 L7 100 L40 100'] },
};
const toneMarks: Record<string, string> = {
  '\u0304': 'M-10 0 L10 0',
  '\u0301': 'M-8 4 L8 -5',
  '\u030c': 'M-10 -4 L0 4 L10 -4',
  '\u0300': 'M-8 -5 L8 4',
};
export interface WritingGlyph {
  character: string;
  width: number;
  strokes: readonly string[];
  tone?: { path: string; x: number; y: number };
}
export function getWritingGlyph(character: string): WritingGlyph | undefined {
  const [base, ...marks] = character.toLowerCase().normalize('NFD');
  const shape = letters[base];
  if (!shape) return undefined;
  const tone = marks.find((mark) => toneMarks[mark]);
  // i 上标调时去掉原点；ü 保留两点，调号写在两点上方。
  let strokes = base === 'i' && tone ? shape.strokes.slice(0, 1) : [...shape.strokes];
  if (marks.includes('\u0308')) strokes = [...strokes, 'M15 43 L15 44', 'M34 43 L34 44'];
  return { character, width: shape.width, strokes, tone: tone ? { path: toneMarks[tone], x: shape.width / 2, y: marks.includes('\u0308') ? 27 : 42 } : undefined };
}

export interface WritingStroke { path: string; x: number; y: number; character: string; }
export interface WritingLayout { width: number; height: number; rows: number; strokes: WritingStroke[]; }
export function layoutPinyinWriting(pinyin: string): WritingLayout {
  const syllables = pinyin.normalize('NFC').trim().split(/\s+/).filter(Boolean).map((s) => Array.from(s).map(getWritingGlyph).filter((g): g is WritingGlyph => Boolean(g)));
  const rows: WritingGlyph[][][] = [[]];
  let rowWidth = 0;
  for (const syllable of syllables) {
    const width = syllable.reduce((sum, glyph) => sum + glyph.width + 4, 0);
    if (rowWidth && rowWidth + 24 + width > 310) { rows.push([]); rowWidth = 0; }
    rows[rows.length - 1].push(syllable);
    rowWidth += (rowWidth ? 24 : 0) + width;
  }
  const widths = rows.map((row) => row.reduce((sum, syllable) => sum + syllable.reduce((n, glyph) => n + glyph.width + 4, 0), 0) + Math.max(0, row.length - 1) * 24);
  const width = Math.max(280, ...widths.map((w) => w + 32));
  const strokes: WritingStroke[] = [];
  rows.forEach((row, rowIndex) => {
    let x = (width - widths[rowIndex]) / 2;
    row.forEach((syllable) => {
      const tones: WritingStroke[] = [];
      for (const glyph of syllable) {
        for (const path of glyph.strokes) strokes.push({ path, x, y: rowIndex * 168, character: glyph.character });
        if (glyph.tone) tones.push({ path: glyph.tone.path, x: x + glyph.tone.x, y: rowIndex * 168 + glyph.tone.y, character: glyph.character });
        x += glyph.width + 4;
      }
      // 音节字母写完后再补声调。
      strokes.push(...tones);
      x += 24;
    });
  });
  return { width, height: rows.length * 168 - 8, rows: rows.length, strokes };
}

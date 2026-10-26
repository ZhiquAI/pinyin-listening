import imageManifest from '../../docs/imagegen/manifest.json';

// 以已完成记录的汉字词义匹配，避免同音词（如“句子”和“橘子”）串图。
export function getVocabularyImage(character: string): string | undefined {
  const image = imageManifest.find((entry) => entry.word === character && entry.status === 'generated');
  if (!image) return undefined;
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}images/vocabulary/${image.file}`;
}

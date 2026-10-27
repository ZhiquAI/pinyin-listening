import { describe, expect, it } from 'vitest';
import { initialTable, finalTable, wholeSyllableTable } from '../src/content/schema';
import { letterExamples } from '../src/content/letterExamples';
import { getVocabularyImage } from '../src/content/vocabularyImages';

describe('字母表插画', () => {
  it('每个字母和音节都有对应的现有词语插画', () => {
    for (const [group, entries] of [
      ['initial', initialTable], ['final', finalTable], ['whole', wholeSyllableTable],
    ] as const) {
      for (const entry of entries) {
        const word = letterExamples[group][entry];
        expect(word, `${group}: ${entry}`).toBeTruthy();
        expect(getVocabularyImage(word), `${group}: ${entry} - ${word}`).toBeTruthy();
      }
    }
  });
});

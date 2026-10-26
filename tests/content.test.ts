import { describe, expect, it } from 'vitest';
import { finalTable, getLearnedItems, initialTable, items, LearningItemSchema, wholeSyllableTable } from '../src/content/schema';
import { tonePlacement } from '../src/content/pinyin';
describe('拼音基础内容', () => {
 it('包含规范的声母、韵母和整体认读音节表', () => { expect(initialTable).toHaveLength(23); expect(finalTable).toHaveLength(24); expect(wholeSyllableTable).toHaveLength(16); expect(new Set(initialTable).size).toBe(23); });
 it('所有正式题目通过内容契约且只有已校对题目进入练习', () => { expect(items.every((item)=>LearningItemSchema.safeParse(item).success)).toBe(true); expect(getLearnedItems().every((item)=>item.status==='reviewed'&&item.learned)).toBe(true); });
 it('使用常见规则确定声调位置', () => { expect(tonePlacement('hao')).toBe('a'); expect(tonePlacement('shui')).toBe('i'); expect(tonePlacement('liu')).toBe('u'); expect(tonePlacement('ou')).toBe('o'); });
});

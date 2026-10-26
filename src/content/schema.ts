import { z } from 'zod';
export const PinyinKind = z.enum(['initial', 'final', 'wholeSyllable']);
export const ItemStatus = z.enum(['draft', 'reviewed']);
export const Tone = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const LearningItemSchema = z.object({id:z.string().min(1),character:z.string().min(1),pinyin:z.string().min(1),tone:Tone,kind:PinyinKind,source:z.string().min(1),imageLabel:z.string().min(1),learned:z.boolean(),status:ItemStatus,initials:z.array(z.string()),finals:z.array(z.string()),teachingSteps:z.array(z.string()).min(1)});
export type LearningItem = z.infer<typeof LearningItemSchema>;
export const initialTable = ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'] as const;
export const finalTable = ['a','o','e','i','u','ü','ai','ei','ui','ao','ou','iu','ie','üe','er','an','en','in','un','ün','ang','eng','ing','ong'] as const;
export const wholeSyllableTable = ['zhi','chi','shi','ri','zi','ci','si','yi','wu','yu','ye','yue','yuan','yin','yun','ying'] as const;
export const items: LearningItem[] = [
{id:'fire',character:'火',pinyin:'huǒ',tone:3,kind:'wholeSyllable',source:'第九周语文美好时光·听写预告',imageLabel:'一团温暖的火焰',learned:true,status:'reviewed',initials:['h'],finals:['uo'],teachingSteps:['h','uo','huo','三声','huǒ']},
{id:'pear',character:'鸭梨',pinyin:'yā lí',tone:1,kind:'wholeSyllable',source:'第九周语文美好时光·听写预告',imageLabel:'一只鸭子和一个梨',learned:true,status:'reviewed',initials:['y','l'],finals:['a','i'],teachingSteps:['yā','lí']},
{id:'spider',character:'蜘蛛',pinyin:'zhī zhū',tone:1,kind:'wholeSyllable',source:'第九周语文美好时光·听写预告',imageLabel:'一只小蜘蛛',learned:true,status:'reviewed',initials:['zh','zh'],finals:['i','u'],teachingSteps:['zhī','zhū']},
{id:'cabbage',character:'白菜',pinyin:'bái cài',tone:2,kind:'wholeSyllable',source:'第九周语文美好时光·听写预告',imageLabel:'一棵白菜',learned:true,status:'reviewed',initials:['b','c'],finals:['ai','ai'],teachingSteps:['bái','cài']},
{id:'water',character:'水果',pinyin:'shuǐ guǒ',tone:3,kind:'wholeSyllable',source:'第九周语文美好时光·听写预告',imageLabel:'一篮水果',learned:true,status:'reviewed',initials:['sh','g'],finals:['ui','uo'],teachingSteps:['shuǐ','guǒ']},
{id:'wash',character:'洗手',pinyin:'xǐ shǒu',tone:3,kind:'wholeSyllable',source:'第九周语文美好时光·听写预告',imageLabel:'正在洗手的孩子',learned:true,status:'reviewed',initials:['x','sh'],finals:['i','ou'],teachingSteps:['xǐ','shǒu']},
];
export function getLearnedItems(): LearningItem[] { return items.filter((item) => item.learned && item.status === 'reviewed'); }

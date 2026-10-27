/** 字母表中的示例词均复用词库插画。 */
export const letterExamples: Record<'initial' | 'final' | 'whole', Record<string, string>> = {
  initial: {
    b: '爸爸', p: '爬坡', m: '妈妈', f: '斧子', d: '大米', t: '土地', n: '奶奶', l: '骆驼',
    g: '哥哥', k: '可乐', h: '河马', j: '积木', q: '汽车', x: '西瓜', zh: '蜘蛛', ch: '尺子',
    sh: '狮子', r: '日出', z: '字母', c: '瓷器', s: '司机', y: '鸭子', w: '屋子',
  },
  final: {
    a: '阿姨', o: '菠萝', e: '鳄鱼', i: '衣服', u: '乌鸦', ü: '鲤鱼', ai: '白菜', ei: '飞机',
    ui: '乌龟', ao: '毛笔', ou: '小猴', iu: '小牛', ie: '布鞋', üe: '雪花', er: '耳朵',
    an: '蓝天', en: '森林', in: '森林', un: '轮船', ün: '军人', ang: '房屋', eng: '蜜蜂', ing: '英雄', ong: '灯笼',
  },
  whole: {
    zhi: '蜘蛛', chi: '尺子', shi: '狮子', ri: '日出', zi: '字母', ci: '瓷器', si: '司机', yi: '衣服',
    wu: '屋子', yu: '雨伞', ye: '叶子', yue: '月牙', yuan: '圆圈', yin: '蚯蚓', yun: '白云', ying: '英雄',
  },
};

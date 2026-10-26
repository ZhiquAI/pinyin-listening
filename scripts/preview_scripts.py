import json

with open('scripts/items.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

INITIAL_MAP = {
    'b': '玻', 'p': '坡', 'm': '摸', 'f': '佛',
    'd': '得', 't': '特', 'n': '讷', 'l': '勒',
    'g': '哥', 'k': '科', 'h': '喝',
    'j': '基', 'q': '欺', 'x': '希',
    'zh': '知', 'ch': '蚩', 'sh': '诗', 'r': '日',
    'z': '资', 'c': '疵', 's': '思',
    'y': '衣', 'w': '乌',
}

WHOLE_SYLLABLES = {
    'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
    'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'
}

def clean_pinyin_tone(py):
    # 去除声调找基础字母
    t = py.lower()
    repl = {'ā':'a','á':'a','ǎ':'a','à':'a',
            'ō':'o','ó':'o','ǒ':'o','ò':'o',
            'ē':'e','é':'e','ě':'e','è':'e',
            'ī':'i','í':'i','ǐ':'i','ì':'i',
            'ū':'u','ú':'u','ǔ':'u','ù':'u',
            'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü','ü':'ü','v':'ü'}
    for k, v in repl.items():
        t = t.replace(k, v)
    return t

def decompose(syl):
    base = clean_pinyin_tone(syl)
    if base in WHOLE_SYLLABLES:
        return {'is_whole': True, 'syl': syl}
    
    # 找声母
    init = ''
    for test_init in ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']:
        if syl.startswith(test_init):
            init = test_init
            break
            
    rest = syl[len(init):]
    base_rest = clean_pinyin_tone(rest)
    
    # 检查三拼介母 (i, u, ü)
    if len(base_rest) > 1 and base_rest[0] in ['i', 'u', 'ü', 'v']:
        medial = rest[0]
        final = rest[1:]
        return {'is_three': True, 'init': init, 'medial': medial, 'final': final, 'syl': syl}
    else:
        return {'is_two': True, 'init': init, 'final': rest, 'syl': syl}

def make_speech_script(item):
    cat = item.get('category', '')
    char = item['character']
    py = item['pinyin']
    hint = item.get('speechHint', '')
    
    # 1. 单韵母
    if cat == '单韵母':
        hanzi_char = hint.split()[-1] if hint else ''
        if hanzi_char:
            return f"{py}……{hanzi_char}！"
        return f"{py}！"
        
    syls = py.split()
    chars = list(char) if len(char) == len(syls) else [char]
    
    parts = []
    for i, syl in enumerate(syls):
        curr_c = chars[i] if i < len(chars) else ''
        d = decompose(syl)
        if d.get('is_whole'):
            parts.append(f"整体认读音节：{syl}")
        elif d.get('is_three'):
            init_voice = INITIAL_MAP.get(d['init'], d['init'])
            med_char = '一' if d['medial'] in ['i','ī','í','ǐ','ì'] else ('乌' if d['medial'] in ['u','ū','ú','ǔ','ù'] else '迂')
            parts.append(f"{init_voice}……{med_char}……{d['final']}……{syl}")
        elif d.get('is_two'):
            init_voice = INITIAL_MAP.get(d['init'], d['init'])
            if init_voice:
                parts.append(f"{init_voice}……{d['final']}……{syl}")
            else:
                parts.append(f"{syl}")
        else:
            parts.append(f"{syl}")
            
    steps_text = "；".join(parts)
    return f"{steps_text}。{char}！"

for it in items[40:65]:
    print(f"[{it['id']}] {it['character']} ({it['pinyin']}) -> {make_speech_script(it)}")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_py_words.py —— 生成中文输入法词组词典 rawfile/py_words.txt

问题：kb 页 PY_TABLE 只有 ~100 条旅游短语，常用词（手表/电话/今天）全打不出；
     单页 JS 有 55KB 上限，词库只能放 rawfile（不占页面体积预算）。

来源：jieba dict.txt（词频，经 ghproxy/jsdelivr 拉 raw.githubusercontent）+ pypinyin（多音字正确）。
筛选：2~4 字纯中文、所有字都在 kb 页 3500 常用字集内（保证可渲染+高频）、
     每个字的拼音都在 PY_SYL 音节表内（设备端直接复用音节表索引思路，但为了
     匹配简单，直接存「整词全拼连写」字符串）。
格式：每条 `词,全拼;`（词频降序）。设备端 indexOf(q)===0 前缀匹配即可支持边打边出词。

用法：python tools/gen_py_words.py
原料：tools/dict_src/jieba_dict.txt
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB_JS = os.path.join(ROOT, 'entry', 'src', 'main', 'js', 'MainAbility', 'pages', 'kb', 'index.js')
DICT_SRC = os.path.join(ROOT, 'tools', 'dict_src', 'jieba_dict.txt')
OUT = os.path.join(ROOT, 'entry', 'src', 'main', 'resources', 'rawfile', 'py_words.txt')

CAP = {2: 6000, 3: 1200, 4: 400}   # 各字数词的上限（词频降序截取；rawfile 不占 JS 预算）

# 保底词表：jieba 是新闻语料，日用品/穿戴类词天然低频收不进截断线，输入法场景却高频 → 手工补
EXTRA = ['手表', '充电器', '充电宝', '牙刷', '牙膏', '毛巾', '雨伞', '羽绒服', '围巾', '手套',
         '运动鞋', '拖鞋', '背包', '钱包', '钥匙', '充电线', '耳机', '音响', '遥控器', '插座',
         '剪刀', '镜子', '梳子', '闹钟', '日历', '台灯', '衣柜', '抽屉', '垃圾桶', '餐具',
         '保温杯', '水壶', '碗筷', '炒菜', '微波炉', '冰箱', '洗衣机', '空调', '路由器', '网线']

# pypinyin 输出与 PY_SYL 音节表的差异归一
FIX = {'lue': 'lve', 'nue': 'nve', 'jue': 'jue', 'lo': None, 'yai': None}


def load_syl_and_chars():
    """从 kb/index.js 拿 PY_SYL（音节表）和 PY_DATA 里的 3500 常用字集"""
    src = io.open(KB_JS, encoding='utf-8').read()
    m = re.search(r"var PY_SYL = '([^']+)'", src)
    assert m, 'PY_SYL not found'
    syls = [s for s in m.group(1).split(',') if s]
    m2 = re.search(r"var PY_DATA = '([^']+)'", src)
    assert m2, 'PY_DATA not found'
    d = m2.group(1)
    chars = set()
    for i in range(0, len(d) - 2, 3):
        c = d[i]
        if c:
            chars.add(c)
    return set(syls), chars


def main():
    from pypinyin import lazy_pinyin

    syl_set, char_set = load_syl_and_chars()
    print('PY_SYL %d 个音节；常用字 %d 个' % (len(syl_set), len(char_set)))

    best = {}   # word -> freq（jieba 有重复词行时取最大频次）
    with io.open(DICT_SRC, encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split(' ')
            if len(parts) < 2:
                continue
            w = parts[0]
            try:
                fr = int(parts[1])
            except ValueError:
                continue
            if not (2 <= len(w) <= 4):
                continue
            if w in best:
                if fr > best[w]:
                    best[w] = fr
                continue
            best[w] = fr
    print('jieba 原始 2~4 字词：', len(best))

    out = []
    dropped_syl = 0
    dropped_rare = 0
    for w, fr in best.items():
        ok = True
        for c in w:
            if c not in char_set:
                ok = False
                break
        if not ok:
            continue
        pys = lazy_pinyin(w, errors='ignore')
        if len(pys) != len(w):
            dropped_rare += 1
            continue
        py = ''
        for s in pys:
            s = re.sub(r'[^a-z]', '', s.lower())
            s = FIX.get(s, s)
            if s == 'lue':
                s = 'lve'
            if s == 'nue':
                s = 'nve'
            if not s or s not in syl_set:
                ok = False
                break
            py += s
        if not ok:
            dropped_syl += 1
            continue
        out.append((w, fr, py))

    # 词频降序，同频按词长再按词序稳定排
    out.sort(key=lambda t: (-t[1], len(t[0]), t[0]))

    # 各字数分别截上限，再按频次全局合并回一个文件
    picked = []
    cnt = {2: 0, 3: 0, 4: 0}
    for w, fr, py in out:
        if cnt[len(w)] >= CAP[len(w)]:
            continue
        cnt[len(w)] += 1
        picked.append((w, py))
    # 保底词表追加（去重，仍按「词,拼音」格式）
    have = set(w for w, _ in picked)
    pymap = {w: py for w, _, py in out}
    extra_added = 0
    for w in EXTRA:
        if w in have:
            continue
        pys = lazy_pinyin(w, errors='ignore')
        if len(pys) != len(w):
            continue
        py = ''.join(re.sub(r'[^a-z]', '', s.lower()) for s in pys)
        py = py.replace('lue', 'lve').replace('nue', 'nve')
        ok = True
        # 分段替换后可能引入跨音节粘连，逐音节校验更稳
        segs = []
        for s in pys:
            s2 = re.sub(r'[^a-z]', '', s.lower())
            if s2 == 'lue':
                s2 = 'lve'
            if s2 == 'nue':
                s2 = 'nve'
            if not s2 or s2 not in syl_set:
                ok = False
                break
            segs.append(s2)
        if ok:
            py = ''.join(segs)
            for c in w:
                if c not in char_set:
                    ok = False
                    break
        if ok:
            picked.append((w, py))
            extra_added += 1
    picked.sort(key=lambda t: 0)  # 保序（out 已频次降序）

    body = ''.join('%s,%s;' % (w, py) for w, py in picked)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(body)

    print('收录：%d 条（2字 %d / 3字 %d / 4字 %d，另补保底词 %d）'
          % (len(picked), cnt[2], cnt[3], cnt[4], extra_added))
    print('剔除：音节表外 %d、多音字不确定 %d' % (dropped_syl, dropped_rare))
    print('输出：%s  %.1f KB' % (OUT, os.path.getsize(OUT) / 1024.0))
    for w, py in picked[:12]:
        print('   %s %s' % (w, py))


if __name__ == '__main__':
    main()

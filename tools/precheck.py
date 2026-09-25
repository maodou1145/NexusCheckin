#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precheck.py —— hvigor(DevEco 6.1.1) 专有硬错 + lite 黑屏隐患的本地预检

为什么需要它：SDK 自带的 ace-loader（老的命令行 webpack 编译）**规则更松**，
有些 6.1.1 hvigor 链的**阻断级**错误它根本不报。最典型的就是
  `The list-item tag can have only one child node.` + hvigor 00308018
—— ace-loader 编译 SUCCESS，DevEco 里 BUILD FAILED。血亏过一次，所以做成预检。

检查项：
  【hvigor 阻断级】
  1. HML: `<list-item>` 直接子元素 > 1 个            → hvigor 硬阻断 00308018
  2. CSS: 复合类选择器 `.a.b`                        → 不支持
  3. CSS: `height/width: auto`                       → 不支持
  4. CSS: `align-items: baseline`                    → 不支持
  5. CSS: 选择器列表 `.a, .b`                        → 不支持（拆成独立规则）
  6. CSS: 伪类 / 子选择器 / 兄弟选择器 / 属性选择器   → 解析器报 00308018
  7. CSS: `transform` 里 translate/rotate 数值缺单位  → WARN（补 px）
  【lite 黑屏/不可见级（ace-loader 与 hvigor 都不报）】
  8. HML: `<swiper>` 内含 `<list>`（含后代）          → 整页不渲染 = 黑屏（本次踩坑）
  9. HML: `<list>` 直接子元素不是 `<list-item>`       → 结构约束
 10. HML: `<list-item>` 的父不是 `<list>`            → 结构约束
 11. HML+CSS: 元素缺固定 width / height              → 被算 0 尺寸，整块不渲染/文字不可见
 12. HML: 用了 `if` 的容器缺固定 height              → 整区不渲染
 13. HML: 根元素不是 div / stack                     → 不支持
 14. HML: 出现了白名单外的标签                        → 编译/渲染异常

用法：python tools/precheck.py <工程根目录>
"""

import os
import re
import sys

SKIP_DIRS = {'build', 'dist', '.hvigor', '.idea', 'node_modules', 'oh_modules', 'tools'}

# SDK ace-loader/lib/templater/lite_component_map.js 的 Lite Wearable 白名单
WHITELIST = {
    'div', 'stack', 'list', 'list-item', 'swiper', 'tabs', 'tab-bar', 'tab-content',
    'image-animator', 'image', 'img', 'progress', 'text', 'marquee',
    'analog-clock', 'clock-hand', 'chart', 'input', 'slider', 'switch', 'picker-view',
    'qrcode', 'canvas',
}

ATOMIC = {'text', 'image', 'img', 'progress', 'marquee', 'qrcode', 'canvas'}

SKIP_ATTR_RE = re.compile(r'^[:\w-]+\s*=')


def strip_comments_html(s):
    return re.sub(r'<!--.*?-->', '', s, flags=re.S)


TAG_RE = re.compile(r'<(/?)([a-zA-Z][\w-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*?)(/?)>', re.S)


def parse_hml(path):
    """返回 (元素列表, 问题列表)。元素: dict(tag, line, children, attrs, closed)"""
    src = strip_comments_html(open(path, encoding='utf-8').read())
    stack = []
    roots = []
    problems = []

    for m in TAG_RE.finditer(src):
        closing, tag, attrs, self_close = m.group(1), m.group(2), m.group(3), m.group(4)
        line = src[:m.start()].count('\n') + 1
        tag = tag.lower()

        if closing:
            if not stack:
                continue
            top = stack.pop()
            node = top
            while stack and stack[-1][0] in ('swiper', 'list', 'list-item', 'div', 'stack', 'tabs', 'tab-content'):
                break
            # 校验这个已闭合节点的结构约束
            if tag == 'list-item' and node[3] > 1:
                problems.append((node[1], '`<list-item>` 有 %d 个直接子元素（只能有 1 个）→ hvigor 00308018' % node[3]))
            if tag == 'list':
                for c in node[5]:
                    if c[0] != 'list-item':
                        problems.append((c[1], '`<list>` 的直接子元素是 `%s`（只能是 list-item）' % c[0]))
            if tag == 'swiper':
                bad = [t for t in walk_tags(node)]
                if 'list' in bad:
                    idx = bad.index('list')
                    problems.append((node[1], '`<swiper>` 内含 `<list>` → 官方父子结构约束「swiper 不支持包含 list」，'
                                             '真机整页不渲染 = 黑屏'))
            if tag not in WHITELIST:
                problems.append((node[1], '标签 `%s` 不在 Lite Wearable 白名单内' % tag))
            if node[0] == 'root' and tag not in ('div', 'stack'):
                problems.append((node[1], '页面根元素是 `%s`（必须且只能是 div / stack）' % tag))
            continue

        if tag not in WHITELIST:
            problems.append((line, '标签 `%s` 不在 Lite Wearable 白名单内' % tag))

        node = [tag, line, attrs, 0, self_close, []]
        if stack:
            stack[-1][3] += 1
            stack[-1][5].append(node)
        else:
            if tag not in ('div', 'stack'):
                problems.append((line, '页面根元素是 `%s`（必须且只能是 div / stack）' % tag))
            roots.append(node)
        if not self_close:
            stack.append(node)

    if len(roots) > 1:
        problems.append((roots[1][1], '页面有 %d 个根元素（只能有 1 个）' % len(roots)))

    # list-item 父必须 list
    def check_parent(node, parent):
        if node[0] == 'list-item' and (parent is None or parent[0] != 'list'):
            problems.append((node[1], '`<list-item>` 的父是 `%s`（必须是 list）' % (parent[0] if parent else '无')))
        for c in node[5]:
            check_parent(c, node)

    for r in roots:
        check_parent(r, None)

    return roots, problems


def walk_tags(node, out=None):
    if out is None:
        out = []
    for c in node[5]:
        out.append(c[0])
        walk_tags(c, out)
    return out


# ─────────────────────── CSS ───────────────────────

COMPOUND_SEL = re.compile(r'\.[\w-]+\.[\w-]+')
PSEUDO_SEL = re.compile(r'(::?[\w-]+|(?<=\s)[>+~]\s|\[[^\]\n]+\])')
RULE_RE = re.compile(r'([^{}]+)\{([^{}]*)\}', re.S)


def parse_css(text):
    """返回 {class_name: {'width':bool,'height':bool,'line':int}}"""
    out = {}
    for m in RULE_RE.finditer(text):
        sel, body = m.group(1).strip(), m.group(2)
        line = text[:m.start()].count('\n') + 1
        for cls in re.findall(r'\.([\w-]+)', sel):
            d = out.setdefault(cls, {'width': False, 'height': False, 'line': line, 'sel': sel})
            if re.search(r'(?<!-)width\s*:', body):
                d['width'] = True
            if re.search(r'(?<!-)height\s*:', body):
                d['height'] = True
            d['sel'] = sel
    return out


def check_css(path):
    src = open(path, encoding='utf-8').read()
    problems = []
    for i, line in enumerate(src.split('\n'), 1):
        raw = line.strip()
        if not raw or raw.startswith('/*') or raw.startswith('*') or raw.startswith('//'):
            continue
        if '{' in raw and ':' not in raw.split('{')[0]:
            sel = raw.split('{')[0].strip()
            if sel.startswith('@'):
                continue
            if COMPOUND_SEL.search(sel):
                problems.append((i, '复合类选择器 `%s` 不支持（用独立 class）' % sel))
            if ',' in sel:
                problems.append((i, '选择器列表 `%s` 不支持（拆成独立规则）' % sel))
            mo = PSEUDO_SEL.search(sel)
            if mo and not mo.group(0).startswith(':'):
                problems.append((i, '选择器里用了 `%s`，lite 解析器会报 00308018' % mo.group(0)))
            elif mo:
                problems.append((i, '选择器里用了伪类 `%s`，lite 解析器会报 00308018' % mo.group(0)))
        flat = raw.replace(' ', '')
        if 'height:auto' in flat or 'width:auto' in flat:
            problems.append((i, '不支持 `auto` 尺寸'))
        if 'align-items:baseline' in flat:
            problems.append((i, '不支持 `align-items: baseline`'))
        if 'transform' in raw:
            for fn in re.findall(r'(translate[XY]?|rotate|scale)\w*\(([^)]*)\)', raw):
                body = fn[1].strip()
                if body and re.fullmatch(r'-?\d+(\.\d+)?', body):
                    problems.append((i, '`%s(%s)` 缺单位（应写 %spx）' % (fn[0], body, body)))
    return problems


# ─────────────────────── 尺寸完整性 ───────────────────────

def collect_sized(roots, out):
    """递归收集元素：tag / line / classes / inline_style / 是否有尺寸"""
    for n in roots:
        out.append(n)
        for c in n[5]:
            collect_sized([c], out)
    return out


def check_sizes(hml_data, css_map):
    """元素缺固定 width/height → lite 算 0 尺寸 → 不渲染 / 文字不可见"""
    problems = []
    roots, elems = hml_data
    for n in collect_sized(roots, []):
        tag, line, attrs = n[0], n[1], n[2]
        classes = []
        mo = re.search(r'class\s*=\s*"([^"]*)"', attrs)
        if mo:
            classes = mo.group(1).split()
        style = ''
        mo2 = re.search(r'style\s*=\s*"([^"]*)"', attrs)
        if mo2:
            style = mo2.group(1)
        if not classes:
            # 【只检查用 class 的元素】
            # 完全靠 inline style 布局的元素（螃蟹键盘原工程风格，靠父容器/stack 坐标定位，
            # 已真机验证）不套用"flex 居中下缺尺寸"规则，跳过以免误报。
            # 注意：带 class 的元素即使额外写了 inline style（如 swiper 的背景色）仍要查尺寸。
            continue
        if re.search(r'\b(left|top|right|bottom)\s*:', style):
            # 用 left/top 坐标定位的元素：位置由坐标决定，不受 flex 居中影响
            continue
        has_w = bool(re.search(r'(?<!-)width\s*:', style))
        has_h = bool(re.search(r'(?<!-)height\s*:', style))
        own_100 = ('width: 100%' in style.replace(':', ': ') or 'width:100%' in style.replace(' ', ''))
        for c in classes:
            d = css_map.get(c)
            if d is None:
                problems.append((line, '`<%s class="%s">` 的 class 在 CSS 里没定义' % (tag, c)))
                continue
            if d['width'] or own_100:
                has_w = True
            if d['height'] or own_100:
                has_h = True
        # 根节点允许 100% 特例
        is_root = (n is roots[0])
        miss = []
        # 【只有容器/滚动组件才强制 height】——它们没有高度就整块不渲染（黑屏主因）。
        # text / image / progress 这类原子组件的 height 由内容或资源决定，不强制
        # （技能库 CSS 模板 D 的 `.stage-text` 本身也只写 width）；
        # 但 text 仍要求有 width，否则在 flex column 居中下会算 0 宽而看不见。
        NEED_H = ('div', 'stack', 'swiper', 'list', 'list-item', 'tabs', 'tab-content')
        NEED_W = NEED_H + ('text', 'image', 'img', 'progress', 'marquee')
        if not has_h and not is_root and tag in NEED_H:
            miss.append('height')
        if not has_w and not is_root and tag in NEED_W:
            miss.append('width')
        if miss:
            problems.append((line, '`<%s class="%s">` 缺固定 %s → lite 会算 0 尺寸，不渲染/看不见'
                             % (tag, ' '.join(classes) or '(inline)', ' 和 '.join(miss))))
    return problems


# ─────────── HML 事件前缀：必须用裸名，不能用 `grab:` / `on:` ───────────
# 2026-09-24 实测（HarmonyOS 6.1 wearable 模拟器 / API 24，uitest 注入验证）：
#   · `onclick="fn"`（裸名）→ 事件**注册成功**，布局树 dumpLayout 显示 click=true，注入点击生效；
#   · `grab:click="fn"` / `on:click="fn"` → 事件**完全没注册**，click=false，点了毫无反应。
# 后果：整页所有按钮变成"装饰"，包括"设置 Token → 打开键盘"这类关键入口。
# 两个编译链都不报（HML 语法合法），只能静态查。
EVENT_PREFIX = re.compile(r'<[^>]*?\b((?:grab|on):(?:click|longpress|swipe|touchstart|touchmove|touchend|touchcancel|change))\s*=')

# HML 注释里的举例不算（如本文档自身的说明文字）
def check_events(text):
    problems = []
    body = strip_comments_html(text)
    for m in EVENT_PREFIX.finditer(body):
        line = body[:m.start()].count('\n') + 1
        attr = m.group(1)
        bare = 'on' + attr.split(':', 1)[1]
        problems.append((line, '事件用了 `%s` 前缀写法 → 该运行时**不会注册事件**（点了没反应）；'
                               '改成裸名 `%s=`' % (attr, bare)))
    return problems


# ─────────────────────── JS：正则字面量 ───────────────────────
# lite 引擎是裁剪版 JerryScript，编译 profile **不支持正则表达式字面量**：
#     Script Error: SyntaxError: Regexp is not supported in the selected profile.
# 后果：页面 JS 求值失败 → 整页黑屏，而 ace-loader / hvigor 都不报（它们用 V8）。
# 这是本项目最贵的一次踩坑（2026-09-24），所以做成静态检查。
JS_STR1 = re.compile(r"'(?:\\.|[^'\\])*'")
JS_STR2 = re.compile(r'"(?:\\.|[^"\\])*"')
JS_LINE_COMMENT = re.compile(r'//[^\n]*')
JS_BLOCK_COMMENT = re.compile(r'/\*.*?\*/', re.S)
# 正则字面量的判定（两重收紧，避免把注释/字符串里的 API 路径误判成正则）：
#   ① 前面不能是标识符/右括号/引号/斜杠（排掉 '.../pages/x...'、路径片段）
#   ② 匹配内容里**必须含正则元字符**（排掉 /pages/i、/api/points 这类纯路径）
JS_REGEX_LIT = re.compile(r"""(?<![\w)\]'"\/])/(?![/*\s])(?:\\.|[^/\\\n])+/[gimsuy]*""")
JS_REGEX_META = re.compile(r'[\\\[\](){}.*+?^$|]')
JS_PATHLIKE = re.compile(r'^/[A-Za-z0-9_.\-]*/$')


def strip_js_strings(s):
    s = JS_BLOCK_COMMENT.sub(' ', s)
    s = JS_LINE_COMMENT.sub(' ', s)
    s = JS_STR1.sub("''", s)
    s = JS_STR2.sub('""', s)
    return s


def check_js(path):
    src = open(path, encoding='utf-8', errors='replace').read()
    code = strip_js_strings(src)
    problems = []
    for m in JS_REGEX_LIT.finditer(code):
        lit = m.group(0)
        if JS_PATHLIKE.match(lit):
            continue
        if not JS_REGEX_META.search(lit):
            continue          # 不含元字符 → 是路径片段而非正则
        line = code[:m.start()].count('\n') + 1
        problems.append((line, '正则字面量 `%s` —— lite 的 JerryScript 不支持正则，'
                               '会导致整页 JS 求值失败=黑屏；改用 charCodeAt/循环' % lit))
    return problems


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    root = sys.argv[1]
    total = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        hmls = [f for f in sorted(filenames) if f.endswith('.hml')]
        css_map = {}
        css_cache = {}
        for fn in sorted(filenames):
            if fn.endswith('.css'):
                full = os.path.join(dirpath, fn)
                css_cache[fn] = (full, parse_css(open(full, encoding='utf-8').read()))

        for fn in hmls:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace('\\', '/')
            roots, hml_probs = parse_hml(full)
            for line, msg in hml_probs:
                total += 1
                print('  [FAIL] %s:%d  %s' % (rel, line, msg))
            for line, msg in check_events(open(full, encoding='utf-8', errors='replace').read()):
                total += 1
                print('  [FAIL] %s:%d  %s' % (rel, line, msg))
            # 找同名 css
            base = os.path.splitext(fn)[0]
            if base + '.css' in css_cache:
                _, cm = css_cache[base + '.css']
                for line, msg in check_sizes((roots, None), cm):
                    total += 1
                    print('  [FAIL] %s:%d  %s' % (rel, line, msg))

        for fn, (full, _) in css_cache.items():
            rel = os.path.relpath(full, root).replace('\\', '/')
            for line, msg in check_css(full):
                total += 1
                print('  [FAIL] %s:%d  %s' % (rel, line, msg))

        for fn in sorted(filenames):
            if fn.endswith('.js'):
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root).replace('\\', '/')
                for line, msg in check_js(full):
                    total += 1
                    print('  [FAIL] %s:%d  %s' % (rel, line, msg))

    print('-' * 74)
    if total == 0:
        print('  ✅ 未发现 hvigor 专有硬错 / lite 黑屏隐患')
    else:
        print('  ❌ 共 %d 处（ace-loader 与 hvigor 都可能不报，真机表现为黑屏/元素消失）' % total)
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())

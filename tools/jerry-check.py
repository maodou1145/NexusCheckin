#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jerry-check.py —— 用【真机同款引擎】给 JS 做语法体检（Lite Wearable 专用）

════════════════════════════════════════════════════════════════════════
为什么必须做这一步（2026-09-24 血亏实证）
════════════════════════════════════════════════════════════════════════
ace-loader 与 hvigor **都用 Node(V8) 解析 JS**，所以

        V8 能过  ≠  lite 真机能过

lite 引擎是**裁剪版 JerryScript**，编译 profile 关掉了不少特性，
最典型、也最致命的是【**正则表达式字面量**】：

    Script Error: SyntaxError: Regexp is not supported in the selected profile.

后果链条（真机/预览器表现为**整页黑屏**）：
    页面 JS 含正则
      → JS 求值失败（引擎日志：`Eval JS file failed`）
      → rootComponent 为 undefined（引擎日志：`Nothing to render as it is undefined.`）
      → 屏幕上什么都没有，只剩黑底

**而 ace-loader 和 hvigor 两条编译链都不会报这个错**，
因为它们在 V8 里跑得好好的 —— 这是最坑的地方。

════════════════════════════════════════════════════════════════════════
原理
════════════════════════════════════════════════════════════════════════
SDK 的 ace-loader 里**自带 jerry.exe**（就是引擎本体）：
    <SDK>/<API>/js/build-tools/ace-loader/bin/jerry.exe
用它对【编译产物】跑 `--parse-only`（只解析不执行），
等价于真机在解析这份代码 —— 零猜测、零真机往返。

════════════════════════════════════════════════════════════════════════
用法
════════════════════════════════════════════════════════════════════════
    python tools/jerry-check.py <工程根目录>
    python tools/jerry-check.py <工程根目录> --sdk "D:/OpenHaymony_SDK_6.1.1/10"
    python tools/jerry-check.py <工程根目录> --out <已有产物目录>    # 跳过编译

退出码 0 = 全部通过；1 = 有文件在真机引擎上解析失败。
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

# ── 常见 SDK 根候选（按本机实际情况，可用 --sdk 覆盖）。
#     用户目录用 expanduser 动态取，避免写死某台机器的用户名 ──
HOME = os.path.expanduser('~').replace('\\', '/')
SDK_CANDIDATES = [
    r'D:/OpenHaymony_SDK_6.1.1/10',
    r'D:/OpenHaymony_SDK_6.1.1/9',
    r'D:/OpenHaymony_SDK_6.1.1',
    HOME + '/AppData/Local/Huawei/Sdk',
]

NODE_CANDIDATES = [
    HOME + '/.workbuddy/binaries/node/versions/22.22.2-2/node.exe',
    HOME + '/.workbuddy/binaries/node/versions/22.22.2/node.exe',
    r'C:/Program Files/nodejs/node.exe',
]


def find_file(cands, rel, what):
    for base in cands:
        p = os.path.normpath(os.path.join(base, rel))
        if os.path.exists(p):
            return p
    return None


def sdk_aceloader(sdk):
    """在给定 SDK 根下找 ace-loader 目录"""
    if not sdk:
        return None
    for rel in ('js/build-tools/ace-loader', '10/js/build-tools/ace-loader',
                '9/js/build-tools/ace-loader'):
        p = os.path.normpath(os.path.join(sdk, rel))
        if os.path.isdir(p) and os.path.exists(os.path.join(p, 'webpack.lite.config.js')):
            return p
    return None


def locate(sdk_arg):
    aceloader = None
    if sdk_arg:
        aceloader = sdk_aceloader(sdk_arg)
        if not aceloader:
            print('  [FAIL] --sdk 指向的目录里找不到 js/build-tools/ace-loader：%s' % sdk_arg)
            return None, None
    else:
        for base in SDK_CANDIDATES:
            aceloader = sdk_aceloader(base)
            if aceloader:
                break
    if not aceloader:
        print('  [FAIL] 找不到 ace-loader，请用 --sdk 指定 SDK 根（如 D:/OpenHaymony_SDK_6.1.1/10）')
        return None, None
    jerry = os.path.join(aceloader, 'bin', 'jerry.exe')
    if not os.path.exists(jerry):
        jerry = os.path.join(aceloader, 'bin', 'jerry')
    if not os.path.exists(jerry):
        print('  [FAIL] ace-loader 里没有 jerry 可执行文件：%s' % os.path.join(aceloader, 'bin'))
        return None, None
    return aceloader, jerry


def read_pages(proj):
    """从 config.json 读页面列表"""
    for rel in ('entry/src/main/config.json', 'entry/src/main/resources/base/profile/config.json'):
        p = os.path.join(proj, *rel.split('/'))
        if not os.path.exists(p):
            continue
        try:
            cfg = json.load(open(p, encoding='utf-8'))
        except Exception:
            continue
        mods = cfg.get('module', {})
        for js in mods.get('js', []):
            pages = js.get('pages') or []
            if pages:
                return pages
    return None


def find_node():
    for p in NODE_CANDIDATES:
        if os.path.exists(p):
            return p
    return shutil.which('node')


def compile_project(proj, aceloader, node, pages, out_dir):
    """把 MainAbility 拷到临时目录 + 生成 manifest.json，用 ace-loader 编译"""
    src = os.path.join(proj, 'entry', 'src', 'main', 'js', 'MainAbility')
    if not os.path.isdir(src):
        print('  [FAIL] 找不到 %s' % src)
        return False
    work = os.path.join(out_dir, 'MainAbility')
    shutil.copytree(src, work)
    # 从 config.json 里的 label/bundleName 取 appID，取不到就用占位
    app_id = 'com.example.liteapp'
    try:
        cfg = json.load(open(os.path.join(proj, 'entry', 'src', 'main', 'config.json'), encoding='utf-8'))
        app_id = cfg.get('app', {}).get('bundleName') or app_id
    except Exception:
        pass
    manifest = {
        'appID': app_id,
        'versionName': '1.0.0',
        'versionCode': 1000000,
        'minPlatformVersion': 10,
        'pages': pages,
    }
    with open(os.path.join(work, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh)
    out = os.path.join(out_dir, 'out')
    cmd = [
        node, os.path.join('node_modules', 'webpack', 'bin', 'webpack.js'),
        '--config', 'webpack.lite.config.js',
        '--env', 'aceModuleRoot=' + work.replace('\\', '/'),
        '--env', 'aceModuleBuild=' + out.replace('\\', '/'),
        '--env', 'cachePath=' + os.path.join(out_dir, 'cache').replace('\\', '/'),
        '--env', 'deviceType=liteWearable',
        '--env', 'buildMode=debug',
    ]
    env = dict(os.environ)
    env.pop('NODE_OPTIONS', None)
    try:
        r = subprocess.run(cmd, cwd=aceloader, env=env, capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
    except Exception as e:
        print('  [FAIL] 编译调用失败：%s' % e)
        return False
    tail = [l for l in (r.stdout or '').splitlines() if 'COMPILE RESULT' in l]
    if tail:
        print('  ' + tail[-1].strip())
    if not os.path.isdir(out):
        print('  [FAIL] 编译未产出目录：%s' % out)
        print('  ---- 编译器输出末尾 ----')
        for l in (r.stdout or '').splitlines()[-15:]:
            print('    ' + l)
        return False
    return out


def jerry_parse_all(jerry, out_dir):
    targets = []
    for dp, dn, fn in os.walk(out_dir):
        for f in sorted(fn):
            if f.endswith('.js'):
                targets.append(os.path.join(dp, f))
    targets.sort()
    if not targets:
        print('  [FAIL] 产物目录里没有 .js')
        return 1
    bad = 0
    for p in targets:
        rel = os.path.relpath(p, out_dir).replace('\\', '/')
        try:
            r = subprocess.run([jerry, '--parse-only', p], capture_output=True, text=True,
                               encoding='utf-8', errors='replace')
        except Exception as e:
            print('  [FAIL] %-40s 引擎调用失败: %s' % (rel, e))
            bad += 1
            continue
        blob = (r.stdout or '') + (r.stderr or '')
        if 'Script Error' in blob:
            bad += 1
            msg = [l.strip() for l in blob.splitlines() if 'Script Error' in l]
            print('  [FAIL] %-40s' % rel)
            for m in msg[:3]:
                print('         %s' % m)
            for extra in [l.strip() for l in blob.splitlines() if l.strip().startswith('~')][:1]:
                pass
        else:
            print('  [ OK ] %-40s  %6.1f KB' % (rel, os.path.getsize(p) / 1024))
    return bad


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    proj = os.path.abspath(sys.argv[1])
    sdk_arg = None
    out_arg = None
    argv = sys.argv[2:]
    for i, a in enumerate(argv):
        if a == '--sdk' and i + 1 < len(argv):
            sdk_arg = argv[i + 1]
        if a == '--out' and i + 1 < len(argv):
            out_arg = argv[i + 1]

    print('=== jerry 引擎语法体检（真机同款 JerryScript） ===')
    aceloader, jerry = locate(sdk_arg)
    if not jerry:
        return 1
    print('  ace-loader : %s' % aceloader)
    print('  engine     : %s' % jerry)
    print()

    tmp = None
    try:
        if out_arg:
            out = os.path.abspath(out_arg)
            print('  跳过编译，直接检查已有产物：%s' % out)
        else:
            pages = read_pages(proj)
            if not pages:
                print('  [FAIL] 从 config.json 读不到页面列表（module.js[0].pages）')
                return 1
            print('  页面：%s' % ', '.join(pages))
            node = find_node()
            if not node:
                print('  [FAIL] 找不到 node')
                return 1
            tmp = tempfile.mkdtemp(prefix='jerrychk_')
            out = compile_project(proj, aceloader, node, pages, tmp)
            if not out:
                return 1
        print()
        bad = jerry_parse_all(jerry, out)
    finally:
        if tmp and os.path.isdir(tmp):
            shutil.rmtree(tmp, ignore_errors=True)

    print('-' * 70)
    if bad == 0:
        print('  ✅ 产物在真机同款引擎上全部解析通过')
        print('     （注意：这只保证「语法/属性可用」，不保证运行时行为正确）')
        return 0
    print('  ❌ %d 个文件在真机引擎上解析失败 —— 真机/预览器会黑屏' % bad)
    print('     最常见原因：正则表达式字面量。改用 charCodeAt/循环实现。')
    return 1


if __name__ == '__main__':
    sys.exit(main())

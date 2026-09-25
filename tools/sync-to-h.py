#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把工作区（G 盘）源码同步到构建区（H 盘），**但保留 H 盘里已经注入的 Token / 昵称**。

为什么需要它（2026-09-25 踩过）：
  A 方案的流程是「作者把用户 Token 填进 CONFIG.TOKEN → 构建 → 发 hap」。
  如果同步时用整目录覆盖，**会把作者填好的 Token 清成空字符串**，
  于是构建出来的包成了「未绑定」版本，而且现象很隐蔽（只有接口返回未登录才看得出来）。

本工具做的事：
  1. 先从 H 盘读出 CONFIG 里 `<<< PACK-TOKEN` / `<<< PACK-OWNER` 两行的现值；
  2. 把 G 盘 `entry/src/main/js/MainAbility/**` 与 `entry/src/main/config.json` 覆盖过去；
  3. 再把第 1 步读到的值写回 H 盘的对应行。

用法：
  python tools/sync-to-h.py                      # 默认 G → H 的标准路径
  python tools/sync-to-h.py <源目录> <目标目录>
"""
import os
import re
import shutil
import sys

DEF_SRC = r'G:\系统文件存放\文档\worker buddy\2026-09-24-19-13-38\NexusCheckin'
DEF_DST = r'H:\NexusCheckin'

REL_JS = os.path.join('entry', 'src', 'main', 'js', 'MainAbility')
REL_CFG = os.path.join('entry', 'src', 'main', 'config.json')
REL_README = 'README.md'
REL_TOOLS = 'tools'

MARKERS = {
    'PACK-TOKEN': re.compile(r"^(?P<pre>\s*TOKEN:\s*)(?P<q>['\"])(?P<val>.*?)(?P=q)(?P<post>.*<<<\s*PACK-TOKEN.*)$"),
    'PACK-OWNER': re.compile(r"^(?P<pre>\s*OWNER:\s*)(?P<q>['\"])(?P<val>.*?)(?P=q)(?P<post>.*<<<\s*PACK-OWNER.*)$"),
}


def read_injected(path):
    """读出目标工程里已注入的 TOKEN / OWNER（没有就返回空串）"""
    got = {}
    if not os.path.exists(path):
        return got
    for line in open(path, encoding='utf-8'):
        for key, rx in MARKERS.items():
            m = rx.match(line.rstrip('\n'))
            if m:
                got[key] = m.group('val')
    return got


def restore_injected(path, values):
    """把 TOKEN / OWNER 写回目标工程（内容为空就跳过，避免把空值写回去覆盖）"""
    if not values:
        return []
    lines = open(path, encoding='utf-8').read().split('\n')
    done = []
    for i, line in enumerate(lines):
        for key, rx in MARKERS.items():
            m = rx.match(line)
            if m and values.get(key):
                lines[i] = '%s%s%s%s%s' % (m.group('pre'), m.group('q'), values[key], m.group('q'), m.group('post'))
                done.append(key)
    open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    return done


def copytree(src, dst):
    """合并覆盖（不删目标目录）：源里有的文件盖过去，目标里多出来的保留并提示。
    为什么不整目录删了重拷：作者注入的 Token 就住在 index.js 里，且某些环境
    不允许脚本递归删除（沙盒限制），合并覆盖是唯一稳妥做法。"""
    if not os.path.isdir(src):
        return False
    extra = []
    for dp, dn, fn in os.walk(dst):
        rel = os.path.relpath(dp, dst)
        for f in fn:
            p = os.path.join(src, rel, f) if rel != '.' else os.path.join(src, f)
            if not os.path.exists(p):
                extra.append(os.path.normpath(os.path.join(rel, f)))
    shutil.copytree(src, dst, dirs_exist_ok=True)
    if extra:
        print('⚠️ 目标里有、源里没有的文件（已保留，若已废弃请手动删）：')
        for e in extra[:20]:
            print('   -', e)
    return True


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEF_SRC
    dst = sys.argv[2] if len(sys.argv) > 2 else DEF_DST
    if not os.path.isdir(src) or not os.path.isdir(dst):
        print('源或目标目录不存在：', src, dst)
        return 1

    js_src = os.path.join(src, REL_JS)
    js_dst = os.path.join(dst, REL_JS)
    idx_dst = os.path.join(js_dst, 'pages', 'index', 'index.js')

    # rawfile 资源目录（词库 words.json 等外置数据；2026-09-25 踩坑：不拷的话 H 盘缺词库真机只有兜底 40 词）
    REL_RAW = os.path.join('entry', 'src', 'main', 'resources', 'rawfile')
    raw_src = os.path.join(src, REL_RAW)
    raw_dst = os.path.join(dst, REL_RAW)
    if os.path.isdir(raw_src):
        if not copytree(raw_src, raw_dst):
            print('⚠️ rawfile 目录拷贝失败')
        else:
            print('rawfile 已同步：', REL_RAW)

    # ① 先存下目标工程已注入的 Token / 昵称
    keep = read_injected(idx_dst)
    masked = {k: (v[:12] + '…(%d 字符)' % len(v) if len(v) > 12 else v) for k, v in keep.items()}
    print('目标工程已注入：', masked or '（无）')

    # ② 覆盖源码
    copytree(js_src, js_dst)
    shutil.copy2(os.path.join(src, REL_CFG), os.path.join(dst, REL_CFG))
    for extra in (REL_README,):
        p = os.path.join(src, extra)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(dst, extra))
    if copytree(os.path.join(src, REL_TOOLS), os.path.join(dst, REL_TOOLS)):
        pycache = os.path.join(dst, REL_TOOLS, '__pycache__')
        if os.path.isdir(pycache):
            shutil.rmtree(pycache)

    # ③ 把 Token / 昵称写回去
    done = restore_injected(idx_dst, keep)
    print('已写回：', done or '（无，目标里本来就没注入）')

    # ④ 核对
    left = read_injected(idx_dst)
    ok = all(left.get(k) == keep.get(k) for k in keep)
    print('核对：', '✅ Token / 昵称保持不变' if ok else '❌ 不一致，请人工检查')
    return 0 if ok else 2


if __name__ == '__main__':
    sys.exit(main())

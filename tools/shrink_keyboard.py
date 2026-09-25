#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shrink_keyboard.py —— 把螃蟹键盘的素材缩小到目标尺寸，并把它居中在 466 宽屏里

为什么要缩（原版在 466x466 圆屏上的三个问题）：
  1. 键盘布局图 570px 宽（10 键 × 57px），比 466 屏还宽 → 必须左右滑才能按到边上的键；
     符号布局更宽（741px）。
  2. 键盘面板 .keyContainer 高 325px、top 160 → 底部到 485，超出 466 屏，底部按钮被裁。
  3. 原版是按 408px 宽的内容区设计的（左对齐），在 466 圆屏上左边贴边、右边空 58px，
     圆屏边角会把最左/最右的键切掉。

缩放系数：k = 42/57 ≈ 0.7368（横向）、44/60 ≈ 0.7333（纵向）
  → 键距 57 → 42px，行高 60 → 44px，布局图高 180 → 132px
  → 字母布局：570x180 → 420x132，再补 23px 透明边距 → **466x132（正好一屏宽，不用横滑）**
  → 符号布局：741x180 → 546x132，再补边距 → 592x132（只溢出 126px，滑动范围大幅变小）

用 Pillow（system Python 有）。用法：
  python tools/shrink_keyboard.py <crabKeyboard 原始素材目录> <目标 common/keyboard 目录>
"""

import os
import sys

from PIL import Image

KX = 42.0 / 57.0      # 横向缩放
KY = 44.0 / 60.0      # 纵向缩放
PAD = 23              # 布局图左右各补多少透明边距（让 420 宽的键区居中在 466 里）

# (相对路径, 是否补边距居中)
FILES = [
    ('common/1.png', True),
    ('common/2.png', True),
    ('common/3.png', True),
    ('common/close.png', False),
    ('common/dot.png', False),
    ('common/key1.png', False),
    ('common/key2.png', False),
    ('common/key3.png', False),
    ('common/pyShadow.png', False),
    ('common/selectBar.png', False),
    ('common/shadow.png', False),
    ('common/switchL.png', False),
    ('common/switchR.png', False),
    ('common/toolBar.png', False),
    ('common/toolCover.png', False),
    ('rect/cancel.png', False),
    ('rect/confirm.png', False),
    ('rect/confirm0.png', False),
    ('rect/delete.png', False),
    ('rect/enter.png', False),
    ('rect/search.png', False),
    ('rect/space.png', False),
]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src_root, dst_root = sys.argv[1], sys.argv[2]

    total_before = 0
    total_bin_before = 0
    total_after = 0
    total_bin_after = 0

    for rel, pad in FILES:
        src = os.path.join(src_root, rel)
        dst = os.path.join(dst_root, rel)
        if not os.path.exists(src):
            print('  跳过（源不存在）: %s' % rel)
            continue

        im = Image.open(src).convert('RGBA')
        w, h = im.size
        nw, nh = max(1, int(round(w * KX))), max(1, int(round(h * KY)))
        small = im.resize((nw, nh), Image.LANCZOS)

        if pad:
            canvas = Image.new('RGBA', (nw + PAD * 2, nh), (0, 0, 0, 0))
            canvas.paste(small, (PAD, 0))
            out = canvas
        else:
            out = small

        os.makedirs(os.path.dirname(dst), exist_ok=True)
        out.save(dst, 'PNG', optimize=True)

        ob = os.path.getsize(src)
        oa = os.path.getsize(dst)
        total_before += ob
        total_after += oa
        total_bin_before += w * h * 4          # 产物里那份未压缩位图
        total_bin_after += out.size[0] * out.size[1] * 4
        print('  %-22s %4dx%-4d -> %4dx%-4d   bin %7.1f -> %6.1f KB'
              % (rel, w, h, out.size[0], out.size[1],
                 w * h * 4 / 1024, out.size[0] * out.size[1] * 4 / 1024))

    print('-' * 72)
    print('  PNG 合计   %7.1f KB -> %6.1f KB' % (total_before / 1024, total_after / 1024))
    print('  产物 bin   %7.2f MB -> %6.2f MB  （省 %.2f MB）'
          % (total_bin_before / 1024 / 1024, total_bin_after / 1024 / 1024,
             (total_bin_before - total_bin_after) / 1024 / 1024))


if __name__ == '__main__':
    main()

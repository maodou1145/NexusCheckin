#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 Lite Wearable 圆形应用图标（纯标准库，不依赖 Pillow）。

输出（与 DevEco liteWearable 模板一致）：
  entry/src/main/resources/base/media/icon.png        114x114  圆形
  entry/src/main/resources/base/media/icon_small.png   80x80   圆形

图形：外圈亮黄描边 + 青色实心圆 + 白色对勾（对应「签到」语义），4x 超采样抗锯齿。

用法： python tools/gen_icon.py
"""
import math
import os
import struct
import zlib

SS = 4  # 超采样倍数

BG = (14, 165, 165)      # #0ea5a5 主体青
RING = (255, 204, 0)     # #ffcc00 外圈
MARK = (255, 255, 255)   # 对勾

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'entry', 'src', 'main', 'resources', 'base', 'media')


def seg_dist(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = ((px - x1) * dx + (py - y1) * dy) / l2
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def sample(u, v):
    """u,v 为 0..1 归一化坐标，返回 (r,g,b,a)。"""
    cx = cy = 0.5
    d = math.hypot(u - cx, v - cy)
    R = 0.5
    if d > R:
        return (0, 0, 0, 0)
    ring_w = 0.055
    if d > R - ring_w:
        return RING + (255,)
    if d > R - ring_w - 0.012:
        # 环形与主体之间的暗色分隔
        return (10, 30, 34, 255)
    # 主体：轻微径向渐变（中心亮一点）
    k = 1.0 - (d / R) * 0.35
    col = tuple(min(255, int(c * k + 30 * (1 - k))) for c in BG)
    # 对勾（两段折线，厚度按半径比例）
    t = 0.075
    s1 = seg_dist(u, v, 0.315, 0.520, 0.445, 0.650)
    s2 = seg_dist(u, v, 0.445, 0.650, 0.700, 0.365)
    if min(s1, s2) <= t and d <= R - ring_w - 0.012:
        return MARK + (255,)
    return col + (255,)


def render(size):
    n = size * SS
    buf = [0] * (n * n * 4)
    for y in range(n):
        v = (y + 0.5) / n
        for x in range(n):
            u = (x + 0.5) / n
            r, g, b, a = sample(u, v)
            i = (y * n + x) * 4
            buf[i] = r
            buf[i + 1] = g
            buf[i + 2] = b
            buf[i + 3] = a

    # 降采样 -> 抗锯齿
    out = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            ar = ag = ab = aa = 0
            for dy in range(SS):
                for dx in range(SS):
                    i = ((y * SS + dy) * n + (x * SS + dx)) * 4
                    a = buf[i + 3]
                    ar += buf[i] * a
                    ag += buf[i + 1] * a
                    ab += buf[i + 2] * a
                    aa += a
            o = (y * size + x) * 4
            if aa == 0:
                out[o:o + 4] = b'\x00\x00\x00\x00'
            else:
                out[o] = ar // aa
                out[o + 1] = ag // aa
                out[o + 2] = ab // aa
                out[o + 3] = aa // (SS * SS)
    return bytes(out)


def write_png(path, size, rgba):
    raw = b''.join(b'\x00' + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + \
            struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size, name in ((114, 'icon.png'), (80, 'icon_small.png')):
        p = os.path.join(OUT_DIR, name)
        write_png(p, size, render(size))
        print('written %s (%dx%d, %d bytes)' % (p, size, size, os.path.getsize(p)))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_wallpaper.py —— 生成 NexusCheckin 的「每日壁纸」（纯标准库，不依赖 Pillow）

为什么是本地内置图，不是网络拉图？
  · lite 的 <image src> 只支持本地路径，不支持网络 URL
  · @system.fetch 的 responseType 只有 text / json，拿不到二进制 → 下载不了图片
  所以壁纸只能打进包里，用日期轮换。

设计取向：竖向渐变（PNG 逐行相同 → zlib 压缩率极高）+ 扁平几何形状，
         所以 466x466 的图也只有几十 KB，适合小体积手表包。

输出：entry/src/main/js/MainAbility/common/wall/w1.png ... w6.png
"""

import os
import struct
import zlib

# 设计分辨率（形状坐标都按这个尺寸写）
W = H = 466
# 最终输出分辨率：产物里每张图会附带一份「宽×高×4 字节」的未压缩 .bin，
# 466x466 → 848KB/张，6 张就 5MB；降到 240x240 → 225KB/张，6 张约 1.3MB。
TARGET = 240
OUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', 'entry', 'src', 'main', 'js', 'MainAbility', 'common', 'wall',
)


# ---------- 画布 ----------
class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[(0, 0, 0)] * w for _ in range(h)]

    def blend(self, x, y, color, a):
        if a <= 0 or x < 0 or y < 0 or x >= self.w or y >= self.h:
            return
        if a > 1:
            a = 1.0
        r0, g0, b0 = self.px[y][x]
        r1, g1, b1 = color
        self.px[y][x] = (
            int(r0 + (r1 - r0) * a),
            int(g0 + (g1 - g0) * a),
            int(b0 + (b1 - b0) * a),
        )

    def vgrad(self, top, bottom):
        for y in range(self.h):
            t = y / (self.h - 1)
            c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
            row = self.px[y]
            for x in range(self.w):
                row[x] = c

    def disc(self, cx, cy, r, color, alpha=1.0, soft=1.6):
        x0, x1 = max(0, int(cx - r - 2)), min(self.w - 1, int(cx + r + 2))
        y0, y1 = max(0, int(cy - r - 2)), min(self.h - 1, int(cy + r + 2))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d <= r - soft:
                    a = alpha
                elif d >= r:
                    continue
                else:
                    a = alpha * (r - d) / soft
                self.blend(x, y, color, a)

    def ring(self, cx, cy, r, width, color, alpha=1.0):
        r_in = r - width
        x0, x1 = max(0, int(cx - r - 2)), min(self.w - 1, int(cx + r + 2))
        y0, y1 = max(0, int(cy - r - 2)), min(self.h - 1, int(cy + r + 2))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if r_in <= d <= r:
                    a = alpha if (d - r_in) > 1 and (r - d) > 1 else alpha * 0.6
                    self.blend(x, y, color, a)

    def band(self, y0, y1, color, alpha=1.0):
        for y in range(max(0, int(y0)), min(self.h, int(y1))):
            for x in range(self.w):
                self.blend(x, y, color, alpha)

    def poly(self, pts, color, alpha=1.0):
        ys = [p[1] for p in pts]
        y0, y1 = max(0, int(min(ys))), min(self.h - 1, int(max(ys)))
        n = len(pts)
        for y in range(y0, y1 + 1):
            xs = []
            for i in range(n):
                x1, y1_ = pts[i]
                x2, y2_ = pts[(i + 1) % n]
                if (y1_ <= y < y2_) or (y2_ <= y < y1_):
                    t = (y - y1_) / (y2_ - y1_)
                    xs.append(x1 + (x2 - x1) * t)
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(max(0, int(xs[i])), min(self.w, int(xs[i + 1]) + 1)):
                    self.blend(x, y, color, alpha)

    def diag_stripes(self, color, step=44, width=14, alpha=0.10):
        for y in range(self.h):
            for x in range(self.w):
                if ((x + y) % step) < width:
                    self.blend(x, y, color, alpha)

    def stars(self, seed, count, color, alpha=0.85):
        s = seed
        for _ in range(count):
            s = (s * 1103515245 + 12345) & 0x7FFFFFFF
            x = s % self.w
            s = (s * 1103515245 + 12345) & 0x7FFFFFFF
            y = (s % int(self.h * 0.6))
            self.disc(x, y, 1.6, color, alpha, soft=1.2)


# ---------- 面积平均降采样（顺便获得抗锯齿） ----------
def resample(src, n):
    out = Canvas(n, n)
    sx = src.w / float(n)
    sy = src.h / float(n)
    for y in range(n):
        y0, y1 = y * sy, (y + 1) * sy
        iy0, iy1 = int(y0), min(src.h, int(y1) + 1)
        for x in range(n):
            x0, x1 = x * sx, (x + 1) * sx
            ix0, ix1 = int(x0), min(src.w, int(x1) + 1)
            r = g = b = 0.0
            wsum = 0.0
            for yy in range(iy0, iy1):
                wy = min(y1, yy + 1) - max(y0, yy)
                if wy <= 0:
                    continue
                row = src.px[yy]
                for xx in range(ix0, ix1):
                    wx = min(x1, xx + 1) - max(x0, xx)
                    if wx <= 0:
                        continue
                    wgt = wx * wy
                    pr, pg, pb = row[xx]
                    r += pr * wgt
                    g += pg * wgt
                    b += pb * wgt
                    wsum += wgt
            if wsum <= 0:
                out.px[y][x] = (0, 0, 0)
            else:
                out.px[y][x] = (int(r / wsum), int(g / wsum), int(b / wsum))
    return out


# ---------- PNG 写出 ----------
def write_png(path, canvas):
    raw = bytearray()
    for y in range(canvas.h):
        raw.append(0)
        for (r, g, b) in canvas.px[y]:
            raw += bytes((r, g, b))
    comp = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        return (
            struct.pack('>I', len(data)) + tag + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', canvas.w, canvas.h, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', comp)
    png += chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


# ---------- 6 张壁纸 ----------
def w1():
    c = Canvas(W, H)
    c.vgrad((14, 20, 46), (48, 34, 78))
    c.stars(7, 90, (255, 255, 255), 0.75)
    c.disc(233, 150, 62, (255, 214, 102))
    c.disc(233, 150, 74, (255, 214, 102), 0.18, soft=10)
    c.poly([(0, 466), (0, 340), (120, 268), (250, 352), (340, 300), (466, 366), (466, 466)], (24, 26, 58))
    c.poly([(0, 466), (0, 392), (150, 336), (300, 404), (466, 348), (466, 466)], (13, 14, 34))
    return c


def w2():
    c = Canvas(W, H)
    c.vgrad((9, 58, 60), (5, 26, 34))
    for i, r in enumerate((210, 168, 126, 84, 42)):
        c.ring(233, 233, r, 3, (95, 208, 200), 0.30 + i * 0.10)
    c.disc(233, 233, 26, (95, 208, 200), 0.95)
    c.diag_stripes((255, 255, 255), 58, 16, 0.045)
    return c


def w3():
    c = Canvas(W, H)
    c.vgrad((38, 18, 62), (96, 34, 96))
    c.diag_stripes((255, 255, 255), 46, 18, 0.07)
    c.poly([(0, 466), (0, 300), (160, 214), (300, 268), (466, 196), (466, 466)], (196, 92, 132), 0.55)
    c.poly([(0, 466), (0, 372), (170, 306), (330, 356), (466, 300), (466, 466)], (58, 26, 74), 0.85)
    c.disc(348, 128, 54, (255, 236, 179), 0.9)
    return c


def w4():
    c = Canvas(W, H)
    c.vgrad((252, 176, 96), (196, 66, 84))
    c.disc(233, 300, 96, (255, 232, 176), 0.95)
    c.band(300, 466, (120, 34, 62), 0.85)
    c.band(300, 304, (255, 210, 150), 0.5)
    return c


def w5():
    c = Canvas(W, H)
    c.vgrad((16, 40, 34), (8, 20, 22))
    c.stars(23, 70, (200, 255, 236), 0.7)
    c.poly([(0, 466), (0, 372), (120, 232), (232, 372)], (22, 62, 52))
    c.poly([(200, 466), (300, 262), (466, 466)], (30, 84, 68))
    c.poly([(0, 466), (0, 412), (160, 358), (330, 420), (466, 380), (466, 466)], (7, 16, 18))
    return c


def w6():
    c = Canvas(W, H)
    c.vgrad((34, 40, 56), (16, 20, 30))
    c.disc(233, 210, 128, (68, 84, 116), 0.9)
    c.disc(233, 210, 128, (140, 168, 210), 0.22, soft=22)
    c.disc(233, 210, 128, (0, 0, 0), 0.25, soft=40)
    c.disc(233, 210, 66, (140, 168, 210), 0.35)
    c.diag_stripes((255, 255, 255), 70, 14, 0.04)
    return c


NAMES = [
    ('w1.png', w1), ('w2.png', w2), ('w3.png', w3),
    ('w4.png', w4), ('w5.png', w5), ('w6.png', w6),
]


def main():
    total = 0
    bin_total = 0
    for name, fn in NAMES:
        path = os.path.normpath(os.path.join(OUT_DIR, name))
        img = resample(fn(), TARGET)
        size = write_png(path, img)
        bin_size = TARGET * TARGET * 4   # 产物里那份未压缩位图的开销
        total += size
        bin_total += bin_size
        print('%-8s %dx%d  png %6.1f KB  +bin %6.1f KB' % (name, TARGET, TARGET, size / 1024, bin_size / 1024))
    print('合计：png %.1f KB，产物 bin 开销 %.2f MB' % (total / 1024, bin_total / 1024 / 1024))


if __name__ == '__main__':
    main()

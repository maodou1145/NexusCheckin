# -*- coding: utf-8 -*-
"""生成默认用户头像（未登录时用）。
96x96 圆形 · 深灰底 + 白色人形剪影，纯 Pillow 绘制。
产物会由编译期的 lite-image2bin.js 转成 RAW RGBA bin（96*96*4 = 36KB，很小）。"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', 'entry', 'src', 'main', 'js', 'MainAbility', 'common', 'avatar', 'default.png'
)
SIZE = 96
SS = 4               # 4x 超采样做抗锯齿
W = SIZE * SS

img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆形底（深灰，带一点蓝调，跟应用配色一致）
d.ellipse([0, 0, W - 1, W - 1], fill=(58, 62, 74, 255))

# 人形剪影：头（圆） + 肩（半圆/扇形）
head_r = int(W * 0.155)
head_cx, head_cy = W // 2, int(W * 0.375)
d.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r],
          fill=(226, 230, 240, 255))

# 肩：用椭圆的下半部分，然后裁剪掉圆外部分
body_w = int(W * 0.52)
body_h = int(W * 0.42)
bx0 = head_cx - body_w // 2
by0 = int(W * 0.60)
d.ellipse([bx0, by0, bx0 + body_w, by0 + body_h * 2], fill=(226, 230, 240, 255))

# 把圆形外的部分清掉（保证是圆头像）
mask = Image.new('L', (W, W), 0)
md = ImageDraw.Draw(mask)
md.ellipse([0, 0, W - 1, W - 1], fill=255)
out = Image.new('RGBA', (W, W), (0, 0, 0, 0))
out.paste(img, (0, 0), mask)

out = out.resize((SIZE, SIZE), Image.LANCZOS)
path = os.path.normpath(OUT)
os.makedirs(os.path.dirname(path), exist_ok=True)
out.save(path, 'PNG', optimize=True)
print('默认头像: %s  %dx%d  %.1f KB' % (os.path.basename(path), SIZE, SIZE, os.path.getsize(path) / 1024))
print('产物 bin 预估: %.1f KB' % (SIZE * SIZE * 4 / 1024))

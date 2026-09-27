#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
get-token.py —— 一条命令取到 NexusCheckin 的 Token（给自己/给用户打包时用）

为什么需要它：后端 /user/login、/user/login-with-code 都**硬校验极验 captchaToken**
（实测：假凭证也先报「验证码凭证无效」），手表端跑不了 GT3 SDK → 只能从浏览器拿 Token。
本脚本把「打开网站→登录→F12→找 localStorage→复制」压成一条命令。

原理：Playwright 启动**本机 Edge**（channel=msedge，不下载浏览器），用**独立持久化
profile**（tools/.edge-profile）保存登录态 → 第二次起通常无需再登录，秒出 Token。

用法：
  python tools/get-token.py                # 打开浏览器；已登录则直接取，未登录则等你手动登录
  python tools/get-token.py --inject       # 取到后顺手写入 H 盘构建区（PACK-TOKEN 行）
  python tools/get-token.py --wait 600     # 最多等 10 分钟登录（默认 300s）
  python tools/get-token.py --headless     # 无窗口（仅在已登录态下有用）

安全：Token 只写本地文件 tools/.token.txt，不上传任何地方。
"""
import argparse
import base64
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFILE = os.path.join(ROOT, 'tools', '.edge-profile')
OUT_DEFAULT = os.path.join(ROOT, 'tools', '.token.txt')
H_INDEX = r'H:/NexusCheckin/entry/src/main/js/MainAbility/pages/index/index.js'
SITE = 'https://ws.fseatech.cn'

# 在页面里找 Token：① localStorage['token'] ② 任何以 eyJ 开头的值
# ③ 值本身是 JSON、里面带 token 字段（很多前端这样存）
FIND_JS = """() => {
  const out = { token: '', key: '', from: '' };
  const ok = (v) => typeof v === 'string' && v.trim().length > 40;
  try {
    const direct = localStorage.getItem('token');
    if (ok(direct) && direct.trim().indexOf('eyJ') === 0) {
      out.token = direct.trim(); out.key = 'token'; out.from = 'localStorage.token'; return out;
    }
  } catch (e) {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (!ok(v)) continue;
      const t = v.trim();
      if (t.indexOf('eyJ') === 0) { out.token = t; out.key = k; out.from = 'localStorage.' + k; return out; }
      if (t.charAt(0) === '{') {
        try {
          const o = JSON.parse(t);
          const cand = o.token || o.accessToken || o.access_token;
          if (cand && typeof cand === 'string' && cand.indexOf('eyJ') === 0) {
            out.token = cand; out.key = k; out.from = 'localStorage.' + k + '.token'; return out;
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  return out;
}"""


def jwt_exp(token):
    """解析 JWT exp（不做签名校验，只看有效期）"""
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return None
        p = parts[1].replace('-', '+').replace('_', '/')
        p += '=' * (-len(p) % 4)
        obj = json.loads(base64.b64decode(p).decode('utf-8', 'replace'))
        return obj.get('exp')
    except Exception:
        return None


def describe(token):
    n = len(token)
    exp = jwt_exp(token)
    if not exp:
        return '长度 %d 字符（非标准 JWT，无法判断有效期）' % n
    left = int(exp - time.time())
    if left <= 0:
        return '长度 %d 字符 · ⚠️ 已过期（%d 秒前）' % (n, -left)
    d, h = left // 86400, (left % 86400) // 3600
    when = time.strftime('%Y-%m-%d %H:%M', time.localtime(exp))
    return '长度 %d 字符 · 有效至 %s（还剩 %d 天 %d 小时）' % (n, when, d, h)


def inject(token):
    """写入 H 盘构建区 PACK-TOKEN 行（与 sync-to-h.py / pack-for-user.js 同款正则）"""
    if not os.path.exists(H_INDEX):
        return '⚠️ 没找到 H 盘构建区（%s），跳过注入' % H_INDEX
    s = open(H_INDEX, encoding='utf-8').read()
    pat = re.compile(r"^(\s*TOKEN:\s*)('[^']*'|\"[^\"]*\")(\s*,\s*//\s*<<<\s*PACK-TOKEN)", re.M)
    if not pat.search(s):
        return '⚠️ H 盘 index.js 里没找到 <<< PACK-TOKEN 标记行，跳过注入'
    s2 = pat.sub(lambda m: "%s'%s'%s" % (m.group(1), token, m.group(3)), s, count=1)
    open(H_INDEX, 'w', encoding='utf-8', newline='\n').write(s2)
    return '✅ 已注入 H 盘构建区（下次构建的包就用这个 Token）'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--inject', action='store_true', help='取到后写入 H 盘构建区')
    ap.add_argument('--wait', type=int, default=300, help='未登录时最多等多少秒（默认 300）')
    ap.add_argument('--headless', action='store_true', help='无窗口运行')
    ap.add_argument('--out', default=OUT_DEFAULT, help='保存路径（默认 tools/.token.txt）')
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('缺 playwright（当前 Python：%s）' % sys.executable)
        print('两种办法：')
        print('  ① 直接双击同目录的 get-token.bat（里面写好了正确的 Python 路径）')
        print('  ② 或用带 playwright 的 Python 跑：')
        print('     "C:\\Program Files\\PyManager\\python.exe" tools/get-token.py')
        sys.exit(1)

    os.makedirs(PROFILE, exist_ok=True)
    print('启动本机 Edge（独立 profile，已登录过就直接出 Token）…')
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE, channel='msedge', headless=args.headless,
            args=['--no-first-run', '--no-default-browser-check'],
            viewport={'width': 1280, 'height': 900})
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(SITE, wait_until='domcontentloaded', timeout=45000)
        except Exception as e:
            print('打开网站失败：%s（仍继续尝试读取本地登录态）' % e)

        token, src = '', ''
        deadline = time.time() + max(5, args.wait)
        told = False
        while time.time() < deadline:
            try:
                r = page.evaluate(FIND_JS) or {}
                if r.get('token'):
                    token, src = r['token'], r.get('from') or 'localStorage'
                    break
            except Exception:
                pass
            if not told:
                print('没读到 Token —— 请在刚打开的浏览器窗口里登录（滑块正常过一遍），'
                      '登录成功后脚本会自动抓到并保存。')
                told = True
            time.sleep(2)

        if not token:
            print('超时没拿到 Token。请重跑本脚本，在浏览器窗口里完成登录。')
            ctx.close()
            sys.exit(2)

        print('\n✅ 拿到 Token（来自 %s）' % src)
        print('   %s' % describe(token))
        with open(args.out, 'w', encoding='utf-8', newline='\n') as f:
            f.write(token)
        print('   已保存：%s' % args.out)
        print('   ⚠️ 这是账号钥匙，别发群/别截图；本地文件已加入 .gitignore。')
        if args.inject:
            print('   ' + inject(token))
        ctx.close()


if __name__ == '__main__':
    main()

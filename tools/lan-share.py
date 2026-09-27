#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
lan-share.py —— 局域网直连取 Token（PC 上跑，手表从局域网把 Token 拿走）

思路：PC 与手表在同一局域网时，PC 起一个极小的 HTTP 服务，把 Token 放在文件里；
      手表端「我的 → 取件码绑定 → 直接点确认（留空）」即从 CONFIG.LAN_API 拉取。
      全程不过云端、不用注册、不用部署云服务。

用法：
  python tools/lan-share.py                  # 用 tools/.token.txt（get-token.py 存的）
  python tools/lan-share.py --token eyJ...   # 直接指定 Token
  python tools/lan-share.py --port 8123      # 换端口
  python tools/lan-share.py --open           # 顺带把 PC 的取件页在浏览器打开

跑起来后，把打印出来的地址填进手表工程 CONFIG.LAN_API，重新打包即可。
⚠️ 第一次运行 Windows 可能弹防火墙询问，选「允许」（否则手表连不上）。
"""
import argparse
import http.server
import io
import os
import socket
import socketserver
import sys
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_FILE = os.path.join(ROOT, 'tools', '.token.txt')
SHARE_DIR = os.path.join(ROOT, 'tools', '.lan-share')


def pick_token(args):
    if args.token:
        return args.token.strip()
    if os.path.exists(TOKEN_FILE):
        t = io.open(TOKEN_FILE, encoding='utf-8').read().strip()
        if t:
            print('已读取 Token：%s（来自 tools/.token.txt）' % (t[:12] + '...' + t[-6:]))
            return t
    print('没找到 Token。先用 `python tools/get-token.py` 取一次，或用 --token 指定。')
    sys.exit(1)


def lan_ips():
    """列出本机所有可能的局域网 IPv4（用 UDP 技巧拿主网卡地址 + 兜底枚举）"""
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('114.114.114.114', 80))
        ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith('127.'):
                ips.append(ip)
    except Exception:
        pass
    out = []
    for ip in ips:
        if ip.startswith('192.168.') or ip.startswith('10.') or ip.startswith('172.'):
            out.append(ip)
    return out or ips


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--token', default='', help='直接指定 Token（默认读 tools/.token.txt）')
    ap.add_argument('--port', type=int, default=8123, help='HTTP 端口（默认 8123）')
    args = ap.parse_args()

    token = pick_token(args)
    # ⚠️ 加固：只接受看起来是真的 JWT（>100 字符且以 eyJ 开头）——
    #   2026-09-27 踩过：测试残留的假 Token 被服务给手表，毛豆取到 40 字符假串
    if len(token) < 100 or not token.startswith('eyJ'):
        print('⚠️ 这个 Token 看着不对（长度 %d，开头 %r），拒绝启动。' % (len(token), token[:12]))
        print('   请先跑：python tools/get-token.py（会打开浏览器让你登录，自动存真 Token）')
        sys.exit(1)
    # 每次启动先清空输出目录，杜绝旧文件残留
    if os.path.isdir(SHARE_DIR):
        for _f in os.listdir(SHARE_DIR):
            try:
                os.remove(os.path.join(SHARE_DIR, _f))
            except Exception:
                pass
    os.makedirs(SHARE_DIR, exist_ok=True)
    # 手表端用 getJson 解析 → 必须是 JSON；同时留一份纯文本方便浏览器/curl 检查
    with io.open(os.path.join(SHARE_DIR, 'token.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('{"token":"%s"}' % token)
    with io.open(os.path.join(SHARE_DIR, 'token.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(token)

    ips = lan_ips()
    if not ips:
        print('⚠️ 没找到局域网 IPv4，请确认已连接 Wi-Fi / 网线')
        sys.exit(1)

    print('')
    print('=' * 62)
    print('  放在手表工程 CONFIG.LAN_API 的地址（任选一个能 ping 通的）：')
    for ip in ips:
        print('     http://%s:%d/token.json' % (ip, args.port))
    print('=' * 62)
    print('  Token 长度：%d 字符（手表取件成功会显示同样长度，可对照核对）' % len(token))
    print('  手表操作：「我的」→ 点底部「取件码绑定」→ 直接点「确认」（留空）')
    print('  自测（浏览器/curl 打开下面地址，应看到 {"token":"..."}）：')
    for ip in ips:
        print('     http://%s:%d/token.json' % (ip, args.port))
    print('')
    print('  ⚠️ 首次运行如弹防火墙提示请选「允许」；PC 需保持开机 + 同一 Wi-Fi。')
    print('  Ctrl+C 结束共享。')
    print('=' * 62)

    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map = {'.json': 'application/json', '.txt': 'text/plain'}
    os.chdir(SHARE_DIR)

    class Srv(socketserver.ThreadingTCPServer):
        allow_reuse_address = True

    with Srv(('0.0.0.0', args.port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n已停止共享。')


if __name__ == '__main__':
    main()

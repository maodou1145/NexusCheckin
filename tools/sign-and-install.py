#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sign-and-install.py —— 给 NexusCheckin 做「本地签名 + 装机到模拟器/真机」

════════════════════════════════════════════════════════════════════════
为什么需要它（2026-09-26 血亏实证）
════════════════════════════════════════════════════════════════════════
hvigor 构建出的 HAP **是未签名的**（build-profile.json5 里 signingConfigs 为空），
`hdc install` 会报 `install parse no profile`。

- 🔴 **lite HAP（entry-default-lite-unsigned.hap）用本工具签不出来**：
  它是「单 .bin 压缩包」，签名要走 hvigor 内部两步
  （LegacySignLiteBin 签 .bin → SignHap 签包），而 hvigor 的 signingConfigs
  要求 **DevEco 加密过的密码**（明文会报 "length ... less than 32"）——
  CLI 无法提供，只能靠 DevEco Studio 里 Run。
- ✅ **标准 HAP（entry-default-unsigned.hap）可以**：它是正常多条目 HAP
  （assets/js/**/*.abc + resources + rawfile），用 SDK 自带的
  `hap-sign-tool.jar` + `OpenHarmony.p12` 就能本地自签。
  ⚠️ 所以：**本工具只用于「富引擎（rich wearable）模拟器」验证 UI/布局**；
     真机（Lite Wearable）请走 DevEco 的自动签名。

用法：
    python tools/sign-and-install.py                 # 签名 + 安装 + 启动
    python tools/sign-and-install.py --no-install    # 只签名
    python tools/sign-and-install.py --device 127.0.0.1:5555
"""
import io, os, re, sys, json, glob, shutil, subprocess

HOME = os.path.expanduser('~').replace('\\', '/')
SDK_LIB_CANDS = [
    r'D:/OpenHaymony_SDK_6.1.1/10/toolchains/lib',
    r'D:/OpenHaymony_SDK_6.1.1/9/toolchains/lib',
    HOME + '/AppData/Local/Huawei/Sdk/10/toolchains/lib',
]
JAVA_CANDS = [
    r'D:/Devceo Studio 6.1.1/DevEco Studio/jbr/bin/java.exe',
    r'E:/DevEco Studio/jbr/bin/java.exe',
    HOME + '/AppData/Local/Huawei/DevEcoStudio6.1/jbr/bin/java.exe',
]
HDC_CANDS = [
    r'D:/OpenHaymony_SDK_6.1.1/10/toolchains/hdc.exe',
    r'D:/OpenHaymony_SDK_6.1.1/9/toolchains/hdc.exe',
]
KEYTOOL = 'keytool.exe'          # 与 java 同目录

PROJ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
WORK = os.path.join(PROJ, 'tools', '.sign')
# 构建产物默认在 H 盘构建区（G 盘是源码真源，不在这里构建）
REL = os.path.join('entry', 'build', 'default', 'outputs', 'default')
HAP_DIR_CANDS = [
    r'H:/NexusCheckin/' + REL,
    os.path.join(PROJ, REL),
]
HAP_DIR = next((d for d in HAP_DIR_CANDS if os.path.isdir(d)), HAP_DIR_CANDS[0])
STD_HAP = os.path.join(HAP_DIR, 'entry-default-unsigned.hap')
OUT_HAP = os.path.join(HAP_DIR, 'entry-default-signed.hap')
BUNDLE = 'com.example.nexuscheckin'
KEY_ALIAS = 'nexus-app-key'
PWD = '123456'


def first(cands, what):
    for p in cands:
        if os.path.exists(p):
            return p
    sys.exit('找不到 %s（可改脚本顶部候选）' % what)


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', **kw)


def make_material(java, lib):
    """生成（或复用）自签材料：应用密钥对 + 由 SDK CA 签发的证书链 + debug profile。"""
    os.makedirs(WORK, exist_ok=True)
    app_cer = os.path.join(WORK, 'app.cer')
    profile = os.path.join(WORK, 'profile.p7b')
    keystore = os.path.join(WORK, 'app.p12')
    if all(os.path.exists(p) for p in (app_cer, profile, keystore)):
        return app_cer, profile, keystore

    sign_tool = os.path.join(lib, 'hap-sign-tool.jar')
    oh_p12 = os.path.join(lib, 'OpenHarmony.p12')
    keytool = os.path.join(os.path.dirname(java), KEYTOOL)

    # 1) 导出 SDK 的 CA 证书（做链用）
    for alias, out in [('openharmony application ca', 'ca.cer'),
                       ('openharmony application root ca', 'root.cer')]:
        run([keytool, '-exportcert', '-alias', alias, '-keystore', oh_p12,
             '-storepass', PWD, '-rfc', '-file', os.path.join(WORK, out)])

    # 2) 新应用密钥对 + 证书链
    r = run([java, '-jar', sign_tool, 'generate-keypair', '-keyAlias', KEY_ALIAS,
             '-keyAlg', 'ECC', '-keySize', 'NIST-P-256',
             '-keystoreFile', keystore, '-keyPwd', PWD, '-keystorePwd', PWD])
    if 'success' not in (r.stdout or ''):
        sys.exit('generate-keypair 失败：%s' % (r.stdout or r.stderr))
    r = run([java, '-jar', sign_tool, 'generate-app-cert', '-keyAlias', KEY_ALIAS,
             '-keyPwd', PWD,
             '-issuer', 'C=CN,O=OpenHarmony,OU=OpenHarmony Team,CN=OpenHarmony Application CA',
             '-issuerKeyAlias', 'openharmony application ca', '-issuerKeyPwd', PWD,
             '-subject', 'C=CN,O=OpenHarmony,OU=OpenHarmony Team,CN=NexusCheckin Debug',
             '-signAlg', 'SHA384withECDSA',
             '-keystoreFile', keystore, '-keystorePwd', PWD,
             '-issuerKeystoreFile', oh_p12, '-issuerKeystorePwd', PWD,
             '-outForm', 'certChain',
             '-rootCaCertFile', os.path.join(WORK, 'root.cer'),
             '-subCaCertFile', os.path.join(WORK, 'ca.cer'),
             '-outFile', app_cer])
    if 'success' not in (r.stdout or ''):
        sys.exit('generate-app-cert 失败：%s' % (r.stdout or r.stderr))

    # 3) profile：bundle 名 + 设备 UDID + 开发证书（取链里的叶子）
    udid = get_udid()
    leaf = re.search(r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----',
                     io.open(app_cer, encoding='utf-8').read(), re.S).group(0).strip()
    t = json.load(io.open(os.path.join(lib, 'UnsgnedDebugProfileTemplate.json'), encoding='utf-8'))
    t['bundle-info']['bundle-name'] = BUNDLE
    t['bundle-info']['development-certificate'] = leaf + '\n'
    t['validity'] = {'not-before': 1700000000, 'not-after': 2000000000}
    t['debug-info'] = {'device-ids': [udid], 'device-id-type': 'udid'}
    pj = os.path.join(WORK, 'profile.json')
    io.open(pj, 'w', encoding='utf-8').write(json.dumps(t, ensure_ascii=False, indent=2))

    r = run([java, '-jar', sign_tool, 'sign-profile',
             '-keyAlias', 'openharmony application profile release',
             '-signAlg', 'SHA256withECDSA', '-mode', 'localSign',
             '-profileCertFile', os.path.join(lib, 'OpenHarmonyProfileRelease.pem'),
             '-inFile', pj, '-keystoreFile', oh_p12, '-outFile', profile,
             '-keyPwd', PWD, '-keystorePwd', PWD])
    if 'success' not in (r.stdout or ''):
        sys.exit('sign-profile 失败：%s' % (r.stdout or r.stderr))
    return app_cer, profile, keystore


def get_udid(device=None):
    hdc = first(HDC_CANDS, 'hdc.exe')
    cmd = [hdc] + (['-t', device] if device else []) + ['shell', 'bm', 'get', '-u']
    r = run(cmd)
    m = re.search(r'([0-9A-Fa-f]{64})', (r.stdout or '') + (r.stderr or ''))
    return m.group(1) if m else ''


def main():
    no_install = '--no-install' in sys.argv
    device = None
    if '--device' in sys.argv:
        device = sys.argv[sys.argv.index('--device') + 1]

    java = first(JAVA_CANDS, 'java.exe')
    lib = first(SDK_LIB_CANDS, 'SDK toolchains/lib')
    if not os.path.exists(STD_HAP):
        sys.exit('找不到标准 HAP：%s\n请先跑 hvigorw assembleHap --mode module' % STD_HAP)

    app_cer, profile, keystore = make_material(java, lib)
    r = run([java, '-jar', os.path.join(lib, 'hap-sign-tool.jar'), 'sign-app',
             '-keyAlias', KEY_ALIAS, '-signAlg', 'SHA256withECDSA', '-mode', 'localSign',
             '-appCertFile', app_cer, '-profileFile', profile,
             '-inFile', STD_HAP, '-outFile', OUT_HAP,
             '-keystoreFile', keystore, '-keyPwd', PWD, '-keystorePwd', PWD])
    if 'Sign successfully' not in (r.stdout or ''):
        sys.exit('sign-app 失败：%s' % (r.stdout or r.stderr))
    print('[OK] 已签名：%s' % OUT_HAP)

    if no_install:
        return
    hdc = first(HDC_CANDS, 'hdc.exe')
    base = [hdc] + (['-t', device] if device else [])
    # ⚠️ hdc 是 Windows 程序，Git Bash 会把 'H:/...' 当相对路径搞坏 → cd 到产物目录用文件名
    r = run(base + ['install', '-r', os.path.basename(OUT_HAP)], cwd=HAP_DIR)
    out = (r.stdout or '') + (r.stderr or '')
    print(('[OK] 安装成功' if 'successfully' in out else '[FAIL] 安装失败：') + out.strip()[-200:])
    if 'successfully' in out:
        # ability 名以设备实际注册的为准（本工程实测 = com.example.myapplication.MainAbility，
        # 与 config.json 的 ".MainAbility" 不一致 —— 逐个候选试）
        for ab in (BUNDLE + '.MainAbility', 'com.example.myapplication.MainAbility', 'MainAbility'):
            r2 = run(base + ['shell', 'aa', 'start', '-b', BUNDLE, '-a', ab])
            o2 = ((r2.stdout or '') + (r2.stderr or '')).strip()
            print('[i] 启动 %s -> %s' % (ab, o2.splitlines()[-1][:70] if o2 else '(无输出)'))
            if 'successfully' in o2:
                break


if __name__ == '__main__':
    main()

#!/usr/bin/env node
/*
 * pack-for-user.js —— A 方案「定制打包」流水线
 * ===========================================================================
 * 你的流程是：用户私聊把 token 发给你 → 你出一份绑好他账号的手表应用。
 * 本脚本把「收到 token 之后」这一段全自动化，专治三种翻车：
 *   ① token 抄错 / 已过期 → 打包前先联网验证，无效就不打包（白打包最浪费时间）
 *   ② 手改源码把 token 留在工程里 → 本脚本只改「副本」，源工程永远干净
 *   ③ 用户多了分不清谁是谁 → 每份副本独立目录 + 目录里带「打包信息.txt」
 *
 * 用法
 *   node tools/pack-for-user.js <token> [昵称]
 *   node tools/pack-for-user.js --file 用户列表.txt        # 批量，每行「昵称,token」
 *   node tools/pack-for-user.js <token> [昵称] --no-verify # 跳过联网校验（离线时用）
 *   node tools/pack-for-user.js <token> [昵称] --force     # token 校验失败也强行打包
 *
 * 用户列表.txt 每行支持：
 *   毛豆,eyJhbGciOi...
 *   毛豆 eyJhbGciOi...
 *   eyJhbGciOi...            （没有昵称也行，会自动用序号命名）
 *   # 开头的行是注释，会被跳过
 *
 * 产出
 *   dist/<昵称>_<时间戳>/            一份可以直接用 DevEco 打开构建的完整工程
 *   dist/<昵称>_<时间戳>/打包信息.txt  谁、什么时候、token 尾号、校验结果
 * ===========================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const API = 'https://ws.fseatech.cn/api';

/* 复制工程时要跳过的目录/文件（构建产物、缓存、临时文件） */
const SKIP = new Set([
  'dist', 'build', '.hvigor', '.idea', '.cache', '.appanalyzer',
  'node_modules', 'oh_modules', 'tools', '.git',
]);
const SKIP_EXT = new Set(['.hap', '.app', '.log']);

/* ── 命令行解析 ─────────────────────────────────────────────── */
function parseArgs(argv) {
  const opts = { token: '', name: '', file: '', verify: true, force: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-verify') { opts.verify = false; }
    else if (a === '--force') { opts.force = true; }
    else if (a === '--file') { opts.file = argv[++i] || ''; }
    else { rest.push(a); }
  }
  if (opts.file) { return opts; }
  opts.token = rest[0] || '';
  opts.name = rest.slice(1).join(' ') || '';
  return opts;
}

/* ── 工具函数 ───────────────────────────────────────────────── */
function safeName(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 24) || 'user';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function escapeJsString(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '');
}

/* ── ① token 校验：连上服务器读 /points/info ─────────────────── */
async function verifyToken(token) {
  const res = await fetch(API + '/points/info', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer ' + token,
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* 保留原文 */ }
  if (!json) { return { ok: false, why: `HTTP ${res.status}，响应不是 JSON：${text.slice(0, 120)}` }; }
  if (json.code === 0) {
    const d = json.data || {};
    return {
      ok: true,
      why: '有效',
      summary: `积分 ${d.points} / 连签 ${d.consecutiveDays} 天 / 今日${d.checkedInToday ? '已' : '未'}签到`,
    };
  }
  return { ok: false, why: `${json.message || '未知错误'}（code ${json.code}）` };
}

/* ── ② 复制工程（跳过构建产物）───────────────────────────────
 * 注意：不能直接 cpSync(ROOT, destDir) —— Node 会拒绝「把目录复制到自己的子目录里」
 * （ERR_FS_CP_EINVAL: Cannot copy ... to a subdirectory of self）。
 * 所以改成「逐个复制 ROOT 下的一级条目」，顺带在顶层就把 dist / build / tools 之类挡掉。
 */
function copyProject(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const shouldSkip = (fullPath) => {
    const rel = path.relative(ROOT, fullPath);
    if (!rel) { return false; }
    const parts = rel.split(path.sep);
    for (const p of parts) {
      if (SKIP.has(p)) { return true; }
    }
    return SKIP_EXT.has(path.extname(fullPath).toLowerCase());
  };

  for (const name of fs.readdirSync(ROOT)) {
    const src = path.join(ROOT, name);
    if (shouldSkip(src)) { continue; }
    fs.cpSync(src, path.join(destDir, name), {
      recursive: true,
      filter: (s) => !shouldSkip(s),
    });
  }
}

/* ── ③ 往副本里注入 token / 昵称 ────────────────────────────── */
function injectToken(destDir, token, owner) {
  const file = path.join(destDir, 'entry/src/main/js/MainAbility/pages/index/index.js');
  if (!fs.existsSync(file)) { throw new Error('找不到 index.js：' + file); }
  let src = fs.readFileSync(file, 'utf8');

  const before = src;
  src = src.replace(
    /^([ \t]*TOKEN:[ \t]*)('[^']*'|"[^"]*")([ \t]*,[ \t]*\/\/[ \t]*<<<[ \t]*PACK-TOKEN)/m,
    (_m, p1, _p2, p3) => p1 + "'" + escapeJsString(token) + "'" + p3
  );
  src = src.replace(
    /^([ \t]*OWNER:[ \t]*)('[^']*'|"[^"]*")([ \t]*,[ \t]*\/\/[ \t]*<<<[ \t]*PACK-OWNER)/m,
    (_m, p1, _p2, p3) => p1 + "'" + escapeJsString(owner || '') + "'" + p3
  );

  if (src === before) {
    throw new Error('注入失败：没找到 <<< PACK-TOKEN / <<< PACK-OWNER 标记行（index.js 是否被改过？）');
  }
  fs.writeFileSync(file, src, 'utf8');
}

/* ── ④ 写打包信息 ───────────────────────────────────────────── */
function writeInfo(destDir, entry) {
  const lines = [
    '本目录由 tools/pack-for-user.js 自动生成，可直接用 DevEco Studio 打开构建。',
    '',
    '用户昵称   ：' + (entry.name || '（未提供）'),
    '生成时间   ：' + new Date().toLocaleString('zh-CN'),
    'Token 尾号 ：' + entry.token.slice(-6),
    'Token 长度 ：' + entry.token.length + ' 字符',
    '接口校验   ：' + entry.verify,
    '',
    '注意：本目录内含真实 Token，等于该用户的账号钥匙 —— 不要上传到网盘/代码仓库，',
    '      打包完就删掉，或至少不要外传。',
    '',
  ];
  fs.writeFileSync(path.join(destDir, '打包信息.txt'), lines.join('\r\n'), 'utf8');
}

/* ── 主流程 ─────────────────────────────────────────────────── */
async function packOne(token, name, opts, index, total) {
  const label = `[${index}/${total}] ${name || '（未命名）'}`;
  console.log('\n' + label);
  console.log('  token 长度 ' + token.length + '，尾号 ...' + token.slice(-6));

  let verifyText = '未校验（--no-verify）';
  if (opts.verify) {
    process.stdout.write('  正在验证 token ... ');
    try {
      const r = await verifyToken(token);
      if (r.ok) {
        verifyText = '有效 · ' + r.summary;
        console.log('✅ 有效');
        console.log('    ' + r.summary);
      } else {
        verifyText = '无效 · ' + r.why;
        console.log('❌ 无效：' + r.why);
        if (!opts.force) {
          console.log('  → 已跳过打包。确认 token 没抄错、没过期后重试；（或加 --force 强行打包）');
          return false;
        }
        console.log('  → --force 指定，继续打包。');
      }
    } catch (e) {
      verifyText = '校验失败（网络问题）· ' + (e && e.message ? e.message : e);
      console.log('⚠️ 网络校验失败：' + verifyText);
      if (!opts.force) {
        console.log('  → 已跳过打包。断网时可用 --no-verify 跳过校验。');
        return false;
      }
    }
  }

  const dirName = safeName(name) + '_' + stamp();
  const destDir = path.join(DIST, dirName);
  if (fs.existsSync(destDir)) {
    throw new Error('目标目录已存在，请稍后重试：' + destDir);
  }

  process.stdout.write('  复制工程 ... ');
  fs.mkdirSync(DIST, { recursive: true });
  copyProject(destDir);
  console.log('OK');

  process.stdout.write('  注入 token / 昵称 ... ');
  injectToken(destDir, token, name);
  console.log('OK');

  writeInfo(destDir, { name, token, verify: verifyText });

  console.log('  ✅ 完成 → ' + destDir);
  entryResults.push({ name, ok: true, dir: destDir });
  return true;
}

const entryResults = [];

(async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(path.join(ROOT, 'entry/src/main/config.json'))) {
    console.error('请在 NexusCheckin 工程根目录下运行本脚本（找不到 entry/src/main/config.json）。');
    process.exit(1);
  }

  console.log('==============================================');
  console.log(' NexusCheckin · 定制打包（A 方案）');
  console.log('  源工程：' + ROOT);
  console.log('  产出到：' + DIST);
  console.log('==============================================');

  const tasks = [];
  if (opts.file) {
    const listFile = path.resolve(process.cwd(), opts.file);
    if (!fs.existsSync(listFile)) {
      console.error('找不到列表文件：' + listFile);
      process.exit(1);
    }
    const lines = fs.readFileSync(listFile, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) { continue; }
      const idx = line.search(/[,\s\t]/);
      if (idx === -1) { tasks.push({ token: line, name: '' }); }
      else { tasks.push({ name: line.slice(0, idx).trim(), token: line.slice(idx + 1).trim() }); }
    }
    if (!tasks.length) {
      console.error('列表文件里没有有效内容（每行应形如「昵称,token」）。');
      process.exit(1);
    }
  } else {
    if (!opts.token) {
      console.error('用法：');
      console.error('  node tools/pack-for-user.js <token> [昵称]');
      console.error('  node tools/pack-for-user.js --file 用户列表.txt');
      process.exit(1);
    }
    tasks.push({ token: opts.token, name: opts.name });
  }

  for (let i = 0; i < tasks.length; i++) {
    try {
      await packOne(tasks[i].token, tasks[i].name, opts, i + 1, tasks.length);
    } catch (e) {
      console.log('  ❌ 出错跳过：' + (e && e.message ? e.message : e));
      entryResults.push({ name: tasks[i].name, ok: false, dir: '' });
    }
  }

  const okList = entryResults.filter((r) => r.ok);
  console.log('\n==============================================');
  console.log(` 完成 ${okList.length} / ${tasks.length} 份`);
  okList.forEach((r) => console.log('  ✅ ' + r.dir));
  entryResults.filter((r) => !r.ok).forEach((r) => console.log('  ❌ ' + (r.name || '（未命名）')));
  if (okList.length) {
    console.log('\n 下一步（每份都要做一遍）：');
    console.log('   1) 用 DevEco Studio 打开上面那份 dist\\... 目录');
    console.log('   2) 先配好签名（File → Project Structure → Signing Configs）');
    console.log('   3) Build → Build Hap(s) / Build App(s)');
    console.log('   4) 把 hap 私聊发给对应用户，然后删掉该 dist 目录（里面有他的 token）');
  }
  console.log('==============================================');
})().catch((e) => {
  console.error('\n执行失败：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});

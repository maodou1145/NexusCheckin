#!/usr/bin/env node
/*
 * 接口自测脚本（PC 端 Node，18+ 自带 fetch）
 * ---------------------------------------------------------------------------
 * 作用：在打包到手表之前，先用你的 token 在电脑上验证
 *       /points/info、/points/checkin、/points/lucky-wheel/spin 三个接口是否通，
 *       以及 CSRF 双提交写法是否正确。通了再上手表，能省掉大量真机瞎试。
 *
 * 用法：
 *   node tools/check-api.js <TOKEN>            # 只读状态
 *   node tools/check-api.js <TOKEN> --checkin  # 顺带执行一次签到
 *   node tools/check-api.js <TOKEN> --spin     # 顺带执行一次转盘
 *
 * TOKEN 获取：浏览器登录 https://ws.fseatech.cn 后 F12 →
 *             Application → Local Storage → https://ws.fseatech.cn → token
 */

const ORIGIN = process.env.NEXUS_ORIGIN || 'https://ws.fseatech.cn';
const API = ORIGIN + '/api';
// 任意 32 位十六进制即可：服务端只校验 Cookie 与 X-CSRF-Token 两值相同
const CSRF = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

const token = process.argv[2];
const flags = process.argv.slice(3);
if (!token) {
  console.error('用法: node tools/check-api.js <TOKEN> [--checkin] [--spin]');
  process.exit(1);
}

async function call(method, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: 'Bearer ' + token,
  };
  if (method === 'POST') {
    headers['X-CSRF-Token'] = CSRF;
    headers['Cookie'] = 'csrf_token=' + CSRF;
  }
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* 保留原文 */ }
  console.log('%s %s%s -> HTTP %d', method, path, json ? '' : ' [非 JSON]', res.status);
  console.log('   ', json ? JSON.stringify(json) : text);
  return json;
}

(async () => {
  console.log('目标:', API);
  await call('GET', '/points/info');
  if (flags.includes('--checkin')) {
    await call('POST', '/points/checkin');
    await call('GET', '/points/info');
  }
  if (flags.includes('--spin')) {
    await call('POST', '/points/lucky-wheel/spin');
    await call('GET', '/points/info');
  }
})().catch((e) => {
  console.error('执行失败:', e && e.message ? e.message : e);
  process.exit(2);
});

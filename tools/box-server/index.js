'use strict';
/*
 * nxbox —— 「取件码信箱」云函数（uniCloud 普通云函数，需在控制台做「云函数 URL 化」）
 *
 * 用途：用户在浏览器把 NexusCheckin 的 Token 投递到这里 → 得到 4 位取件码 →
 *      手表输入取件码即可取回 Token。一次性、10 分钟有效、取后即删、最多试 5 次。
 *
 * 接口（URL 化路径建议配 /nxbox）：
 *   POST {域名}/nxbox/put      body: {"token":"eyJ..."}  → {"ok":true,"code":"8231","ttl":600}
 *   GET  {域名}/nxbox/get?code=8231                      → {"ok":true,"token":"eyJ..."}
 *                                                          / {"ok":false,"msg":"..."}
 *   OPTIONS 预检已处理，响应带 CORS 头，允许网页直接调用。
 *
 * 部署要点：
 *   1) 控制台新建云函数，名称 nxbox，把本文件内容整段粘进 index.js
 *   2) 云数据库新建集合 nx_box（阿里云不建也会自动创建，但建议手动建，权限选「仅创建者可读写」）
 *   3) 云函数详情 → 配置 URL 化路径：/nxbox
 *   4) 记下访问域名，填进：手表端 CONFIG.BOX_API 与页面 box-web/index.html 的 BOX_API
 */

const TTL = 600;        // 取件码有效期（秒）
const MAX_TRIES = 5;    // 同一个码最多被尝试几次（防爆破）
const COL = 'nx_box';   // 云数据库集合名

function resp(payload, status) {
  return {
    mpserverlessComposedResponse: true,   // 集成响应：自定义状态码 / 响应头
    isBase64Encoded: false,
    statusCode: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(payload)
  };
}

exports.main = async (event) => {
  const db = uniCloud.database();
  const col = db.collection(COL);
  const method = String(event.httpMethod || 'GET').toUpperCase();
  const path = String(event.path || '/');
  const q = event.queryStringParameters || {};

  if (method === 'OPTIONS') { return resp({ ok: true }); }

  /* 顺手清理过期记录（量很小，失败也不影响主流程） */
  try {
    await col.where({ expireAt: db.command.lt(Date.now()) }).remove();
  } catch (e) {}

  /* ── 投递：生成 4 位取件码 ── */
  if (method === 'POST' && path.indexOf('/put') === 0) {
    let body = event.body || '';
    if (event.isBase64Encoded) { body = Buffer.from(body, 'base64').toString('utf8'); }
    let token = '';
    try { token = String((JSON.parse(body) || {}).token || ''); } catch (e) { token = ''; }
    token = token.trim();
    if (token.length < 20 || token.length > 4096) {
      return resp({ ok: false, msg: 'Token 格式不对（长度异常）' });
    }
    let code = '';
    for (let i = 0; i < 20; i++) {
      const c = String(Math.floor(1000 + Math.random() * 9000));
      const dup = await col.where({ code: c }).limit(1).get();
      if (!dup.data || !dup.data.length) { code = c; break; }
    }
    if (!code) { return resp({ ok: false, msg: '服务器繁忙，请稍后再试' }); }
    await col.add({
      code: code,
      token: token,
      tries: 0,
      expireAt: Date.now() + TTL * 1000,
      createdAt: Date.now()
    });
    return resp({ ok: true, code: code, ttl: TTL });
  }

  /* ── 取件：一次性取回 Token ── */
  if (method === 'GET' && path.indexOf('/get') === 0) {
    const code = String(q.code || '').trim();
    if (!/^[0-9]{4}$/.test(code)) { return resp({ ok: false, msg: '取件码是 4 位数字' }); }
    const res = await col.where({ code: code }).limit(1).get();
    const doc = (res.data && res.data[0]) || null;
    if (!doc) { return resp({ ok: false, msg: '取件码不存在或已被使用' }); }
    if (Date.now() > doc.expireAt) {
      await col.doc(doc._id).remove();
      return resp({ ok: false, msg: '取件码已过期，请重新生成' });
    }
    if ((doc.tries || 0) >= MAX_TRIES) {
      await col.doc(doc._id).remove();
      return resp({ ok: false, msg: '尝试次数过多，请重新生成' });
    }
    const token = doc.token;
    await col.doc(doc._id).remove();   // 一次性：取到即删
    return resp({ ok: true, token: token });
  }

  return resp({ ok: false, msg: '未知接口' }, 404);
};

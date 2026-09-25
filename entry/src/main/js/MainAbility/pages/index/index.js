/*
 * Nexus 签到（Lite Wearable / API 10 / JS FA）
 * 六屏：签到+转盘 / 每日一句 / 应用推荐 / 购买应用 / 我的订单 / 我的
 * 铁律：① 零正则（JerryScript 不支持→整页黑屏）② 事件必须裸名 onclick
 *       ③ swiper 内不能放 list ④ 金额只在内部计价，界面只显示积分
 * 详见 README.md（含接口清单/踩坑记录/设备实测方法）。
 */

/* ─────────────────────────── 配置 ─────────────────────────── */
var CONFIG = {
  // 站点根地址。真机若 https 握手失败，可改 'http://ws.fseatech.cn' 再试（详见 README「风险」）。
  ORIGIN: 'https://ws.fseatech.cn',

  // ★★★ Token 的存放位置：internal://app/nx_token.txt ★★★
  // 打包前由 tools/pack-for-user.bat 自动改写下面两行（保留行尾标记注释，别删）。
  TOKEN: '',                        // <<< PACK-TOKEN
  OWNER: '',                        // <<< PACK-OWNER

  // 不要改：CSRF 值任意 32 位小写十六进制、固定即可，服务端只校验 cookie 与请求头相等
  CSRF: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',

  // 名句接口（公开、免费、纯文本，lite 上可行）
  QUOTE_API: 'https://v1.hitokoto.cn/?min_length=8&max_length=26',

};

var API_BASE = CONFIG.ORIGIN + '/api';
var FILE_TOKEN = 'internal://app/nx_token.txt';
var FILE_AVATAR = 'internal://app/nx_avatar.jpg';

/* 各屏编号（onSwiperChange 分派用） */
var P_MAIN = 0;      /* 每日签到 + 幸运大转盘 */
var P_QUOTE = 1;     /* 每日一句 */
var P_REC = 2;       /* 应用推荐 */
var P_BUY = 3;       /* 购买应用（积分兑换） */
var P_ORDER = 4;     /* 我的订单 */
var P_MINE = 5;      /* 我的 */
var PAGE_TOTAL = 6;

var RESULT_MAX = 46;

/* 自研键盘：4 页 × 20 键（5 列 × 4 行）。JWT(base64url) 字符集 = A-Za-z0-9 - _ .
 * 页0 大写A-T / 页1 大写U-Z+数字+符号 / 页2 小写a-t / 页3 小写u-z+数字+符号。
 * 不足 20 键的页用空串补位（charAt 越界返回空串），空键点击无效果。 */
var KB_PAGES = [
  'ABCDEFGHIJKLMNOPQRST',
  'UVWXYZ0123456789-_.',
  'abcdefghijklmnopqrst',
  'uvwxyz0123456789-_.'
];   /* 结果文本长度上限，防 lite text 溢出 */

/* ─────────────────────────── 小工具 ─────────────────────────── */
function fmt(v) {
  if (v === null || v === undefined || v === '') {
    return '-';
  }
  return String(v);
}

function clamp(s, n) {
  var t = String(s === null || s === undefined ? '' : s);
  if (t.length > n) {
    return t.substring(0, n - 1) + '…';
  }
  return t;
}

/* 从对象里按候选键顺序取第一个存在的值 */
function pick(obj, keys) {
  if (!obj) {
    return null;
  }
  for (var i = 0; i < keys.length; i++) {
    var v = obj[keys[i]];
    if (v !== undefined && v !== null && v !== '') {
      return v;
    }
  }
  return null;
}

/* 下载量 12345 → 1.2万 */
function humanNum(v) {
  var n = Number(v);
  if (!n && n !== 0) {
    return fmt(v);
  }
  if (n >= 10000) {
    return (Math.round(n / 1000) / 10) + '万';
  }
  return String(n);
}

/* 去掉 \r \n \t 和空格。
 * 🔴 【绝对不能用正则，否则整页黑屏】
 * lite 引擎是裁剪版 JerryScript，其编译 profile **不支持正则表达式字面量**。
 * 实测（SDK 自带 jerry.exe，即真机同一套引擎）：
 *     Script Error: SyntaxError: Regexp is not supported in the selected profile.
 * 后果链条：正则 → 页面 JS 求值失败 → rootComponent 为 undefined
 *          → 引擎打印 `Nothing to render as it is undefined` → **整页黑屏**。
 * 而且 ace-loader / hvigor **两条编译链都不报**（它们用 V8 解析）。
 * 所以这里用 charCodeAt 逐字符判断，纯 ES5 实现。 */
function stripWs(s) {
  var t = String(s === null || s === undefined ? '' : s);
  var out = '';
  for (var i = 0; i < t.length; i++) {
    var c = t.charCodeAt(i);
    if (c === 13 || c === 10 || c === 9 || c === 32) {
      continue;
    }
    out += t.charAt(i);
  }
  return out;
}

export default {
  data: {
    /* ---- 页面框架 ---- */
    curIdx: 0,
    pageText: '1/6',
    /* swiper 的 index 绑定它。⚠️ 只在「初始化 / 从键盘返回」时设一次，
     *   滑动时 onSwiperChange 不回写 → 避免 index 与滑动互相打架（回声）。 */
    swiperIdx: 0,
    /* 当前屏标记：HML 里用 if="{{pN}}" 切换屏外的那一组按钮。
     * ⚠️ 不用 === 数值比较（lite 上无先例），一律用布尔字段。 */
    p0: true,
    p1: false,
    p2: false,
    p3: false,
    p4: false,
    p5: false,

    /* ---- 屏幕尺寸（onInit 里用 @system.device 读，读到后覆盖）
     * 圆表 466×466、方表 408×480 —— 原先是按 466 写死的固定值，方表上会溢出。
     * ⚠️ 值里**自带单位**，HML 写 style="width: {{screenW}};" 整串替换即可。
     *    绝不能写 style="width: {{w}}px" —— 技能库实证：字符串内嵌 {{}} 会真机渲染异常（黑屏隐患）。 */
    screenW: '466px',
    screenH: '466px',
    swiperW: '466px',
    swiperH: '406px',
    swiperTop: '34px',
    pagebarLeft: '133px',

    /* ---- 屏1 顶部：头像 + 问候语 ---- */
    /* 未登录用内置默认头像、名字显示「用户」 */
    avatarSrc: '/common/avatar/default.png',
    greetText: '用户，你好！',

    /* ---- 屏1 签到 + 转盘 ---- */
    checkinInfo: '读取中…',
    checkinBtn: '立即签到',
    checkinResult: '点按下方按钮签到',
    spinInfo: '签到后可抽奖',
    spinBtn: '开始抽奖',
    spinResult: '点按下方按钮抽奖',

    /* ---- 屏2 每日一句 ---- */
    quoteText: '正在获取…',
    quoteFrom: '',

    /* ---- 屏3 应用推荐 ---- */
    r1n: '加载中…', r1m: '',
    r2n: '', r2m: '',
    r3n: '', r3m: '',
    /* 应用图标（先内置默认图；接口里 icon 下载成功才替换） */

    /* ---- 屏4 购买应用（积分兑换） ---- */
    /* 应用从「应用推荐」同一份列表里选（buyIdx 指向哪就买哪个），
     * 价格/所需积分直接用列表自带字段（redeem_points_cost），不用额外请求 */
    buyName: '读取中…',
    buyInfo: '',
    buyDesc: '',
    buyMeta: '',
    buyPoints: '',
    buyBtn: '积分兑换',
    buyResult: '选好应用后点下面按钮',

    /* ---- 屏5 我的订单 ---- */
    o1n: '加载中…', o1s: '',
    o2n: '', o2s: '',
    o3n: '', o3s: '',
    orderInfo: '',

    /* ---- 屏6 我的 ---- */
    myNick: '未登录',
    myLevel: '-',
    myExp: '-',
    myPoints: '-',
    myToken: '未绑定',

    /* ---- 视图切换（页内切换；lite 路由 replaceUrl 会重建页面丢状态，所以不用路由） ----
     * 主界面 swiper 常驻；更多应用/订单详情拆到独立页 pages/store（lite 单页体积上限） */

    /* ---- 按压反馈：全局轻提示 ---- */
    toastText: '',
    toastShow: false,
    toastTop: '402px',
    toastW: '466px',

    /* ---- 内部状态（不参与渲染） ---- */
    token: '',
    points: 0,
    busy: false,
    loadedQuote: false,
    loadedRec: false,
    loadedUser: false,
    loadedOrders: false,
    loadedPurchased: false,
    orders: [],
    purchased: [],
    orderPage: 0,
    recPage: 0,
    /* 应用推荐原始列表（购买屏从这里面选）与当前选中下标 */
    recList: [],
    /* /app/list 全量原始数据（过滤前），deviceModel 就绪后重算 recList */
    allApps: [],
    deviceModel: '',
    buyIdx: 0,
    /* 下单要用的默认设备（/device/list 里 isDefault 的那台） */
    deviceId: 0,
    deviceName: '',
    /* 已购应用的 id 集合（判断「已拥有」用） */
    ownedIds: [],
    /* 「再点一次确认」状态：涉及花积分，必须两段确认 */
    buyConfirm: false,
    buying: false
  },

  /* ───────────────── 生命周期 ───────────────── */

  onInit: function () {
    this.fetchApi = null;
    this.fileApi = null;
    this.vibratorApi = null;
    this.toastTimer = null;
    this.busy = false;
    this.loadedQuote = false;
    this.loadedRec = false;
    this.loadedUser = false;
    this.recPage = 0;
    /* 适配屏幕：读设备窗口尺寸 → 算容器级尺寸（圆表 466×466 / 方表 408×480 通吃）。
     * 读失败也没关系：data 里已按圆表给了默认值 */
    this.applyMetrics();
    /* 标题挂上定制打包时写入的用户名，让用户确认「这个包装的是我的账号」 */
    if (CONFIG.OWNER) {
      this.myNick = String(CONFIG.OWNER);
    }
    this.buildGreet();
  },

  onShow: function () {
    this.loadToken();
    this.refreshInfo();
  },

  /* ───────────────── 屏幕适配 ───────────────── */

  /* 读设备窗口尺寸 → 算容器级尺寸。
   * 圆表 466×466、方表 408×480；容器铺满屏幕、内容靠 flex 居中 → 一套布局通吃两种表。
   * ⚠️ 所有值都**先拼好单位**再赋给 data，HML 里整串替换（避免 {{x}}px 内嵌，那会渲染异常）。 */
  applyMetrics: function () {
    var that = this;
    var dev = null;
    try {
      dev = require('@system.device');
    } catch (e) {
      dev = null;
    }
    if (!dev || !dev.getInfo) {
      return;
    }
    try {
      dev.getInfo({
        success: function (d) {
          that.buildMetrics(d);
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  buildMetrics: function (d) {
    var w = 466;
    var h = 466;
    if (d) {
      if (d.windowWidth) { w = d.windowWidth; }
      if (d.windowHeight) { h = d.windowHeight; }
    }
    var sh = h - 60;          /* 顶部给页码留 30，底部留 30 余量 */
    if (sh < 300) { sh = 300; }
    this.screenW = w + 'px';
    this.screenH = h + 'px';
    this.swiperW = w + 'px';
    this.swiperH = sh + 'px';
    this.swiperTop = '30px';
    this.pagebarLeft = Math.round((w - 200) / 2) + 'px';
      this.toastTop = (h - 64) + 'px';
      this.toastW = w + 'px';
  },

  /* ───────────────── 原生模块懒加载 ───────────────── */

  ensureApi: function () {
    if (this.fetchApi) {
      return true;
    }
    try {
      this.fetchApi = require('@system.fetch');
    } catch (e) {
      this.fetchApi = null;
    }
    return !!this.fetchApi;
  },

  ensureFile: function () {
    if (this.fileApi) {
      return true;
    }
    try {
      this.fileApi = require('@system.file');
    } catch (e) {
      this.fileApi = null;
    }
    return !!this.fileApi;
  },

  /* ───────────────── 按压反馈：震动 + 轻提示 ───────────────── */

  /* 震动：@system.vibrator（螃蟹键盘真机验证过的写法） */
  ensureVibrator: function () {
    if (this.vibratorApi) {
      return true;
    }
    try {
      this.vibratorApi = require('@system.vibrator');
    } catch (e) {
      this.vibratorApi = null;
    }
    return !!this.vibratorApi;
  },

  vibrate: function () {
    if (!this.ensureVibrator()) {
      return;
    }
    try {
      this.vibratorApi.vibrate({ mode: 'short' });
    } catch (e) {
    }
  },

  /* 轻提示：底部浮出，约 1.5 秒后自动消失（setTimeout 失败则保留到下一次提示） */
  toast: function (msg) {
    var that = this;
    this.toastText = clamp(fmt(msg), 24);
    this.toastShow = true;
    try {
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
    } catch (e) {
    }
    try {
      this.toastTimer = setTimeout(function () {
        that.toastShow = false;
      }, 2500);
    } catch (e) {
    }
  },

  /* ───────────────── 网络封装（回调式） ───────────────── */

  /* ── 网络串行队列 ──
   * 真机 lite 并发多个 fetch 会卡死（模拟器无感）：所有请求排队，一次只发一个，
   * 上一个的成功/失败回调执行完才放行下一个；20s 看门狗防单请求挂死堵死队列。 */
  fetchQueued: function (options, onDone) {
    if (!this.q) { this.q = []; }
    if (!this.qRunning) { this.qRunning = false; }
    this.q.push({ options: options, onDone: onDone });
    this.pumpQueue();
  },

  pumpQueue: function () {
    if (this.qRunning) { return; }
    var item = this.q.shift();
    if (!item) { return; }
    var that = this;
    this.qRunning = true;
    var timer = null;
    var done = false;
    var finish = function () {
      if (done) { return; }
      done = true;
      try { clearTimeout(timer); } catch (e) { }
      that.qRunning = false;
      that.pumpQueue();
    };
    try { timer = setTimeout(finish, 20000); } catch (e) { finish(); }
    var okHandler = item.options.success;
    var failHandler = item.options.fail;
    item.options.success = function (res) {
      finish();
      if (okHandler) { okHandler(res); }
    };
    item.options.fail = function (res, code) {
      finish();
      if (failHandler) { failHandler(res, code); }
    };
    try {
      this.fetchApi.fetch(item.options);
    } catch (e) {
      finish();
      if (failHandler) { failHandler(null, -1); }
    }
  },

  request: function (method, path, body, cb) {
    if (!this.ensureApi()) {
      cb(false, '联网模块不可用(@system.fetch)');
      return;
    }
    var header = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (this.token) {
      header['Authorization'] = 'Bearer ' + this.token;
    }
    if (method === 'POST') {
      header['X-CSRF-Token'] = CONFIG.CSRF;
      header['Cookie'] = 'csrf_token=' + CONFIG.CSRF;
    }

    var options = {
      url: API_BASE + path,
      method: method,
      header: header,
      success: function (res) {
        var httpCode = res ? res.code : 0;
        var raw = res ? res.data : null;
        var obj = null;
        if (raw && typeof raw === 'object') {
          obj = raw;
        } else {
          try {
            obj = JSON.parse(String(raw));
          } catch (e) {
            obj = null;
          }
        }
        if (obj) {
          cb(true, obj);
        } else {
          cb(false, 'HTTP ' + httpCode + ' 响应无法解析');
        }
      },
      fail: function (res, code) {
        cb(false, '网络失败 code=' + code);
      }
    };
    if (body && method !== 'GET') {
      try {
        options.data = typeof body === 'string' ? body : JSON.stringify(body);
      } catch (e) {
      }
    }
    this.fetchQueued(options);
  },

  getJson: function (url, cb) {
    if (!this.ensureApi()) {
      cb(false, '联网模块不可用');
      return;
    }
    this.fetchQueued({
      url: url,
      method: 'GET',
      header: { 'Accept': 'application/json' },
        success: function (res) {
          var raw = res ? res.data : null;
          var obj = null;
          if (raw && typeof raw === 'object') {
            obj = raw;
          } else {
            try {
              obj = JSON.parse(String(raw));
            } catch (e) {
              obj = null;
            }
          }
          if (obj) {
            cb(true, obj);
          } else {
            cb(false, 'HTTP ' + (res ? res.code : 0));
          }
        },
      fail: function (res, code) {
        cb(false, '网络失败 code=' + code);
      }
    });
  },

  /* ───────────────── 必应每日壁纸 ───────────────── */

  /* 下载用户头像（user.avatar）→ internal://app/nx_avatar.jpg；失败保持内置默认头像 */

  /* 校验字节是不是真图片（长度+魔数）：arraybuffer 在部分运行时拿不到二进制，writeArrayBuffer 会写出 0 字节文件 */
  isImageBuffer: function (buf) {
    if (!buf) {
      return false;
    }
    var len = 0;
    if (typeof buf.byteLength === 'number') {
      len = buf.byteLength;
    } else if (typeof buf.length === 'number') {
      len = buf.length;
    }
    if (len < 512) {
      return false;   /* 真头像不可能小于 512 字节 */
    }
    var b = null;
    try {
      b = new Uint8Array(buf);
    } catch (e) {
      b = null;
    }
    if (!b || b.length < 8) {
      return true;    /* 取不到字节视图但长度够 → 放行（宁可信任长度，也不误杀） */
    }
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    if (b0 === 255 && b1 === 216 && b2 === 255) { return true; }            /* JPEG  FF D8 FF */
    if (b0 === 137 && b1 === 80 && b2 === 78 && b3 === 71) { return true; } /* PNG   89 50 4E 47 */
    if (b0 === 71 && b1 === 73 && b2 === 70 && b3 === 56) { return true; }  /* GIF   47 49 46 38 */
    if (b0 === 66 && b1 === 77) { return true; }                            /* BMP   42 4D */
    if (b0 === 82 && b1 === 73 && b2 === 70 && b3 === 70) { return true; }  /* WEBP  52 49 46 46 */
    return false;
  },

  /* 把「二进制字符串」还原成 Uint8Array（兜底通道用，逐字符循环——不能用正则） */
  bytesFromBinaryString: function (s) {
    if (!s || typeof s !== 'string' || s.length < 512) {
      return null;
    }
    var n = s.length;
    var arr = null;
    try {
      arr = new Uint8Array(n);
    } catch (e) {
      return null;
    }
    for (var i = 0; i < n; i++) {
      arr[i] = s.charCodeAt(i) & 255;
    }
    return arr;
  },

  downloadAvatar: function (url) {
    if (!url) {
      return;
    }
    var u = String(url);
    if (u.length < 4) {
      return;
    }
    var full = u;
    if (u.indexOf('http') !== 0) {
      if (u.charAt(0) === '/') {
        full = CONFIG.ORIGIN + u;
      } else {
        full = CONFIG.ORIGIN + '/' + u;
      }
    }
    if (!this.ensureFile() || !this.ensureApi()) {
      return;
    }
    var that = this;
    /* 通道①：responseType:'arraybuffer'（SDK 只声明 text/json，能否拿到二进制看运行时） */
    try {
      this.fetchApi.fetch({
        url: full,
        method: 'GET',
        responseType: 'arraybuffer',
        success: function (res) {
          var buf = res ? res.data : null;
          if (that.isImageBuffer(buf)) {
            that.writeAvatarBuffer(buf);
            return;
          }
          that.downloadAvatarAsText(full);
        },
        fail: function () {
          that.downloadAvatarAsText(full);
        }
      });
    } catch (e) {
      this.downloadAvatarAsText(full);
    }
  },

  /* 通道②：不带 responseType，拿「原始字符串」（部分运行时会以 latin1 形式给到二进制体）
   * 只有还原出来的字节通过图片魔数校验才采用 → 不会误切到垃圾文件。 */
  downloadAvatarAsText: function (full) {
    var that = this;
    try {
      this.fetchApi.fetch({
        url: full,
        method: 'GET',
        success: function (res) {
          var s = res ? res.data : null;
          if (typeof s !== 'string') {
            return;
          }
          var arr = that.bytesFromBinaryString(s);
          if (!arr || !that.isImageBuffer(arr)) {
            return;
          }
          that.writeAvatarBuffer(arr.buffer ? arr.buffer : arr);
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  /* 只有一个地方写盘 + 只有写成功才切 avatarSrc —— 保证不会指向空文件 */
  writeAvatarBuffer: function (buf) {
    var that = this;
    try {
      this.fileApi.writeArrayBuffer({
        uri: FILE_AVATAR,
        buffer: buf,
        success: function () {
          that.avatarSrc = FILE_AVATAR;
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  /* ───────────────── Token 文件读写 ───────────────── */

  loadToken: function () {
    var that = this;
    if (!this.ensureFile()) {
      that.applyToken(CONFIG.TOKEN || '');
      return;
    }
    try {
      this.fileApi.readText({
        uri: FILE_TOKEN,
        success: function (data) {
          var t = '';
          if (data) {
            if (typeof data.text === 'string') {
              t = data.text;
            } else if (typeof data === 'string') {
              t = data;
            }
          }
          t = t ? stripWs(t) : '';
          /* 文件里没有 → 用源码里内置的（定制打包场景） */
          that.applyToken(t || CONFIG.TOKEN || '');
        },
        fail: function () {
          that.applyToken(CONFIG.TOKEN || '');
        }
      });
    } catch (e) {
      this.applyToken(CONFIG.TOKEN || '');
    }
  },

  /* 生成问候语：「昵称，早上/中午/晚上好！」
   * - 未登录（myNick 为「未登录」/空/'-'）→ 名字用「用户」
   * - 小时数取自 Date().getHours()，⚠️ lite 的 Date 不可靠 → 整段 try/catch，
   *   取不到就退回中性的「你好！」（不带时段）
   * - 这里用 indexOf/比较，绝不用正则（lite 不支持正则） */
  buildGreet: function () {
    var name = this.myNick;
    if (!name || name === '未登录' || name === '-') {
      name = '用户';
    }
    var h = -1;
    try {
      h = new Date().getHours();
    } catch (e) {
      h = -1;
    }
    var part = '';
    if (h >= 5 && h < 11) {
      part = '早上';
    } else if (h >= 11 && h < 17) {
      part = '中午';
    } else if (h >= 17 || (h >= 0 && h < 5)) {
      part = '晚上';
    }
    if (part) {
      this.greetText = name + '，' + part + '好！';
    } else {
      this.greetText = name + '，你好！';
    }
  },

  applyToken: function (t) {
    var changed = (t !== this.token);
    this.token = t;
    if (!t) {
      this.myToken = '未绑定';
      this.myNick = CONFIG.OWNER ? String(CONFIG.OWNER) : '未登录';
    } else {
      this.myToken = '已设置 (...' + t.substring(t.length - 6) + ')';
    }
    this.buildGreet();
    if (changed) {
      this.loadedUser = false;
      if (t) {
        this.refreshInfo();
        this.loadUser();
      }
    }
  },

  saveToken: function (t) {
    var that = this;
    if (!this.ensureFile()) {
      return;
    }
    try {
      this.fileApi.writeText({
        uri: FILE_TOKEN,
        text: String(t),
        success: function () {
          console.info('token saved');
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  /* ───────────────── 屏1：签到 + 转盘 ───────────────── */

  refreshInfo: function () {
    var that = this;
    if (!this.token) {
      this.checkinInfo = '尚未绑定 Token';
      this.checkinResult = '请私聊作者绑定';
      this.spinInfo = '签到后可抽奖';
      return;
    }
    /* token 有了 → 清掉可能残留的「未绑定」提示。
     * 为什么会有残留：loadToken 是**异步**读文件的，首次 refreshInfo 可能先跑在 token 就绪之前，
     * 于是「请私聊作者绑定」写进 checkinResult 后就再没被覆盖（2026-09-25 设备上看到的怪现象）。 */
    if (this.checkinResult === '请私聊作者绑定') {
      this.checkinResult = '';
    }
    if (this.spinResult === '尚未绑定 Token') {
      this.spinResult = '';
    }
    this.request('GET', '/points/info', null, function (ok, res) {
      if (!ok) {
        that.checkinInfo = '状态读取失败';
        that.checkinResult = clamp(res, RESULT_MAX);
        return;
      }
      if (res.code !== 0) {
        that.checkinInfo = '接口错误';
        that.checkinResult = clamp(fmt(res.message), RESULT_MAX);
        return;
      }
      var d = res.data || {};
      that.points = (d.points === undefined || d.points === null) ? 0 : d.points;
      var days = (d.consecutiveDays === undefined || d.consecutiveDays === null) ? 0 : d.consecutiveDays;
      that.checkinInfo = '积分 ' + fmt(that.points) + ' · 连签 ' + fmt(days) + ' 天';
      that.myPoints = fmt(that.points);
      that.checkinBtn = d.checkedInToday ? '今日已签到' : '立即签到';
      if (d.luckyWheelEnabled === false) {
        that.spinInfo = '转盘未开放';
      } else if (d.checkedInToday !== true) {
        that.spinInfo = '签到后可抽奖';
      } else if (d.luckyWheelAvailable) {
        that.spinInfo = '今日可抽一次';
      } else {
        that.spinInfo = '今日已抽完';
      }
    });
  },

  doCheckin: function () {
    var that = this;
    if (this.busy) {
      return;
    }
    if (!this.token) {
      this.checkinResult = '尚未绑定 Token';
      return;
    }
    this.busy = true;
    this.checkinBtn = '签到中…';
    this.checkinResult = '请求已发送…';
    this.request('POST', '/points/checkin', null, function (ok, res) {
      that.busy = false;
      if (!ok) {
        that.checkinBtn = '立即签到';
        that.checkinResult = clamp('签到失败：' + res, RESULT_MAX);
        return;
      }
      if (res.code !== 0) {
        that.checkinBtn = '立即签到';
        that.checkinResult = clamp('签到失败：' + fmt(res.message), RESULT_MAX);
        return;
      }
      var d = res.data || {};
      var s = '签到成功';
      if (d.pointsEarned !== undefined && d.pointsEarned !== null) {
        s = s + ' +' + d.pointsEarned + '分';
      }
      if (d.experienceEarned !== undefined && d.experienceEarned !== null) {
        s = s + ' +' + d.experienceEarned + '经验';
      }
      if (d.couponReward) {
        s = s + ' 得签名卷';
      }
      if (d.leveledUp && d.level) {
        s = s + ' 升Lv.' + d.level;
      }
      that.checkinBtn = '今日已签到';
      that.checkinResult = clamp(s, RESULT_MAX);
      that.refreshInfo();
    });
  },

  doSpin: function () {
    var that = this;
    if (this.busy) {
      return;
    }
    if (!this.token) {
      this.spinResult = '尚未绑定 Token';
      return;
    }
    this.busy = true;
    this.spinBtn = '抽奖中…';
    this.spinResult = '请求已发送…';
    this.request('POST', '/points/lucky-wheel/spin', null, function (ok, res) {
      that.busy = false;
      if (!ok) {
        that.spinBtn = '开始抽奖';
        that.spinResult = clamp('抽奖失败：' + res, RESULT_MAX);
        return;
      }
      if (res.code !== 0) {
        that.spinBtn = '开始抽奖';
        that.spinResult = clamp('抽奖失败：' + fmt(res.message), RESULT_MAX);
        return;
      }
      that.spinBtn = '今日已抽';
      that.spinResult = clamp(fmt(res.message) || '抽奖成功', RESULT_MAX);
      that.refreshInfo();
    });
  },

  /* ───────────────── 屏2：每日一句 ───────────────── */

  loadQuote: function (force) {
    var that = this;
    if (this.loadedQuote && !force) {
      return;
    }
    this.loadedQuote = true;
    this.quoteText = '正在获取…';
    this.quoteFrom = '';
    this.getJson(CONFIG.QUOTE_API, function (ok, res) {
      if (!ok || !res || !res.hitokoto) {
        that.quoteText = '名句获取失败';
        that.quoteFrom = '再点一次可重试';
        return;
      }
      that.quoteText = String(res.hitokoto);
      var from = res.from ? String(res.from) : '';
      var who = res.from_who ? String(res.from_who) : '';
      that.quoteFrom = (who ? who + ' · ' : '') + from;
    });
  },

  nextQuote: function () {
    this.vibrate();
    this.toast('换一句…');
    this.loadQuote(true);
  },

  /* ───────────────── 屏3：应用推荐 ───────────────── */

  /* 数据源：/app/list 全量（99个）按设备过滤，60 个可买；失败回退 /app/hot */
  loadRecommend: function (force) {
    var that = this;
    if (this.loadedRec && !force) {
      return;
    }
    this.loadedRec = true;
    this.r1n = '加载中…';
    this.r1m = '';
    this.request('GET', '/app/list?page=1&pageSize=200', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data || !res.data.length) {
        that.r1n = '推荐加载失败';
        that.r1m = '再点一次可重试';
        that.r2n = '';
        that.r2m = '';
        that.r3n = '';
        that.r3m = '';
        return;
      }
      that.allApps = res.data;
      that.rebuildAppList();
    });
  },

  /* 按当前设备过滤 + 按下载量降序（插入排序，不用正则/ES6），再渲染推荐与购买两屏。
   * 过滤条件与网页端下单前置检查一致：status=published、device 含本机型号、
   * allow_auto_signing、allow_points_redeem。 */
  rebuildAppList: function () {
    var src = this.allApps || [];
    var model = this.deviceModel;
    var out = [];
    for (var i = 0; i < src.length; i++) {
      var a = src[i];
      if (a.status !== 'published') { continue; }
      if (a.allow_auto_signing === false || a.allowAutoSigning === false) { continue; }
      var canPts = (a.allow_points_redeem === undefined) ? a.allowPointsRedeem : a.allow_points_redeem;
      if (canPts === false) { continue; }
      if (model) {
        var dev = a.device || [];
        var hit = false;
        for (var j = 0; j < dev.length; j++) {
          if (dev[j] === model) { hit = true; break; }
        }
        if (!hit) { continue; }
      }
      out.push(a);
    }
    for (var m = 1; m < out.length; m++) {
      var cur = out[m];
      var k = m - 1;
      while (k >= 0 && (out[k].downloads || 0) < (cur.downloads || 0)) {
        out[k + 1] = out[k];
        k--;
      }
      out[k + 1] = cur;
    }
    this.recList = out;
    this.renderRec();
    this.applyBuy();
    this.checkOwned();
  },

  /* 渲染推荐屏的 3 张卡（recList + recPage 计算得出） */
  renderRec: function () {
    var arr = this.recList || [];
    if (!arr.length) {
      this.r1n = '没有适配当前设备的应用';
      this.r1m = '';
      this.r2n = '';
      this.r2m = '';
      this.r3n = '';
      this.r3m = '';
      return;
    }
    var start = (this.recPage * 3) % arr.length;
    for (var i = 0; i < 3; i++) {
      var a = arr[(start + i) % arr.length] || {};
      var name = fmt(a.name);
      var meta = fmt(a.developer) + ' · ' + humanNum(a.downloads) + '次下载';
      if (i === 0) {
        this.r1n = name;
        this.r1m = meta;
      } else if (i === 1) {
        this.r2n = name;
        this.r2m = meta;
      } else {
        this.r3n = name;
        this.r3m = meta;
      }
    }
  },

  nextRec: function () {
    this.vibrate();
    this.toast('换一批…');
    this.recPage = this.recPage + 1;
    this.loadRecommend(true);
  },

  /* ───────────────── 屏4：购买应用（积分兑换） ───────────────── */

  /* 状态文案 */
  orderStatusText: function (st) {
    var t = String(st === null || st === undefined ? '' : st);
    if (t === 'paid') { return '已支付'; }
    if (t === 'pending') { return '待支付'; }
    if (t === 'cancelled') { return '已取消'; }
    return t === '' ? '未知' : t;
  },

  /* 订单时间只取 ISO 串里的「MM-DD」，不碰 Date（lite 的 Date 不可靠） */
  dayOf: function (iso) {
    var t = String(iso === null || iso === undefined ? '' : iso);
    return t.length >= 10 ? t.substring(5, 10) : '';
  },

  /* 已购列表到位后重算购买屏（「已拥有」状态从这里刷新） */
  checkOwned: function () {
    this.applyBuy();
  },

  /* 计价：照抄网页端公式。总额=应用价+签名费(+legacy自动签名0.5元平台费)；积分=ceil(总额/0.12)，1积分=0.12元 */
  calcPrice: function (a) {
    var g = function (snake, camel) {
      var v = a[snake];
      if (v === undefined) { v = a[camel]; }
      return v;
    };
    var mode = g('payment_mode', 'paymentMode') || 'legacy';
    var isNew = (mode === 'free' || mode === 'paid');
    var platformFee = Number(g('platform_signing_fee', 'platformSigningFee'));
    if (!platformFee || platformFee <= 0) { platformFee = 0.5; }
    var isTest = (g('is_test_app', 'isTestApp') === 1 || g('is_test_app', 'isTestApp') === true);
    var autoPrice = Number(g('auto_signing_price', 'autoSigningPrice')) || 0;
    var appPrice = Number(g('app_price', 'appPrice')) || 0;
    var appPricePart = 0;
    var signPart = 0;
    var extra = 0;
    if (isNew) {
      appPricePart = (mode === 'paid') ? appPrice : 0;
      signPart = platformFee;
    } else {
      appPricePart = appPrice;
      signPart = autoPrice > 0 ? autoPrice : (Number(a.signing_fee) || 0);
      extra = (isTest || autoPrice > 0) ? 0 : 0.5;
    }
    var total = appPricePart + signPart + extra;
    total = Math.round(total * 100) / 100;   /* 消浮点：1.1600000000000001 → 1.16 */
    var fixed = parseInt(g('redeem_points_cost', 'redeemPointsCost'), 10) || 0;
    var fullOnly = (g('full_redeem_only', 'fullRedeemOnly') === true || g('full_redeem_only', 'fullRedeemOnly') === 1);
    var pts = 0;
    if (fullOnly && fixed > 0) {
      pts = fixed;
    } else if (total > 0) {
      pts = Math.ceil(total / 0.12);
      if (pts < 1) { pts = 1; }
    }
    return { total: total, points: pts };
  },

  /* 当前选中应用 → 渲染购买屏（含详情：描述 / 版本 / 大小 / 评分） */
  applyBuy: function () {
    var list = this.recList || [];
    if (!list.length) {
      this.buyName = '暂无可兑换应用';
      this.buyInfo = '';
      this.buyDesc = '';
      this.buyMeta = '';
      this.buyBtn = '积分兑换';
      this.buyResult = '去上一屏「应用推荐」加载列表';
      this.buyOwned = false;
      return;
    }
    if (this.buyIdx >= list.length) {
      this.buyIdx = 0;
    }
    var a = list[this.buyIdx] || {};
    var pr = this.calcPrice(a);
    var canPts = (a.allow_points_redeem === undefined) ? a.allowPointsRedeem : a.allow_points_redeem;
    this.buyName = fmt(a.name);
    this.buyInfo = fmt(a.developer) + ' · ' + humanNum(a.downloads) + '次下载';
    this.buyDesc = clamp(fmt(a.description), 44);
    this.buyMeta = 'v' + fmt(a.version) + ' · ' + fmt(a.size) + ' · 评分 ' + fmt(a.rating);
    this.buyPoints = '兑换需 ' + pr.points + ' 积分 · 我的积分 ' + fmt(this.points);
    this.buyOwned = this.ownedIds.indexOf(a.id) >= 0;
    if (this.buyOwned) {
      this.buyBtn = '已拥有';
      this.buyResult = '该应用已在你的已购列表里';
    } else if (canPts === false) {
      this.buyBtn = '不支持积分兑换';
      this.buyResult = '请到手机端用其他方式购买';
    } else if (pr.points > 0) {
      this.buyBtn = fmt(pr.points) + ' 积分兑换';
      this.buyResult = '只需积分 · 点下面按钮兑换';
    } else {
      this.buyBtn = '0 积分兑换';
      this.buyResult = '该应用 0 积分即可兑换';
    }
  },

  /* 已购列表：GET /order/purchased → 只留 id，用来判断「已拥有」 */

  /* 默认设备：POST /order/create 必须带 deviceId，取 isDefault 那台 */

  /* 下单：两段确认 → create → pay → status
   * 接口与网页端完全一致（从站点 JS 里挖出来的）：
   *   POST /order/create  {appId, deviceId, signingType, useCoupon, usePoints, usePointsRedeem, orderType}
   *   POST /order/pay     {orderId, paymentMethod}   ← 0 元单服务端直接按免费处理
   *   GET  /order/status/{id}
   * ⚠️ 会真实消耗积分，所以必须点两次按钮；失败时把服务端 message 打到屏上 */

  /* ───────────────── 屏5：我的订单 ───────────────── */

  /* GET /order/list → 取最近 3 笔。接口已实测：
   * {id, appName, appVersion, deviceModelName, signingType, price, status, paymentMethod, createdAt} */
  loadOrders: function (force) {
    var that = this;
    if (this.loadedOrders && !force) {
      return;
    }
    this.loadedOrders = true;
    this.o1n = '加载中…';
    this.o1s = '';
    this.request('GET', '/order/list', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data) {
        that.o1n = '订单读取失败';
        that.o1s = '再点一次可重试';
        that.o2n = '';
        that.o2s = '';
        that.o3n = '';
        that.o3s = '';
        that.orderInfo = '';
        return;
      }
      var arr = res.data;
      that.orders = arr;      /* 订单详情要从这里取 */
      that.orderPage = 0;
      that.renderOrderRows();
      var paid = 0;
      for (var j = 0; j < arr.length; j++) {
        if (arr[j].status === 'paid') {
          paid++;
        }
      }
      that.orderInfo = '共 ' + fmt(arr.length) + ' 笔 · 已支付 ' + fmt(paid) + ' · 点订单看详情';
    });
  },

  /* 渲染订单屏的 3 行（orderPage 翻页，每页 3 笔） */
  renderOrderRows: function () {
    var arr = this.orders || [];
    var per = 3;
    var pages = Math.ceil(arr.length / per) || 1;
    if (this.orderPage >= pages) { this.orderPage = 0; }
    var start = this.orderPage * per;
    var slots = ['o1', 'o2', 'o3'];
    for (var i = 0; i < per; i++) {
      var o = arr[start + i];
      var pre = slots[i];
      if (o) {
        this[pre + 'n'] = clamp(fmt(o.appName), 16);
        var pay = String(o.paymentMethod || '');
        var payText = '积分';
        if (pay === 'signing_coupon') { payText = '签名券'; }
        else if (pay === 'alipay') { payText = '支付宝'; }
        else if (pay === 'activation_code') { payText = '激活码'; }
        else if (pay && pay !== 'points') { payText = fmt(pay); }
        this[pre + 's'] = this.dayOf(o.createdAt) + ' · ' + this.orderStatusText(o.status) + ' · ' + payText;
      } else {
        this[pre + 'n'] = '';
        this[pre + 's'] = '';
      }
    }
  },

  /* 「更多订单」：翻到下一页 3 笔 */

  /* B 方案入口：跳独立键盘页输入 Token（键盘页写 nx_token.txt，本页 onShow 读取生效）。
   * ⚠️ 键盘放独立页是因为 lite 引擎对单页编译产物有体积上限（约 48-55KB，超限解析失败=黑屏），
   *    index 页已到红线，键盘必须拆出去。A 方案（打包注入）保留：tools/pack-for-user。 */
  openTokenKb: function () {
    this.vibrate();
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) {
      this.toast('路由不可用');
      return;
    }
    /* 不同运行时的 router 能力不同：lite 有 replaceUrl（Buckshot 实证），
     * 全 ACE wearable 的 @system.router 可能只有 replace（API6 风格）→ 逐个兜底 */
    var ok = false;
    try {
      if (typeof r.replaceUrl === 'function') {
        r.replaceUrl({ uri: 'pages/kb/index' });
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      try {
        if (typeof r.replace === 'function') {
          r.replace({ uri: 'pages/kb/index' });
          ok = true;
        }
      } catch (e) { ok = false; }
    }
    if (!ok) {
      this.toast('打开键盘失败');
    }
  },

  refreshOrders: function () {
    this.vibrate();
    this.toast('刷新中…');
    this.loadOrders(true);
  },

  /* ── 页内视图切换（更多应用列表 / 应用详情 / 订单详情） ── */

  /* 更多应用 / 订单详情 → 独立页 pages/store（openStoreApps / openStoreOrders）。
   * 导航意图与回程屏位经 internal://app/nx_nav.txt 传递：
   *   index→store 前：写 'go:apps:N' / 'go:orders:N'（N=来时屏位）
   *   store 返回前：写 'back:N'
   *   index onInit：读到 back:N → swiper 恢复到 N 屏（lite 路由会重建页面，state 靠文件过河） */
  openStore: function (mode) {
    this.vibrate();
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) {
      this.toast('路由不可用');
      return;
    }
    var back = this.curIdx;
    if (!this.ensureFile()) {
      try { r.replace({ uri: 'pages/store/index' }); } catch (e) { this.toast('打开失败'); }
      return;
    }
    var nav = 'go:' + mode + ':' + back;
    try {
      this.fileApi.writeText({
        uri: 'internal://app/nx_nav.txt',
        text: nav,
        success: function () {
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
    try {
      if (typeof r.replaceUrl === 'function') {
        r.replaceUrl({ uri: 'pages/store/index' });
      } else {
        r.replace({ uri: 'pages/store/index' });
      }
    } catch (e) {
      this.toast('打开失败');
    }
  },

  openStoreApps: function () {
    this.openStore('apps');
  },

  openStoreOrders: function () {
    this.openStore('orders');
  },

  /* onInit 读 nav 文件恢复屏位（从 store 页回来时） */
  consumeNav: function () {
    if (!this.ensureFile()) { return; }
    var that = this;
    try {
      this.fileApi.readText({
        uri: 'internal://app/nx_nav.txt',
        success: function (res) {
          var t = '';
          if (res && typeof res.text === 'string') { t = res.text; }
          t = stripWs(t);
          if (t.indexOf('back:') !== 0) { return; }
          var n = parseInt(t.substring(5), 10);
          if (!isNaN(n) && n >= 0 && n < 6) {
            that.swiperIdx = n;
            that.applyScreen(n);
          }
          try {
            that.fileApi.writeText({ uri: 'internal://app/nx_nav.txt', text: '' });
          } catch (e) {
          }
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },


  /* ───────────────── 屏6：我的 ───────────────── */

  loadUser: function () {
    var that = this;
    if (!this.token || this.loadedUser) {
      return;
    }
    this.request('GET', '/user/info', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data) {
        return;
      }
      that.loadedUser = true;
      var d = res.data;
      var lp = d.levelProgress || {};
      that.myNick = fmt(pick(d, ['nickname', 'username', 'name', 'email']));
      var lv = pick(d, ['level']);
      if (lv === null) {
        lv = pick(lp, ['level']);
      }
      that.myLevel = 'Lv.' + fmt(lv);
      var exp = pick(d, ['experience']);
      if (exp === null) {
        exp = pick(lp, ['experience']);
      }
      that.myExp = fmt(exp) + ' EXP';
      var pts = pick(d, ['points']);
      if (pts !== null) {
        that.myPoints = fmt(pts);
      }
      /* 头像：站点页面里就是 `src = user.avatar || 默认图`
       * → 拿到 URL 后 fetch 下载，成功才替换掉内置默认头像 */
      var av = pick(d, ['avatar', 'avatarUrl', 'headImg', 'headimg']);
      if (av !== null) {
        that.downloadAvatar(av);
      }
      /* 拿到真实昵称后刷新问候语 */
      that.buildGreet();
    });
  },

  /* ───────────────── 滑动切屏 ───────────────── */

  /* 切到第 i 屏：更新页码 + 4 个布尔标记（HML 用它们切换屏内按钮状态）。
   * 抽成公共方法，因为「从键盘返回」也要用它把屏位恢复回去。 */
  applyScreen: function (i) {
    this.curIdx = i;
    this.pageText = (i + 1) + '/' + PAGE_TOTAL;
    this.p0 = (i === P_MAIN);
    this.p1 = (i === P_QUOTE);
    this.p2 = (i === P_REC);
    this.p3 = (i === P_BUY);
    this.p4 = (i === P_ORDER);
    this.p5 = (i === P_MINE);
    /* 离开购买屏就撤销「再点一次确认」，避免误触花积分 */
    if (i !== P_BUY) {
      this.buyConfirm = false;
      if (this.buyBtn === '再点一次确认') {
        this.applyBuy();
      }
    }
  },

  onSwiperChange: function (e) {
    var i = -1;
    if (e) {
      if (typeof e.index === 'number') {
        i = e.index;
      } else if (typeof e.currentIndex === 'number') {
        i = e.currentIndex;
      }
    }
    if (i < 0) {
      return;
    }
    this.applyScreen(i);
    if (i === P_MAIN) {
      this.refreshInfo();
    } else if (i === P_QUOTE) {
      this.loadQuote(false);
    } else if (i === P_REC) {
      this.loadRecommend(false);
    } else if (i === P_BUY) {
      this.loadRecommend(false);
      this.loadPurchased(false);
      this.loadDevice();
    } else if (i === P_ORDER) {
      this.loadOrders(false);
      this.loadPurchased(false);
    } else if (i === P_MINE) {
      this.loadUser();
    }
  },

  /* 兜底点击入口（技能库第 6 条「双路径兜底」）：
   * swiper 内部 div 的 click 有被滑动手势吞掉的风险（技能库实证），
   * 所以 swiper 自身也绑 onclick —— 真被吞时，按当前屏执行该屏的「主操作」。
   * 与按钮的 grab:click 走同一批动作函数（函数内有 busy 锁，重复触发无害）。
   * ⚠️ 用 indexOf 判断，绝不用正则（lite 不支持正则）。 */
  onScreenTap: function () {
    this.vibrate();
    if (this.curIdx === P_MAIN) {
      /* 签到屏有两个按钮，兜底时按状态择一：未签到 → 签到；已签到 → 抽奖 */
      var notYet = this.checkinBtn.indexOf('立即') >= 0;
      if (notYet) {
        this.doCheckin();
      } else {
        this.doSpin();
      }
    } else if (this.curIdx === P_QUOTE) {
      this.nextQuote();
    }
    /* ⚠️ 只有屏1保留「点屏幕兜底」：屏1有两个按钮，兜底按状态择一（busy 锁防重）。
     * 其它屏的按钮自身 onclick 已实测可用，而点按钮会**冒泡**到 swiper 的 onclick——
     * 若这里再分派一次就会捣乱（实测：购买屏点一下 → 应用被换掉、确认状态被重置）。 */
  }
};

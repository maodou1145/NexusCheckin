/*
 */

var CONFIG = {
  ORIGIN: 'https://ws.fseatech.cn',

  TOKEN: '',                        // <<< PACK-TOKEN
  OWNER: '',                        // <<< PACK-OWNER

  CSRF: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',


  QUOTE_API: 'https://v1.hitokoto.cn/?min_length=8&max_length=26',

  POEM_API: 'https://poetry.palemoky.com/api/poems/random?lang=zh-Hans',


  WALL_API: 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN',


  /* 每日黄历（实测可达、无需 token，返回约 6.4KB）：公历/农历/干支/生肖/纳音/宜忌/节气/节日/月相/星座/运势 */


};

var API_BASE = CONFIG.ORIGIN + '/api';
var FILE_TOKEN = 'internal://app/nx_token.txt';
var FILE_CODE = 'internal://app/nx_code.txt';   /* 取件码（键盘页写、本页读）*/

var P_MAIN = 0;      /* 每日签到 + 幸运大转盘 */
var P_QUOTE = 1;     /* 每日一句 */
var P_POEM = 2;      /* 每日诗词 */
var P_HIST = 3;      /* 历史上的今天 */
var P_WORD = 4;      /* 每日英语 */
var P_BRIEF = 5;     /* 每日简报（60s 读懂世界） */
var P_CAL = 6;       /* 每日黄历（公历/农历/干支/宜忌/节日/运势） */
var P_MINE = 7;      /* 我的 */
var P_ABOUT = 8;     /* 关于（数据来源 + 侵权删除说明） */

/* 屏 10：实用工具 —— 天气/翻译/世界时间/假期/热搜（本体在独立页 pages/daily，
 * 因为 lite 引擎对单页编译产物体积有硬上限，index 塞 29 屏会被真机引擎拒绝 → 黑屏） */
var P_MORE = 9;
var PAGE_TOTAL = 10;

var RESULT_MAX = 46;


/* 黄历详情页数（点「下一页」循环翻） */


/* 自研键盘：4 页 × 20 键（5 列 × 4 行）。JWT(base64url) 字符集 = A-Za-z0-9 - _ .
 * 不足 20 键的页用空串补位（charAt 越界返回空串），空键点击无效果。 */
var KB_PAGES = [
  'ABCDEFGHIJKLMNOPQRST',
  'UVWXYZ0123456789-_.',
  'abcdefghijklmnopqrst',
  'uvwxyz0123456789-_.'
];   /* 结果文本长度上限，防 lite text 溢出 */

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

/* 去掉 \r \n \t 和空格。
 * 所以这里用 charCodeAt 逐字符判断，纯 ES5 实现。 */
/* ── JWT 有效期解析（本地判断 Token 还剩几天，零网络开销）──
 * payload 是 base64url；lite 无 atob、String.replace 也不支持全局 → 全部手工处理；
 * 只取 payload 里的 "exp"（ASCII），中文乱码无影响。 */
var B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64urlToStr(b) {
  var s = '';
  var i;
  for (i = 0; i < b.length; i++) {
    var c = b.charAt(i);
    if (c === '-') { s = s + '+'; }
    else if (c === '_') { s = s + '/'; }
    else { s = s + c; }
  }
  var pad = s.length % 4;
  if (pad === 1) { return ''; }
  if (pad === 2) { s = s + '=='; }
  else if (pad === 3) { s = s + '='; }
  var out = '';
  var buf = 0;
  var bits = 0;
  for (i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '=') { break; }
    var v = B64C.indexOf(ch);
    if (v < 0) { continue; }
    buf = (buf << 6) | v;
    bits = bits + 6;
    if (bits >= 8) {
      bits = bits - 8;
      out = out + String.fromCharCode((buf >> bits) & 255);
    }
  }
  return out;
}

/* 剩余天数：>=0 = 天数；0 = 已过期；-1 = 判断不了（非 JWT / 时间不可用） */
function jwtLeftDays(tok) {
  try {
    var t = String(tok || '');
    var p1 = t.indexOf('.');
    if (p1 < 0) { return -1; }
    var p2 = t.indexOf('.', p1 + 1);
    if (p2 < 0) { return -1; }
    var s = b64urlToStr(t.substring(p1 + 1, p2));
    if (!s) { return -1; }
    var k = s.indexOf('"exp"');
    if (k < 0) { return -1; }
    var c = s.indexOf(':', k);
    if (c < 0) { return -1; }
    var n = 0;
    var got = false;
    var i = c + 1;
    while (i < s.length) {
      var ch = s.charCodeAt(i);
      if (ch >= 48 && ch <= 57) { n = n * 10 + (ch - 48); got = true; i = i + 1; }
      else if (got) { break; }
      else if (ch === 32 || ch === 9 || ch === 34) { i = i + 1; }
      else { break; }
    }
    if (!got || n <= 0) { return -1; }
    var now = 0;
    try { now = Math.floor(new Date().getTime() / 1000); } catch (e) { now = 0; }
    if (!now) { return -1; }
    var left = n - now;
    if (left <= 0) { return 0; }
    return Math.floor(left / 86400);
  } catch (e) {
    return -1;
  }
}

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
    pageText: '1/10',
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
     * ⚠️ 值里**自带单位**，HML 写 style="width: {{screenW}};" 整串替换即可。
     *    绝不能写 style="width: {{w}}px" —— 技能库实证：字符串内嵌 {{}} 会真机渲染异常（黑屏隐患）。 */
    screenW: '466px',
    screenH: '466px',
    swiperW: '466px',
    swiperH: '406px',
    swiperTop: '34px',
    pagebarLeft: '133px',

    avatarSrc: '/common/avatar/default.png',
    bgSrc: '/common/wall/bing.png',
    greetText: '用户，你好！',

    checkinInfo: '读取中…',
    checkinBtn: '立即签到',
    checkinResult: '点按下方按钮签到',
    spinInfo: '签到后可抽奖',
    spinBtn: '开始抽奖',
    spinResult: '点按下方按钮抽奖',

    quoteList: true,
    quoteShow: false,
    quoteText: '正在获取…',
    quoteFrom: '',
    qdText: '',
    qdFrom: '',
    qdAuthor: '',
    qdKind: '',

    poemList: true,
    poemShow: false,
    poemText: '正在获取…',
    poemFrom: '',
    pdText: '',
    pdAuthor: '',
    pdSource: '',
    pdKind: '',

    /* ---- 屏4 历史上的今天（3 行一组翻页，不用 list） ----
     * histList/histShow：页内双视图（列表 ⇄ 详情），lite 路由会重建页面所以不开新页 */
    hdYear: '',

    wordPos: '',


    /* ---- 屏8 每日黄历 ---- */

    /* ---- 屏9 关于（静态文案：数据来源 + 免责/侵权删除）---- */
    aboutText: '本应用为个人兴趣项目，仅做信息聚合展示。\n'
      + '\n【数据来源】\n'
      + '一言 / 诗泉 / 60s API（简报·黄历·技术日历）\n'
      + '有道词典（翻译·词条）/ MyMemory（整句翻译）\n'
      + 'uapis.cn（天气·世界时间·假期·热搜·票房·Epic·菜谱）\n'
      + '中国货币网（汇率·官方中间价）\n'
      + 'Nexus 站点（签到·积分）\n'
      + '\n【说明】\n'
      + '内容来自第三方公开接口，实时联网获取，不收集个人信息；\n'
      + '版权归原作者所有，如涉侵权请联系删除（仓库 Issues）。',

    myNick: '未登录',
    myLevel: '-',
    myExp: '-',
    myPoints: '-',
    myToken: '未绑定',

    /* ---- 视图切换（页内切换；lite 路由 replaceUrl 会重建页面丢状态，所以不用路由） ----
     * 主界面 swiper 常驻；Token 输入拆到独立页 pages/kb（lite 单页体积上限） */

    toastText: '',
    toastShow: false,
    toastTop: '402px',
    toastW: '466px',

    token: '',
    points: 0,
    busy: false,
    loadedQuote: false,
    loadedPoem: false,
    loadedUser: false,
    /* 黄历：加载标记 + 详情页游标 + 三页文本缓存 */
    loadedCal: false,
    pmTitle: '',
    pmDyn: '',
    pmAuthor: '',
    pmType: '',
    pmLines: [],

  },


  onInit: function () {
    this.fetchApi = null;
    this.fileApi = null;
    this.vibratorApi = null;
    this.toastTimer = null;
    this.busy = false;
    this.loadedQuote = false;
    this.loadedPoem = false;
    this.loadedHist = false;
    this.loadedWord = false;
    this.loadedUser = false;
    this.histOffset = 0;
    this.histAll = [];
    this.histList = true;
    this.histShow = false;
    this.quoteList = true;
    this.quoteShow = false;
    this.poemList = true;
    this.poemShow = false;
    this.wordList = true;
    this.wordShow = false;
    /* 适配屏幕：读设备窗口尺寸 → 算容器级尺寸（圆表 466×466 / 方表 408×480 通吃）。
     * 读失败也没关系：data 里已按圆表给了默认值 */
    this.applyMetrics();
    if (CONFIG.OWNER) {
      this.myNick = String(CONFIG.OWNER);
    }
    this.buildGreet();
  },

  onShow: function () {
    var that = this;
    this.loadToken();
    this.refreshInfo();
    /* 表冠翻屏：页面激活时给 swiper 获焦（lite 文档「表冠事件」：list/slider/swiper
     * 获焦后旋转表冠 = 组件自身滚动/翻页，与手指滑动一致） */
    this.crownFocus(true);
  },

  onHide: function () {
    this.crownFocus(false);
  },

  onDestroy: function () {
    this.crownFocus(false);
  },

  /* 表冠焦点控制：$refs.mainswiper.rotation({focus})。
   * ⚠️ 模拟器（rich 引擎）可能没有 rotation 方法或 $refs 为空 → 全程 try/catch 静默，
     真机 lite 引擎才生效；focus=false 释放焦点，防止本页隐藏后表冠事件仍被它消费 */
  crownFocus: function (on) {
    try {
      var el = this.$refs && this.$refs.mainswiper;
      if (el && typeof el.rotation === 'function') {
        el.rotation({ focus: on });
      }
    } catch (e) {
    }
  },


  /* 读设备窗口尺寸 → 算容器级尺寸。
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


  /* ── 网络串行队列 ──
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
      /* 必须 setTimeout 让 JS 栈先展开：lite 的回调可能是同步调用，
       * 直接 pump 会变成递归连发（= 变相并发），这正是卡死的形态之一 */
      try { setTimeout(function () { that.pumpQueue(); }, 50); } catch (e) { that.pumpQueue(); }
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
        /* HTTP 401 = 服务端判定 Token 无效/过期（实测响应 {"code":-1,"message":"无效的Token"}），
         * 统一翻译成人话并指向解法，不再往下透传业务对象 */
        if (httpCode === 401) {
          cb(false, 'Token 无效或已过期，请在「我的」页重新绑定');
          return;
        }
        if (obj) {
          cb(true, obj);
        } else {
          cb(false, 'HTTP ' + httpCode + ' 响应无法解析');
        }
      },
      fail: function (res, code) {
        if (code === 401) {
          cb(false, 'Token 无效或已过期，请在「我的」页重新绑定');
          return;
        }
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

  loadToken: function () {
    var that = this;
    /* ① 优先读 $app 全局（键盘页 kbDone 写入；同步可靠） */
    try {
      if (typeof $app !== 'undefined' && $app && $app.nxToken) {
        var gt = stripWs(String($app.nxToken));
        $app.nxToken = '';
        if (gt) { that.applyToken(gt); return; }
      }
    } catch (e) {}
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
   * - 小时数取自 Date().getHours()，⚠️ lite 的 Date 不可靠 → 整段 try/catch，
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
      this.checkinResult = '未绑定 Token，先按下面「输入 Token」';
    } else {
      /* 本地算剩余天数（JWT exp）→「我的」页显示；快过期/已过期才占用签到提示行，
       * 正常情况下绝不覆盖签到结果文案 */
      var tail = '...' + t.substring(t.length - 6);
      var d = jwtLeftDays(t);
      if (d === 0) {
        this.myToken = '已过期 · 请更换';
        this.checkinResult = 'Token 已过期，去「我的」页重新输入';
      } else if (d > 0 && d <= 3) {
        this.myToken = '剩 ' + d + ' 天 · ' + tail;
        this.checkinResult = 'Token 还剩 ' + d + ' 天，记得更换';
      } else if (d > 3) {
        this.myToken = '剩 ' + d + ' 天 · ' + tail;
      } else {
        this.myToken = '已设置 · ' + tail;
      }
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


  refreshInfo: function () {
    var that = this;
    if (!this.token) {
      this.checkinInfo = '尚未绑定 Token';
      this.checkinResult = '请私聊作者绑定';
      this.spinInfo = '签到后可抽奖';
      return;
    }
    /* token 有了 → 清掉可能残留的「未绑定」提示。
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

  /* ═════════════ 每日黄历屏 ═════════════
   * 数据源：60s API /v2/lunar（实测约 6.4KB，免 token）：公历 / 农历 / 干支 / 生肖 /
   *        纳音 / 宜忌 / 节气 / 法定节假日 / 月相 / 星座 / 运势 / 八字。
   * 主页只放「一眼可见」的核心（日期 / 农历 / 干支 / 节日 / 宜忌），
   * 详情用 3 页循环翻（基本信息 → 宜忌 → 运势），避免一屏塞满。
   * ═══════════════════════════════════════ */

  /* 黄历已拆到独立页：首页这里只负责跳过去 */
  openCal: function () {
    this.vibrate();
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { this.toast('路由不可用'); return; }
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: 'pages/cal/index' }); return; } } catch (e) {}
    try { if (typeof r.replace === 'function') { r.replace({ uri: 'pages/cal/index' }); } } catch (e) {}
  },
















  /* 更多内容（英语 / 历史 / 简报）已拆到独立页 pages/more —— 写类型 → 跳过去 */
  openMoreWord: function () { this.openMore('word'); },
  openMoreHist: function () { this.openMore('hist'); },
  openMoreBrief: function () { this.openMore('brief'); },

  openMore: function (kind) {
    this.vibrate();
    if (this.ensureFile()) {
      try { this.fileApi.writeText({ uri: 'internal://app/nx_more.txt', text: kind, success: function () {}, fail: function () {} }); } catch (e) {}
    }
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { this.toast('路由不可用'); return; }
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: 'pages/more/index' }); return; } } catch (e) {}
    try { if (typeof r.replace === 'function') { r.replace({ uri: 'pages/more/index' }); } } catch (e) {}
  },

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
      /* 详情用完整字段 */
      that.qdText = String(res.hitokoto);
      that.qdFrom = from || '暂无出处';
      that.qdAuthor = who || '佚名';
      var t = String(res.type || '');
      var kinds = ['动画', '漫画', '文学', '原创', '网络', '其他', '影视', '诗词', '网易云', '哲学', '抖机灵'];
      var ci = t.charCodeAt(0) - 97;
      that.qdKind = (ci >= 0 && ci < kinds.length) ? ('类型：' + kinds[ci]) : '类型：其他';
      that.quoteList = true;
      that.quoteShow = false;
    });
  },

  nextQuote: function () {
    this.vibrate();
    this.toast('换一句…');
    this.loadQuote(true);
  },

  /* 一言详情：页内切详情视图 */
  openQuoteDetail: function () {
    this.vibrate();
    this.qdText = this.quoteText;
    this.quoteList = false;
    this.quoteShow = true;
  },

  quoteBack: function () {
    this.vibrate();
    this.quoteList = true;
    this.quoteShow = false;
  },


  loadPoem: function (force) {
    var that = this;
    if (this.loadedPoem && !force) {
      return;
    }
    this.loadedPoem = true;
    this.poemText = '正在获取…';
    this.poemFrom = '';
    this.getJson(CONFIG.POEM_API, function (ok, res) {
      var d = (ok && res && res.data) ? res.data : null;
      if (!d || !d.content || !d.content.length) {
        that.poemText = '诗词获取失败';
        that.poemFrom = '再点一次可重试';
        return;
      }
      var lines = [];
      for (var i = 0; i < d.content.length; i++) {
        lines.push(fmt(d.content[i]));
      }
      var au = (d.author && d.author.name) ? String(d.author.name) : '佚名';
      var ti = d.title ? String(d.title) : '无题';
      var dy = (d.dynasty && d.dynasty.name) ? String(d.dynasty.name) : '';
      var ty = (d.type && d.type.name) ? String(d.type.name) : '';
      that.poemText = clamp(lines.join(' '), 46);
      that.poemFrom = '——' + au + '《' + clamp(ti, 16) + '》';
      /* 详情用完整字段 */
      that.pmTitle = ti;
      that.pmDyn = dy;
      that.pmAuthor = au;
      that.pmType = ty;
      that.pmLines = lines;
      that.poemList = true;
      that.poemShow = false;
    });
  },

  nextPoem: function () {
    this.vibrate();
    this.toast('换一首…');
    this.loadPoem(true);
  },

  openPoemDetail: function () {
    this.vibrate();
    if (!this.pmLines || !this.pmLines.length) {
      this.toast('先等诗句加载好');
      return;
    }
    this.pdText = clamp(this.pmLines.join('\n'), 150);
    this.pdAuthor = this.pmAuthor;
    this.pdSource = this.pmTitle;
    this.pdKind = (this.pmDyn ? this.pmDyn + ' · ' : '') + (this.pmType || '诗词');
    this.poemList = false;
    this.poemShow = true;
  },

  poemBack: function () {
    this.vibrate();
    this.poemList = true;
    this.poemShow = false;
  },


  /* 60s API 开源集合：实测约 5.7KB / 14 条，结构 data.items[].year/title。
   * 每屏渲染 3 条，histOffset 翻页循环；不用 list（swiper 内禁 list）。 */















  /* 内置词库按日期轮换：dayIndex = (y*372 + m*31 + d) % 词库长度，同一天固定同一个词。
   * 释义 API（dictionaryapi.dev 等）国内网络不可达（2026-09-25 实测），内置词库最稳。 */




  /* 词库扩充包：rawfile/words.json（120 词，rawfile 不占 JS 页面 48KB 体积预算）。
   * ⚠️ 模拟器/Previewer 读 rawfile 可能失败（EnglishDict 实证）→ 静默兜底用内置 40 词，真机读全量 */






  /* 有道词典查询：拿音标 / 中文释义 / 双语例句。
   * 任一字段缺失都保留本地兜底值；整条失败静默不影响显示。 */








  /* B 方案入口：跳独立键盘页输入 Token（键盘页写 nx_token.txt，本页 onShow 读取生效）。
   * ⚠️ 键盘放独立页是因为 lite 引擎对单页编译产物有体积上限（约 48-55KB，超限解析失败=黑屏），
   *    index 页已到红线，键盘必须拆出去。A 方案（打包注入）保留：tools/pack-for-user。 */
  /* 「输入 Token」/「取件码绑定」共用：写模式文件后跳键盘页
   * ⚠️ 必须显式写模式：键盘页 onInit 读 nx_kbmode.txt，上次残留（tr/tk/pk）会串味 */
  openTokenKb: function () { this.openKb('tk'); },
  openCodeKb: function () { this.openKb('pk'); },

  openKb: function (mode) {
    this.vibrate();
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) {
      this.toast('路由不可用');
      return;
    }
    try { if (typeof $app !== 'undefined' && $app) { $app.nxKbMode = mode; } } catch (e) {}
    if (this.ensureFile()) {
      try { this.fileApi.writeText({ uri: 'internal://app/nx_kbstate.txt', text: '', success: function () {}, fail: function () {} }); } catch (e) {}
      try { this.fileApi.writeText({ uri: 'internal://app/nx_kbmode.txt', text: mode, success: function () {}, fail: function () {} }); } catch (e) {}
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
      /* 拿到真实昵称后刷新问候语 */
      that.buildGreet();
    });
  },


  /* 切到第 i 屏：更新页码 + 4 个布尔标记（HML 用它们切换屏内按钮状态）。
   * 抽成公共方法，因为「从键盘返回」也要用它把屏位恢复回去。 */
  applyScreen: function (i) {
    this.curIdx = i;
    this.pageText = (i + 1) + '/' + PAGE_TOTAL;
    this.p0 = (i === P_MAIN);
    this.p1 = (i === P_QUOTE);
    this.p2 = (i === P_POEM);
    this.p3 = (i === P_HIST);
    this.p4 = (i === P_WORD);
    this.p5 = (i === P_MINE);
    if (i !== P_QUOTE) {
      this.quoteList = true;
      this.quoteShow = false;
    }
    if (i !== P_POEM) {
      this.poemList = true;
      this.poemShow = false;
    }
    if (i !== P_HIST) {
      this.histList = true;
      this.histShow = false;
    }
    if (i !== P_WORD) {
      this.wordList = true;
      this.wordShow = false;
    }
    if (i !== P_BRIEF) {
      this.briefList = true;
      this.briefShow = false;
    }
    /* 离开黄历屏：退回主页视图（下次进屏不落在详情） */
    if (i !== P_CAL) {
      this.calMain = true;
      this.calDetail = false;
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
    } else if (i === P_POEM) {
      this.loadPoem(false);
    } else if (i === P_CAL) {
      /* 黄历已拆到 pages/cal 独立页，首页不再加载 */
    } else if (i === P_MINE) {
      this.loadUser();
    }
  },

  /* 兜底点击入口（技能库第 6 条「双路径兜底」）：
   * ⚠️ 用 indexOf 判断，绝不用正则（lite 不支持正则）。 */
  onScreenTap: function () {
    this.vibrate();
    if (this.curIdx === P_MAIN) {
      var notYet = this.checkinBtn.indexOf('立即') >= 0;
      if (notYet) {
        this.doCheckin();
      } else {
        this.doSpin();
      }
    } else if (this.curIdx === P_QUOTE) {
      /* ⚠️ 详情视图打开时兜底必须哑火：点击冒泡到 swiper 会在这里再触发一次
       * nextQuote → 换句子 + 强制回列表（与当年购买屏兜底误触是同一类坑） */
      if (!this.quoteShow) {
        this.nextQuote();
      }
    }
    /* ⚠️ 只有屏1保留「点屏幕兜底」：屏1有两个按钮，兜底按状态择一（busy 锁防重）。
     * 若这里再分派一次就会捣乱（实测：购买屏点一下 → 应用被换掉、确认状态被重置）。 */
  },

  /* 打开「实用工具」独立页（天气/翻译/世界时间/假期/热搜 都在 pages/daily/index） */
  openTools: function () {
    this.vibrate();
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { this.toast('路由不可用'); return; }
    var ok = false;
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: 'pages/daily/index' }); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      try { if (typeof r.replace === 'function') { r.replace({ uri: 'pages/daily/index' }); ok = true; } } catch (e) { ok = false; }
    }
    if (!ok) { this.toast('打开失败'); }
  },

};



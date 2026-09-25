/*
 * Nexus 签到（Lite Wearable / API 10 / JS FA）
 * 六屏：签到+转盘 / 每日一句 / 每日诗词 / 历史上的今天 / 每日英语 / 我的
 * 铁律：① 零正则（JerryScript 不支持→整页黑屏）② 事件必须裸名 onclick
 *       ③ swiper 内不能放 list ④ 每日内容屏全部懒加载（进屏才发请求）
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

  // 每日诗词（今日诗词，实测响应仅 162B；字段 content/origin/author/category）
  POEM_API: 'https://v1.jinrishici.com/all.json',

  // 历史上的今天（60s API 开源集合，实测约 5.7KB / 14 条；data.items[].year/title）
  HIST_API: 'https://60s-api.viki.moe/v2/today_in_history',

};

var API_BASE = CONFIG.ORIGIN + '/api';
var FILE_TOKEN = 'internal://app/nx_token.txt';
var FILE_AVATAR = 'internal://app/nx_avatar.jpg';

/* 各屏编号（onSwiperChange 分派用） */
var P_MAIN = 0;      /* 每日签到 + 幸运大转盘 */
var P_QUOTE = 1;     /* 每日一句 */
var P_POEM = 2;      /* 每日诗词 */
var P_HIST = 3;      /* 历史上的今天 */
var P_WORD = 4;      /* 每日英语 */
var P_MINE = 5;      /* 我的 */
var PAGE_TOTAL = 6;

var RESULT_MAX = 46;

/* 每日英语：内置词库按日期轮换。
 * 为什么不用词典 API：dictionaryapi.dev 等释义源在国内网络不可达（2026-09-25 实测），
 * 内置词库零请求、永不失败，真机最稳；词库可按需扩充。
 * 字段：[单词, 音标, 词性, 中文释义, 例句] */
var WORD_BANK = [
  ['diligent', '/dɪlɪdʒənt/', 'adj.', '勤奋的，用功的', 'He is a diligent student.'],
  ['serene', '/səriːn/', 'adj.', '平静的，安详的', 'The lake is serene at dawn.'],
  ['curious', '/kjʊəriəs/', 'adj.', '好奇的', 'Children are curious about everything.'],
  ['gentle', '/dʒentl/', 'adj.', '温和的，轻柔的', 'She gave a gentle smile.'],
  ['brave', '/breɪv/', 'adj.', '勇敢的', 'Be brave when facing difficulties.'],
  ['honest', '/ɒnɪst/', 'adj.', '诚实的', 'An honest answer wins trust.'],
  ['patient', '/peɪʃnt/', 'adj.', '有耐心的', 'Please be patient with me.'],
  ['humble', '/hʌmbl/', 'adj.', '谦逊的', 'Stay humble after success.'],
  ['sincere', '/sɪnsɪə/', 'adj.', '真诚的', 'He gave sincere advice.'],
  ['grateful', '/ɡreɪtfl/', 'adj.', '感激的', 'I am grateful for your help.'],
  ['optimist', '/ɒptɪmɪst/', 'n.', '乐观的人', 'An optimist sees the bright side.'],
  ['courage', '/kʌrɪdʒ/', 'n.', '勇气', 'Courage is not without fear.'],
  ['wisdom', '/wɪzdəm/', 'n.', '智慧', 'Wisdom grows with experience.'],
  ['freedom', '/friːdəm/', 'n.', '自由', 'Freedom comes with duty.'],
  ['friendship', '/frendʃɪp/', 'n.', '友谊', 'Friendship needs honesty.'],
  ['journey', '/dʒɜːni/', 'n.', '旅程', 'Life is a long journey.'],
  ['memory', '/meməri/', 'n.', '记忆，回忆', 'The song brought back memories.'],
  ['silence', '/saɪləns/', 'n.', '寂静，沉默', 'Silence can be an answer.'],
  ['harvest', '/hɑːvɪst/', 'n.', '收获', 'Autumn is the harvest season.'],
  ['blossom', '/blɒsəm/', 'n.', '花，开花', 'Cherry blossoms bloom in spring.'],
  ['explore', '/ɪksplɔː/', 'v.', '探索', 'We explore the old town on foot.'],
  ['imagine', '/ɪmædʒɪn/', 'v.', '想象', 'Imagine a world without war.'],
  ['breathe', '/briːð/', 'v.', '呼吸', 'Breathe deeply and relax.'],
  ['shine', '/ʃaɪn/', 'v.', '发光，闪耀', 'Stars shine brightest at night.'],
  ['cherish', '/tʃerɪʃ/', 'v.', '珍惜', 'Cherish the time with family.'],
  ['persist', '/pəsɪst/', 'v.', '坚持', 'Persist and you will succeed.'],
  ['forgive', '/fəɡɪv/', 'v.', '原谅', 'Forgive and move on.'],
  ['discover', '/dɪskʌvə/', 'v.', '发现', 'Discover new paths every day.'],
  ['appreciate', '/əpriːʃieɪt/', 'v.', '感激，欣赏', 'I appreciate your kindness.'],
  ['consider', '/kənsɪdə/', 'v.', '考虑', 'Consider others before yourself.'],
  ['gather', '/ɡæðə/', 'v.', '聚集，收集', 'We gather flowers in the field.'],
  ['whisper', '/wɪspə/', 'v.', '低语', 'The wind whispers in the trees.'],
  ['wander', '/wɒndə/', 'v.', '漫步，徘徊', 'He wanders around the old streets.'],
  ['sparkle', '/spɑːkl/', 'v.', '闪耀', 'Her eyes sparkle with joy.'],
  ['radiant', '/reɪdiənt/', 'adj.', '光芒四射的', 'She looks radiant today.'],
  ['cozy', '/kəʊzi/', 'adj.', '温暖舒适的', 'The room feels cozy in winter.'],
  ['lively', '/laɪvli/', 'adj.', '活泼的', 'The market is lively in the morning.'],
  ['gentleness', '/dʒentlnəs/', 'n.', '温柔', 'Gentleness is a kind of strength.'],
  ['moment', '/məʊmənt/', 'n.', '时刻，瞬间', 'Enjoy every moment of today.'],
  ['hopeful', '/həʊpfl/', 'adj.', '充满希望的', 'Stay hopeful about tomorrow.']
];

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

    /* ---- 屏3 每日诗词 ---- */
    poemText: '正在获取…',
    poemFrom: '',

    /* ---- 屏4 历史上的今天（3 行一组翻页，不用 list） ---- */
    h1y: '', h1t: '正在获取…',
    h2y: '', h2t: '',
    h3y: '', h3t: '',
    histInfo: '',

    /* ---- 屏5 每日英语（内置词库按日期轮换） ---- */
    wordText: '',
    wordPhon: '',
    wordPos: '',
    wordMean: '',
    wordEx: '',

    /* ---- 屏6 我的 ---- */
    myNick: '未登录',
    myLevel: '-',
    myExp: '-',
    myPoints: '-',
    myToken: '未绑定',

    /* ---- 视图切换（页内切换；lite 路由 replaceUrl 会重建页面丢状态，所以不用路由） ----
     * 主界面 swiper 常驻；Token 输入拆到独立页 pages/kb（lite 单页体积上限） */

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
    loadedPoem: false,
    loadedHist: false,
    loadedWord: false,
    loadedUser: false,
    /* 历史事件翻页游标（每屏 3 条，histAll 缓存本次拉到的全量标题） */
    histOffset: 0,
    histAll: [],
    /* 每日英语游标：初始 = 按日期算的词库下标，「换一个」时递增 */
    wordPage: 0
  },

  /* ───────────────── 生命周期 ───────────────── */

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

  /* ───────────────── 屏3：每日诗词 ───────────────── */

  /* 今日诗词：响应仅 162B，字段 content/origin/author/category（2026-09-25 curl 实测） */
  loadPoem: function (force) {
    var that = this;
    if (this.loadedPoem && !force) {
      return;
    }
    this.loadedPoem = true;
    this.poemText = '正在获取…';
    this.poemFrom = '';
    this.getJson(CONFIG.POEM_API, function (ok, res) {
      if (!ok || !res || !res.content) {
        that.poemText = '诗词获取失败';
        that.poemFrom = '再点一次可重试';
        return;
      }
      that.poemText = clamp(String(res.content), 46);
      that.poemFrom = '——' + fmt(res.author) + '《' + clamp(fmt(res.origin), 18) + '》';
    });
  },

  nextPoem: function () {
    this.vibrate();
    this.toast('换一首…');
    this.loadPoem(true);
  },

  /* ───────────────── 屏4：历史上的今天 ───────────────── */

  /* 60s API 开源集合：实测约 5.7KB / 14 条，结构 data.items[].year/title。
   * 每屏渲染 3 条，histOffset 翻页循环；不用 list（swiper 内禁 list）。 */
  loadHist: function (force) {
    var that = this;
    if (this.loadedHist && !force && this.histAll.length) {
      return;
    }
    this.loadedHist = true;
    if (force) {
      this.histOffset = 0;
    }
    this.h1t = '正在获取…';
    this.h1y = '';
    this.h2t = '';
    this.h2y = '';
    this.h3t = '';
    this.h3y = '';
    this.histInfo = '';
    this.getJson(CONFIG.HIST_API, function (ok, res) {
      if (!ok || !res || !res.data || !res.data.items || !res.data.items.length) {
        that.h1t = '历史事件获取失败';
        that.h1y = '';
        that.histInfo = '再点「换一批」可重试';
        return;
      }
      var items = res.data.items;
      var out = [];
      for (var i = 0; i < items.length; i++) {
        out.push([fmt(items[i].year), clamp(fmt(items[i].title), 13)]);
      }
      that.histAll = out;
      if (that.histOffset >= out.length) {
        that.histOffset = 0;
      }
      that.renderHistRows();
      that.histInfo = '共 ' + fmt(out.length) + ' 条 · 点「换一批」翻看';
    });
  },

  /* 渲染 3 行历史事件（histOffset 起，循环取模） */
  renderHistRows: function () {
    var arr = this.histAll || [];
    if (!arr.length) {
      return;
    }
    for (var i = 0; i < 3; i++) {
      var it = arr[(this.histOffset + i) % arr.length];
      this['h' + (i + 1) + 'y'] = it[0];
      this['h' + (i + 1) + 't'] = it[1];
    }
  },

  nextHist: function () {
    this.vibrate();
    this.toast('换一批…');
    this.histOffset = this.histOffset + 3;
    this.renderHistRows();
  },

  /* ───────────────── 屏5：每日英语 ───────────────── */

  /* 内置词库按日期轮换：dayIndex = (y*372 + m*31 + d) % 词库长度，同一天固定同一个词。
   * 释义 API（dictionaryapi.dev 等）国内网络不可达（2026-09-25 实测），内置词库最稳。 */
  dayIndex: function () {
    var now = new Date();
    var y = now.getFullYear() || 2026;
    var m = now.getMonth() + 1;
    var d = now.getDate();
    return (y * 372 + m * 31 + d) % WORD_BANK.length;
  },

  loadWord: function (force) {
    if (this.loadedWord && !force) {
      return;
    }
    this.loadedWord = true;
    if (!this.wordPage) {
      this.wordPage = this.dayIndex();
    }
    this.renderWord();
  },

  renderWord: function () {
    var w = WORD_BANK[this.wordPage % WORD_BANK.length] || WORD_BANK[0];
    this.wordText = w[0];
    this.wordPhon = w[1] + ' ' + w[2];
    this.wordMean = w[3];
    this.wordEx = w[4];
  },

  nextWord: function () {
    this.vibrate();
    this.toast('换一个…');
    this.wordPage = this.wordPage + 1;
    this.renderWord();
  },

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
    this.p2 = (i === P_POEM);
    this.p3 = (i === P_HIST);
    this.p4 = (i === P_WORD);
    this.p5 = (i === P_MINE);
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
    } else if (i === P_HIST) {
      this.loadHist(false);
    } else if (i === P_WORD) {
      this.loadWord(false);
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

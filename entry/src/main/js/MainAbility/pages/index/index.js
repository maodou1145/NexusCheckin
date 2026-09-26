/*
 */

var CONFIG = {
  ORIGIN: 'https://ws.fseatech.cn',

  TOKEN: '',                        // <<< PACK-TOKEN
  OWNER: '',                        // <<< PACK-OWNER

  CSRF: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',

  QUOTE_API: 'https://v1.hitokoto.cn/?min_length=8&max_length=26',

  POEM_API: 'https://poetry.palemoky.com/api/poems/random?lang=zh-Hans',

  HIST_API: 'https://60s-api.viki.moe/v2/today_in_history',

  WALL_API: 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN',

  BRIEF_API: 'https://60s-api.viki.moe/v2/60s',

  /* 每日黄历（实测可达、无需 token，返回约 6.4KB）：公历/农历/干支/生肖/纳音/宜忌/节气/节日/月相/星座/运势 */
  LUNAR_API: 'https://60s-api.viki.moe/v2/lunar',

  TOB64_API: 'https://uapis.cn/api/v1/image/tobase64?url=',

  /* 图片压缩代理（wsrv.nl）：先把图压小再转 base64。
   * 为什么必须压：lite 真机运行内存仅 48KB —— 必应 _640x480 直转 base64 要 65KB、
   * 连 _400x240 也要 27KB，**字符串本身就超内存池** → 真机拉不到图（模拟器是 rich 引擎、
   * 无此限制，所以模拟器一直正常）。经验证：w=400/q=45 → 壁纸 ~16KB、头像 ~3KB。 */
  WSRV_API: 'https://wsrv.nl/?url=',

  DICT_API: 'https://dict.youdao.com/jsonapi?q=',

};

var API_BASE = CONFIG.ORIGIN + '/api';
var FILE_TOKEN = 'internal://app/nx_token.txt';
var FILE_AVATAR = 'internal://app/nx_avatar.jpg';
var FILE_WALL = 'internal://app/nx_wall.jpg';

var P_MAIN = 0;      /* 每日签到 + 幸运大转盘 */
var P_QUOTE = 1;     /* 每日一句 */
var P_POEM = 2;      /* 每日诗词 */
var P_HIST = 3;      /* 历史上的今天 */
var P_WORD = 4;      /* 每日英语 */
var P_BRIEF = 5;     /* 每日简报（60s 读懂世界） */
var P_WALL = 6;      /* 每日壁纸（可手动切换） */
var P_CAL = 7;       /* 每日黄历（公历/农历/干支/宜忌/节日/运势） */
var P_MINE = 8;      /* 我的 */
var P_ABOUT = 9;     /* 关于（数据来源 + 侵权删除说明） */
var PAGE_TOTAL = 10;

var RESULT_MAX = 46;

/* 壁纸取图尺寸：必应只认「id=xxx_<标准尺寸>.jpg」形式（带 w/h 裁剪参数会 404，实测）。
 * 640x480（4:3）base64 实测约 65KB，是清晰度与体积的平衡点 */
var WALL_SIZE = '_400x240.jpg';

/* 黄历详情页数（点「下一页」循环翻） */
var CAL_PAGES = 3;

/* 每日英语：内置词库按日期轮换。
 * 字段：[单词, 音标, 词性, 中文释义, 例句, 例句中文翻译] */
var WORD_BANK = [
  ['diligent', '/dɪlɪdʒənt/', 'adj.', '勤奋的，用功的', 'He is a diligent student.', '他是个勤奋的学生。'],
  ['serene', '/səriːn/', 'adj.', '平静的，安详的', 'The lake is serene at dawn.', '黎明时湖水一片宁静。'],
  ['curious', '/kjʊəriəs/', 'adj.', '好奇的', 'Children are curious about everything.', '孩子们对一切都好奇。'],
  ['gentle', '/dʒentl/', 'adj.', '温和的，轻柔的', 'She gave a gentle smile.', '她露出温和的微笑。'],
  ['brave', '/breɪv/', 'adj.', '勇敢的', 'Be brave when facing difficulties.', '面对困难要勇敢。'],
  ['honest', '/ɒnɪst/', 'adj.', '诚实的', 'An honest answer wins trust.', '诚实的回答赢得信任。'],
  ['patient', '/peɪʃnt/', 'adj.', '有耐心的', 'Please be patient with me.', '请对我耐心一点。'],
  ['humble', '/hʌmbl/', 'adj.', '谦逊的', 'Stay humble after success.', '成功后保持谦逊。'],
  ['sincere', '/sɪnsɪə/', 'adj.', '真诚的', 'He gave sincere advice.', '他给出了真诚的建议。'],
  ['grateful', '/ɡreɪtfl/', 'adj.', '感激的', 'I am grateful for your help.', '我很感激你的帮助。'],
  ['optimist', '/ɒptɪmɪst/', 'n.', '乐观的人', 'An optimist sees the bright side.', '乐观者看到光明的一面。'],
  ['courage', '/kʌrɪdʒ/', 'n.', '勇气', 'Courage is not without fear.', '勇气并非毫无恐惧。'],
  ['wisdom', '/wɪzdəm/', 'n.', '智慧', 'Wisdom grows with experience.', '智慧随经验增长。'],
  ['freedom', '/friːdəm/', 'n.', '自由', 'Freedom comes with duty.', '自由伴随着责任。'],
  ['friendship', '/frendʃɪp/', 'n.', '友谊', 'Friendship needs honesty.', '友谊需要诚实。'],
];

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
    histList: true,
    histShow: false,
    h1y: '', h1t: '正在获取…',
    h2y: '', h2t: '',
    h3y: '', h3t: '',
    histInfo: '',
    hdYear: '',
    hdTitle: '',
    hdMeta: '',
    hdDesc: '',

    wordList: true,
    wordShow: false,
    wordText: '',
    wordPhon: '',
    wordPos: '',
    wordMean: '',
    wordMeanFull: '',
    wordEx: '',
    wordExZh: '',
    wdExAll: '',

    briefDate: '',
    briefLunar: '',
    briefTip: '',
    b1t: '正在获取…',
    b2t: '',
    b3t: '',
    briefInfo: '',
    briefList: true,
    briefShow: false,
    bdText: '',
    bdMeta: '',
    wallLabel: '今天',
    wallCopy: '',
    /* 图片链路诊断（真机定位用）：壁纸/头像各一行状态 */
    imgDiag: '正在检查图片链路…',
    wallDiag: '',
    avDiag: '',

    /* ---- 屏8 每日黄历 ---- */
    calMain: true,
    calDetail: false,
    calDate: '正在获取…',
    calLunar: '',
    calCycle: '',
    calFest: '',
    calGood: '',
    calBad: '',
    calPage: '',
    calPageNo: '1 / 3',

    /* ---- 屏9 关于（静态文案：数据来源 + 免责/侵权删除）---- */
    aboutText: '本应用为个人兴趣项目，仅做信息聚合展示。\n'
      + '\n【数据来源】\n'
      + '一言 hitokoto.cn\n'
      + '诗泉 poetry.palemoky.com\n'
      + '60s API（历史上今天 / 每日简报）\n'
      + '有道词典 dict.youdao.com\n'
      + '必应壁纸 bing.com\n'
      + 'Nexus 站点（签到 / 积分 / 头像）\n'
      + '\n【免责与侵权删除】\n'
      + '以上内容均来自第三方公开接口，版权归原作者所有；'
      + '本应用不存储任何第三方内容。若相关内容侵犯了您的权益，'
      + '请联系我们删除，核实后将第一时间处理。\n'
      + '\n反馈：仓库 Issues',

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
    loadedHist: false,
    loadedWord: false,
    loadedUser: false,
    histOffset: 0,
    histAll: [],
    wordPage: 0,
    wordRawTried: false,
    wallTried: false,
    wallList: [],
    wallIdx: 0,
    briefAll: [],
    briefOffset: 0,
    loadedBrief: false,
    /* 黄历：加载标记 + 详情页游标 + 三页文本缓存 */
    loadedCal: false,
    calIdx: 0,
    calP1: '',
    calP2: '',
    calP3: '',
    pmTitle: '',
    pmDyn: '',
    pmAuthor: '',
    pmType: '',
    pmLines: []
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
    this.loadToken();
    this.refreshInfo();
    this.loadWallpaper();
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
    var that = this;
    /* 通道① 文件（lite 真机官方方式）→ 通道② base64（rich 模拟器） */
    this.fetchImageToFile(full, FILE_AVATAR, function (fok, n) {
      if (fok) {
        that.avatarSrc = FILE_AVATAR;
        that.avDiag = '头像:文件OK ' + Math.round(n / 1024) + 'KB';
        that.refreshImgDiag();
        return;
      }
      that.toBase64Small(full, 160, function (ok2, b64, err) {
        if (ok2 && b64) {
          that.avatarSrc = b64;
          that.avDiag = '头像:base64OK ' + Math.round(b64.length / 1024) + 'KB';
        } else {
          that.avDiag = '头像:均失败[' + err + ']';
        }
        that.refreshImgDiag();
      });
    });
  },

  /* 兜底通道：抓图片二进制 → 写 internal://app/nx_avatar.jpg → src 指向文件（lite 真机可用）。
   * 写盘成功才切 avatarSrc，失败保持内置默认头像 */
  downloadAvatarToFile: function (full) {
    if (!this.ensureFile() || !this.ensureApi()) {
      return;
    }
    var that = this;
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


  /* ───────────────── 每日壁纸（base64 抓取） ─────────────────
   * 真机实测 base64 路线可行）。 */
  loadWallpaper: function () {
    if (this.wallTried) {
      return;
    }
    this.wallTried = true;
    var that = this;
    this.getJson(CONFIG.WALL_API, function (ok, res) {
      if (!ok || !res || !res.images || !res.images.length) {
        return;
      }
      var list = [];
      for (var i = 0; i < res.images.length; i++) {
        var it = res.images[i] || {};
        var ub = String(it.urlbase || '');
        var p = ub.indexOf('id=');
        if (p < 0) {
          continue;
        }
        var id = ub.substring(p + 3);
        if (id) {
          list.push([id, fmt(it.copyright)]);
        }
      }
      if (!list.length) {
        return;
      }
      that.wallList = list;
      that.fetchWall(0);
    });
  },

  fetchWall: function (idx) {
    var that = this;
    var list = this.wallList || [];
    if (!list.length) {
      return;
    }
    var i = idx % list.length;
    var it = list[i];
    this.wallIdx = i;
    this.wallLabel = (i === 0) ? '今天' : (i === 1 ? '昨天' : (i + ' 天前'));
    this.wallCopy = clamp(it[1] || '必应每日壁纸', 60);
    /* 通道① 文件（lite 真机，用大图更清晰）→ 通道② base64（rich 模拟器） */
    var bigUrl = 'https://www.bing.com/th?id=' + it[0] + '_640x480.jpg';
    var picUrl = 'https://www.bing.com/th?id=' + it[0] + WALL_SIZE;
    this.fetchImageToFile(bigUrl, FILE_WALL, function (fok, n) {
      if (fok) {
        that.bgSrc = FILE_WALL;
        that.wallDiag = '壁纸:文件OK ' + Math.round(n / 1024) + 'KB';
        that.refreshImgDiag();
        return;
      }
      that.toBase64Small(picUrl, 400, function (ok2, b64, err) {
        if (ok2 && b64) {
          that.bgSrc = b64;
          that.wallDiag = '壁纸:base64OK ' + Math.round(b64.length / 1024) + 'KB';
        } else {
          that.wallCopy = '图片拉取失败 · 见下方诊断';
          that.wallDiag = '壁纸:均失败[' + err + ']';
        }
        that.refreshImgDiag();
      });
    });
  },

  nextWall: function () {
    this.vibrate();
    var list = this.wallList || [];
    if (!list.length) {
      this.toast('壁纸列表还没好，重试中…');
      this.wallTried = false;
      this.loadWallpaper();
      return;
    }
    this.toast('换一张壁纸…');
    this.fetchWall((this.wallIdx + 1) % list.length);
  },

  /* ═════════════ 每日黄历屏 ═════════════
   * 数据源：60s API /v2/lunar（实测约 6.4KB，免 token）：公历 / 农历 / 干支 / 生肖 /
   *        纳音 / 宜忌 / 节气 / 法定节假日 / 月相 / 星座 / 运势 / 八字。
   * 主页只放「一眼可见」的核心（日期 / 农历 / 干支 / 节日 / 宜忌），
   * 详情用 3 页循环翻（基本信息 → 宜忌 → 运势），避免一屏塞满。
   * ═══════════════════════════════════════ */

  loadLunar: function (force) {
    var that = this;
    if (this.loadedCal && !force) {
      return;
    }
    this.loadedCal = true;
    this.calDate = '正在获取…';
    this.getJson(CONFIG.LUNAR_API, function (ok, res) {
      var d = (ok && res && res.data) ? res.data : null;
      if (!d || !d.solar) {
        that.calDate = '获取失败';
        that.calLunar = '点「刷新」重试';
        that.calCycle = '';
        that.calFest = '';
        that.calGood = '';
        that.calBad = '';
        return;
      }
      that.fillCal(d);
    });
  },

  /* 解析并填充主页 + 3 页详情 */
  fillCal: function (d) {
    var so = d.solar || {};
    var lu = d.lunar || {};
    var cy = d.sixty_cycle || {};
    var zz = d.zodiac || {};
    var ny = d.nayin || {};
    var ft = d.fortune || {};
    var tb = d.taboo || {};
    var tbd = tb.day || {};
    var tbh = tb.hour || {};
    var st = d.stats || {};
    var pf = st.percents_formatted || {};
    var yName = (cy.year || {}).name_short;
    var dName = (cy.day || {}).name_short;
    var good = fmt(tbd.recommends).split('.').join(' ');
    var bad = fmt(tbd.avoids).split('.').join(' ');

    /* ── 主页 ── */
    this.calDate = fmt(so.month) + '月' + fmt(so.day) + '日 ' + fmt(so.week_desc);
    this.calLunar = '农历' + fmt(lu.month_desc) + fmt(lu.day_desc) + ' ' + fmt(lu.hour_desc);
    this.calCycle = fmt(yName) + '年 · ' + fmt(dName) + '日';

    /* 节日/节气徽标：法定节假日优先（带休/班），其次节气，再次节日 */
    var tags = [];
    var lh = d.legal_holiday || {};
    if (lh.name) {
      tags.push(fmt(lh.name) + (lh.is_work ? '·班' : '·休'));
    }
    var tm = d.term || {};
    if (tm.today && tm.today.name) {
      tags.push('今日' + fmt(tm.today.name));
    } else if (tm.stage && tm.stage.name) {
      tags.push('节气·' + fmt(tm.stage.name));
    }
    var fe = d.festival || {};
    if (fe.both_desc) {
      tags.push(fmt(fe.both_desc));
    }
    this.calFest = tags.join(' · ');

    this.calGood = '宜  ' + good;
    this.calBad = '忌  ' + bad;

    /* ── 详情第 1 页：基本信息 ── */
    var hName = fmt(tbh.hour) || fmt(lu.hour_desc);
    this.calP1 = fmt(so.full) + ' ' + fmt(so.week_desc) + '\n'
      + fmt(lu.full_with_hour) + '\n'
      + '第 ' + fmt(st.day_of_year) + ' 天 · 年度 ' + fmt(pf.year) + '\n\n'
      + '【干支】' + fmt((cy.year || {}).name) + ' ' + fmt((cy.month || {}).name) + '\n'
      + '　　　' + fmt((cy.day || {}).name) + ' ' + fmt((cy.hour || {}).name) + '\n'
      + '【生肖】' + fmt(zz.year) + '年 ' + fmt(zz.month) + '月 ' + fmt(zz.day) + '日 ' + fmt(zz.hour) + '时\n'
      + '【纳音】' + fmt(ny.year) + ' ' + fmt(ny.month) + '\n'
      + '　　　' + fmt(ny.day) + ' ' + fmt(ny.hour) + '\n'
      + '【星座】' + fmt((d.constellation || {}).name) + '\n'
      + '【月相】' + fmt((d.phase || {}).name);

    /* ── 详情第 2 页：宜忌（今日 + 当前时辰） ── */
    this.calP2 = '【今日宜】\n' + (good || '无') + '\n\n'
      + '【今日忌】\n' + (bad || '无') + '\n\n'
      + '【' + hName + '宜】\n' + (fmt(tbh.recommends).split('.').join(' ') || '无') + '\n\n'
      + '【' + hName + '忌】\n' + (fmt(tbh.avoids).split('.').join(' ') || '无');

    /* ── 详情第 3 页：运势 + 八字 ── */
    this.calP3 = '【今日】' + fmt(ft.today_luck) + '\n'
      + '【事业】' + fmt(ft.career) + '\n'
      + '【财运】' + fmt(ft.money) + '\n'
      + '【情感】' + fmt(ft.love) + '\n\n'
      + '【八字】' + fmt((d.baizi || {}).day_baizi) + '\n\n'
      + '【年度】已过 ' + fmt(pf.year) + '（第 ' + fmt(st.day_of_year) + ' 天）';

    this.calIdx = 0;
    this.showCalPage();
  },

  showCalPage: function () {
    var arr = [this.calP1, this.calP2, this.calP3];
    this.calPage = clamp(arr[this.calIdx] || '', 300);
    this.calPageNo = (this.calIdx + 1) + ' / ' + CAL_PAGES;
  },

  openCalDetail: function () {
    this.vibrate();
    this.calMain = false;
    this.calDetail = true;
    this.showCalPage();
  },

  calBack: function () {
    this.vibrate();
    this.calMain = true;
    this.calDetail = false;
  },

  nextCalPage: function () {
    this.vibrate();
    this.calIdx = (this.calIdx + 1) % CAL_PAGES;
    this.showCalPage();
  },

  refreshCal: function () {
    this.vibrate();
    this.toast('刷新中…');
    this.loadLunar(true);
  },

  /* 把网络图片抓到本地文件（lite 真机官方支持的 image 方式）。
   * 为什么优先文件：官方 lite `image` 文档**只提文件路径、从不提 base64** ——
   * data: URI 在 rich 模拟器能渲染、真机很可能不渲染。
   * ⚠️ 写盘回调可能不触发（lite 文件/存储回调不可靠）→ 用 2s 超时兜底，超时按失败处理。
   * cb(ok, bytes) */
  fetchImageToFile: function (imgUrl, fileUri, cb) {
    var that = this;
    if (!this.ensureFile() || !this.ensureApi()) {
      cb(false, 0);
      return;
    }
    var done = false;
    var finish = function (ok, n) {
      if (done) {
        return;
      }
      done = true;
      cb(ok, n);
    };
    setTimeout(function () {
      finish(false, 0);
    }, 2000);
    try {
      this.fetchApi.fetch({
        url: imgUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        success: function (res) {
          var buf = res ? res.data : null;
          if (!that.isImageBuffer(buf)) {
            finish(false, 0);
            return;
          }
          var n = buf.byteLength || 0;
          try {
            that.fileApi.writeArrayBuffer({
              uri: fileUri,
              buffer: buf,
              success: function () {
                finish(true, n);
              },
              fail: function () {
                finish(false, 0);
              }
            });
          } catch (e) {
            finish(false, 0);
          }
        },
        fail: function () {
          finish(false, 0);
        }
      });
    } catch (e) {
      finish(false, 0);
    }
  },

  /* 小图 base64：wsrv 压缩 → uapis 转 base64（体积降 4~6 倍）；
   * 压缩通道失败则回落「直连 uapis」（大图，模拟器可用，真机可能因内存超限失败）。
   * cb(ok, base64String) */
  toBase64Small: function (url, w, cb) {
    var that = this;
    if (!this.ensureApi()) {
      cb(false, '', '联网模块不可用');
      return;
    }
    var small = CONFIG.WSRV_API + encodeURL(url) + '&w=' + w + '&q=45&output=jpg';
    this.getJson(CONFIG.TOB64_API + encodeURL(small), function (ok, res) {
      if (ok && res && res.base64) {
        cb(true, String(res.base64), '');
        return;
      }
      var e1 = ok ? '无base64' : String(res || '未知');
      that.getJson(CONFIG.TOB64_API + encodeURL(url), function (ok2, res2) {
        if (ok2 && res2 && res2.base64) {
          cb(true, String(res2.base64), '');
          return;
        }
        var e2 = ok2 ? '无base64' : String(res2 || '未知');
        cb(false, '', '压缩[' + e1 + '] 直连[' + e2 + ']');
      });
    });
  },

  /* 图片链路诊断（真机无法本地复现，靠屏上这行定位卡点） */
  refreshImgDiag: function () {
    var a = this.wallDiag || '壁纸等待';
    var b = this.avDiag || '头像等待';
    this.imgDiag = a + ' · ' + b;
  },

  loadBrief: function (force) {
    var that = this;
    if (this.loadedBrief && !force) {
      return;
    }
    this.loadedBrief = true;
    if (force) {
      this.briefOffset = 0;
    }
    this.getJson(CONFIG.BRIEF_API, function (ok, res) {
      var d = (ok && res && res.data) ? res.data : null;
      if (!d || !d.news || !d.news.length) {
        that.b1t = '简报获取失败';
        that.b2t = '';
        that.b3t = '';
        that.briefInfo = '点「换一批」可重试';
        return;
      }
      var news = [];
      for (var i = 0; i < d.news.length; i++) {
        var t = fmt(d.news[i]);
        if (t) {
          news.push(t);
        }
      }
      that.briefAll = news;
      that.briefDate = fmt(d.date);
      that.briefLunar = fmt(d.lunar_date);
      that.briefTip = clamp(fmt(d.tip), 60);
      if (that.briefOffset >= news.length) {
        that.briefOffset = 0;
      }
      that.renderBriefRows();
      that.briefInfo = '共 ' + news.length + ' 条 · 点条目看全文';
    });
  },

  renderBriefRows: function () {
    var arr = this.briefAll || [];
    if (!arr.length) {
      return;
    }
    for (var i = 0; i < 3; i++) {
      this['b' + (i + 1) + 't'] = clamp(arr[(this.briefOffset + i) % arr.length], 13);
    }
  },

  nextBrief: function () {
    this.vibrate();
    this.toast('换一批…');
    this.briefOffset = this.briefOffset + 3;
    this.renderBriefRows();
  },

  briefTap0: function () { this.openBriefDetail(0); },
  briefTap1: function () { this.openBriefDetail(1); },
  briefTap2: function () { this.openBriefDetail(2); },

  openBriefDetail: function (slot) {
    this.vibrate();
    var arr = this.briefAll || [];
    var t = arr[(this.briefOffset + slot) % arr.length];
    if (!t) {
      return;
    }
    this.bdText = clamp(t, 200);
    this.bdMeta = this.briefDate + (this.briefLunar ? ' · ' + this.briefLunar : '');
    this.briefList = false;
    this.briefShow = true;
  },

  briefBack: function () {
    this.vibrate();
    this.briefList = true;
    this.briefShow = false;
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
        /* 缓存完整数据：[年份, 完整标题, 完整描述, 事件类型]。
         * 列表渲染时才截断到 13 字；详情页显示完整版 */
        out.push([
          fmt(items[i].year),
          fmt(items[i].title),
          fmt(items[i].description),
          fmt(items[i].event_type)
        ]);
      }
      that.histAll = out;
      if (that.histOffset >= out.length) {
        that.histOffset = 0;
      }
      that.histList = true;
      that.histShow = false;
      that.renderHistRows();
      that.histInfo = '共 ' + fmt(out.length) + ' 条 · 点条目看详情';
    });
  },

  renderHistRows: function () {
    var arr = this.histAll || [];
    if (!arr.length) {
      return;
    }
    for (var i = 0; i < 3; i++) {
      var it = arr[(this.histOffset + i) % arr.length];
      this['h' + (i + 1) + 'y'] = it[0];
      this['h' + (i + 1) + 't'] = clamp(it[1], 13);
    }
  },

  nextHist: function () {
    this.vibrate();
    this.toast('换一批…');
    this.histOffset = this.histOffset + 3;
    this.renderHistRows();
  },

  histTap0: function () { this.openHistDetail(0); },
  histTap1: function () { this.openHistDetail(1); },
  histTap2: function () { this.openHistDetail(2); },

  openHistDetail: function (slot) {
    this.vibrate();
    var arr = this.histAll || [];
    var it = arr[(this.histOffset + slot) % arr.length];
    if (!it) {
      return;
    }
    this.hdYear = it[0];
    this.hdTitle = it[1];
    this.hdMeta = it[0] + (it[3] ? ' · ' + it[3] : '');
    this.hdDesc = clamp(it[2] || '暂无详细描述', 110);
    this.histList = false;
    this.histShow = true;
  },

  histBack: function () {
    this.vibrate();
    this.histList = true;
    this.histShow = false;
  },


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
    if (!this.wordRawTried) {
      this.wordRawTried = true;
      this.loadWordRaw();
    }
    if (!this.wordPage) {
      this.wordPage = this.dayIndex();
    }
    this.renderWord();
  },

  /* 词库扩充包：rawfile/words.json（120 词，rawfile 不占 JS 页面 48KB 体积预算）。
   * ⚠️ 模拟器/Previewer 读 rawfile 可能失败（EnglishDict 实证）→ 静默兜底用内置 40 词，真机读全量 */
  loadWordRaw: function () {
    if (!this.ensureFile()) {
      return;
    }
    var that = this;
    try {
      this.fileApi.readText({
        uri: 'internal://rawfile/words.json',
        success: function (res) {
          try {
            var arr = JSON.parse(String((res && res.text) || ''));
            if (!arr || !arr.length || !arr[0][0] || !arr[0][4]) {
              return;
            }
            WORD_BANK = arr;
            that.renderWord();
            if (that.wordShow) {
              that.refreshWdEx();
            }
          } catch (e) {
          }
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  renderWord: function () {
    var w = WORD_BANK[this.wordPage % WORD_BANK.length] || WORD_BANK[0];
    this.wordText = w[0];
    this.wordPhon = w[1] + ' ' + w[2];
    this.wordMean = clamp(w[3], 22);
    this.wordMeanFull = clamp(w[3], 60);
    this.wordEx = w[4];
    this.wordExZh = w[5] || '';
    this.refreshWdEx();
    this.fetchDict(w[0]);
  },

  refreshWdEx: function () {
    this.wdExAll = this.wordEx + '\n' + (this.wordExZh || '');
  },

  /* 有道词典查询：拿音标 / 中文释义 / 双语例句。
   * 任一字段缺失都保留本地兜底值；整条失败静默不影响显示。 */
  fetchDict: function (word) {
    var that = this;
    if (!word) {
      return;
    }
    this.getJson(CONFIG.DICT_API + encodeURL(word), function (ok, res) {
      if (!ok || !res) {
        return;
      }
      var ec = res.ec || {};
      var w = (ec.word || [])[0] || {};
      /* 音标：优先美音 */
      var phon = fmt(w.usphone || w.ukphone);
      if (phon) {
        that.wordPhon = '/' + phon + '/';
      }
      var means = [];
      var trs = w.trs || [];
      for (var i = 0; i < trs.length; i++) {
        var tr = trs[i].tr || [];
        for (var j = 0; j < tr.length; j++) {
          var l = tr[j].l || {};
          var items = l.i || [];
          for (var k = 0; k < items.length; k++) {
            var it = fmt(items[k]);
            if (it) {
              means.push(it);
            }
          }
        }
      }
      if (means.length) {
        var full = means.join(' ');
        that.wordMeanFull = clamp(full, 60);
        that.wordMean = clamp(full, 22);
      }
      var bp = res.blng_sents_part || {};
      var pairs = bp['sentence-pair'] || [];
      var p0 = pairs[0] || null;
      if (p0 && p0.sentence) {
        that.wordEx = clamp(fmt(p0.sentence), 56);
        that.wordExZh = clamp(fmt(p0['sentence-translation']), 40);
        that.refreshWdEx();
      }
    });
  },

  nextWord: function () {
    this.vibrate();
    this.toast('换一个…');
    this.wordPage = this.wordPage + 1;
    this.renderWord();
  },

  openWordDetail: function () {
    this.vibrate();
    this.refreshWdEx();
    this.wordList = false;
    this.wordShow = true;
  },

  wordBack: function () {
    this.vibrate();
    this.wordList = true;
    this.wordShow = false;
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
    } else if (i === P_HIST) {
      this.loadHist(false);
    } else if (i === P_WORD) {
      this.loadWord(false);
    } else if (i === P_BRIEF) {
      this.loadBrief(false);
    } else if (i === P_CAL) {
      this.loadLunar(false);
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
  }
};

function encodeURL(str) {
  var hex = '0123456789ABCDEF';
  var result = '';
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      c === 45 || c === 46 || c === 95 || c === 126
    ) {
      result += str.charAt(i);
    } else {
      result += '%' + hex[(c >> 4) & 0xF] + hex[c & 0xF];
    }
  }
  return result;
}

/*
 * 选字页 · 独立页（**兼「局域网取件」页**）
 *
 * 两个用途，靠「明确的模式标记」区分（2026-09-30 重构）：
 *   ① 选字：键盘页「更多字」→ 写 nx_pickmode.txt='pick' + nx_pick.txt（候选）→ 本页
 *   ② 取件：首页「局域网绑定」/ 键盘页地址模式确认 → 写 nx_pickmode.txt='fetch' → 本页
 *
 * ⚠️ 重构原因（真机反馈）：旧版靠 nx_code.txt（取件码）有没有内容来分流，
 *    用户在「改地址」填完 IP 回来后该文件是空的 → 被误判成选字模式 → 弹出选字列表，
 *    表现就是「填完地址点确认没连接，反而进了选字界面」。
 *    取件码那条链路（BOX_API 云端信箱）本来就是空的死路，已整体删除，只留局域网直连。
 *
 * 模式来源优先级：路由 params（同步可靠）> nx_pickmode.txt > 默认 'pick'
 *   铁律：零正则 / 裸名 onclick / 回调内用闭包 that（不能用 this）
 */
var FILE_PICK = 'internal://app/nx_pick.txt';
var FILE_PICKRES = 'internal://app/nx_pickres.txt';
var FILE_PICKMODE = 'internal://app/nx_pickmode.txt';   /* 'pick' = 选字 | 'fetch' = 取件 */
var FILE_TOKEN = 'internal://app/nx_token.txt';
var FILE_HOST = 'internal://app/nx_host.txt';

/* 局域网取件：手机/电脑上跑发送端服务，手表访问它的 8123 端口。
 * 地址不写死——用户在手表上点「改地址」输入手机 IP，存到 nx_host.txt */
var LAN_PORT = 8123;

/* 取件失败时的人话提示（把技术错误码翻译成用户能自己排查的三步） */
var TIPS = '①手机App点「开启共享」②手表与手机同一WiFi ③地址和手机显示的一致';

export default {
  data: {
    title: '选字',
    hint: '点一个字上屏',
    list: [],
    backLabel: '返回键盘',
    /* 模式注入位：路由 params 会覆盖它（'pick' | 'fetch'）*/
    mode: '',
    /* true = 选字模式（显示列表）；false = 取件模式（隐藏空列表，避免渲染成黑框）*/
    isPick: true,
    /* true = 取件模式（显示「改地址」按钮）*/
    isFetch: false,
    /* true = 取件失败（显示「重试」按钮）*/
    isFailed: false,
    screenW: '466px',
    screenH: '466px'
  },

  onInit: function () {
    this.applyMetrics();
    var f = null;
    try { f = require('@system.file'); } catch (e) { f = null; }
    this.fileApi = f;
    this.tries = 0;
    if (!f) { this.enterMode('pick'); return; }
    /* params 已经带了明确模式就不用读文件了（少一次异步，少一个竞态点） */
    if (this.mode === 'fetch' || this.mode === 'pick') { this.enterMode(this.mode); return; }
    this.resolveMode();
  },

  /* 没有 params 时，读 nx_pickmode.txt 决定模式；读不到/读到空 → 选字（键盘页是主用途）。
   * ⚠️ 写文件是异步的，刚跳过来可能还没落盘 → 读空时重试；
   *    次数给足（8 次 × 200ms ≈ 1.6s），否则落盘慢时会兜底成选字模式，
   *    表现就是老 bug 重演（填完地址却进了选字界面）。*/
  resolveMode: function () {
    var that = this;
    this.modeTries = (this.modeTries || 0) + 1;
    try {
      this.fileApi.readText({
        uri: FILE_PICKMODE,
        success: function (res) {
          var t = that.trimAll(that.readTextValue(res));
          if (!t && that.modeTries < 8) {
            try { setTimeout(function () { that.resolveMode(); }, 200); } catch (e) { that.enterMode('pick'); }
            return;
          }
          that.enterMode(t === 'fetch' ? 'fetch' : 'pick');
        },
        fail: function () {
          if (that.modeTries < 8) {
            try { setTimeout(function () { that.resolveMode(); }, 200); } catch (e) { that.enterMode('pick'); }
            return;
          }
          that.enterMode('pick');
        }
      });
    } catch (e) { this.enterMode('pick'); }
  },

  readTextValue: function (res) {
    if (!res) { return ''; }
    if (typeof res.text === 'string') { return res.text; }
    if (typeof res === 'string') { return res; }
    return '';
  },

  enterMode: function (mode) {
    this.mode = mode;
    if (mode === 'fetch') {
      this.backLabel = '返回首页';
      this.isPick = false;
      this.isFetch = true;
      this.isFailed = false;
      this.hint = '正在从手机取件…';
      this.doFetch();
      return;
    }
    this.isPick = true;
    this.isFetch = false;
    this.isFailed = false;
    this.hint = '点一个字上屏';
    this.readPick();
  },

  trimAll: function (s) {
    var t = String(s || '');
    var a = 0;
    var b = t.length;
    while (a < b) { var c = t.charCodeAt(a); if (c === 32 || c === 10 || c === 13 || c === 9) { a = a + 1; } else { break; } }
    while (b > a) { var c2 = t.charCodeAt(b - 1); if (c2 === 32 || c2 === 10 || c2 === 13 || c2 === 9) { b = b - 1; } else { break; } }
    return t.substring(a, b);
  },

  /* 局域网取件：读用户填的手机 IP → 请求 /token.json */
  doFetch: function () {
    var that = this;
    this.readHost(function (host) {
      if (!host) {
        that.isFailed = true;
        that.title = '还没填手机地址';
        that.hint = '点下面「改地址」，按手机 App 上显示的数字填';
        return;
      }
      that.fetchUrl('http://' + host + ':' + LAN_PORT + '/token.json');
    });
  },

  /* 读用户填的手机 IP（nx_host.txt）*/
  readHost: function (cb) {
    var that = this;
    try {
      this.fileApi.readText({
        uri: FILE_HOST,
        success: function (res) { cb(that.trimAll(that.readTextValue(res))); },
        fail: function () { cb(''); }
      });
    } catch (e) { cb(''); }
  },

  /* 去键盘页填手机 IP（写模式 'ip'，键盘页只收数字和点号）*/
  editHost: function () {
    try {
      this.fileApi.writeText({ uri: 'internal://app/nx_kbmode.txt', text: 'ip', success: function () {}, fail: function () {} });
      this.fileApi.writeText({ uri: 'internal://app/nx_kbstate.txt', text: '', success: function () {}, fail: function () {} });
    } catch (e) {}
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { return; }
    try { if (typeof r.replace === 'function') { r.replace({ uri: 'pages/kb/index' }); return; } } catch (e) {}
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: 'pages/kb/index' }); } } catch (e) {}
  },

  /* 把 fetch 的失败码翻译成人话（码只放末尾，先让用户看到能做的事）*/
  humanErr: function (code) {
    var c = (code === null || code === undefined || code === '') ? '' : String(code);
    if (c === '' || c === '0') { return '连不上手机：' + TIPS; }
    return '连不上手机（错误码 ' + c + '）：' + TIPS;
  },

  fetchUrl: function (url) {
    var that = this;
    this.title = '取件中…';
    this.hint = '正在连手机…';
    try {
      var f = require('@system.fetch');
      f.fetch({
        url: url,
        method: 'GET',
        success: function (res) {
          var raw = res ? res.data : null;
          var obj = null;
          if (raw && typeof raw === 'object') { obj = raw; }
          else { try { obj = JSON.parse(String(raw)); } catch (e) { obj = null; } }
          if (obj && obj.token) {
            var tk = String(obj.token);
            /* 防线：真 JWT 至少一两百字符；太短必然是假的/被截断（2026-09-27 取到过 40 字符假串）*/
            if (tk.length < 100) { that.endFetch('取到的内容不像 Token（只有 ' + tk.length + ' 字符）', '手机那边可能还没登录好，回手机 App 重新抓一次'); return; }
            try {
              that.fileApi.writeText({ uri: FILE_TOKEN, text: String(obj.token), success: function () {}, fail: function () {} });
            } catch (e) {}
            that.endFetch('取件成功 ✓ ' + tk.length + ' 字符', '');
            return;
          }
          that.endFetch('手机那边没有可取的 Token', '先在手机 App 里点「抓取 Token」再试');
        },
        /* lite 的 fetch 失败回调带 code（如 1003 = 明文 http 不被允许）*/
        fail: function (res, code) {
          var c = (code === null || code === undefined) ? '' : String(code);
          var why = '';
          if (c === '1003') { why = '系统不允许明文 http，需要在发送端改用 https'; }
          that.endFetch('连不上手机', (why ? why + '；' : '') + TIPS + (c ? '（错误码 ' + c + '）' : ''));
        }
      });
    } catch (e) { this.endFetch('取件功能不可用', '本机运行时不支持联网模块'); }
  },

  endFetch: function (msg, hint) {
    this.title = msg;
    this.hint = hint || '';
    /* 取件模式用完就复位模式标记：避免下次「更多字」误入取件流程 */
    try { this.fileApi.writeText({ uri: FILE_PICKMODE, text: '', success: function () {}, fail: function () {} }); } catch (e) {}
    /* 只有成功才自动回首页；失败留在本页 → 用户能看清原因、改地址、重试 */
    if (msg.indexOf('成功') < 0) {
      this.isFailed = true;
      return;
    }
    var that = this;
    try { setTimeout(function () { that.back(); }, 1200); }
    catch (e) { this.back(); }
  },

  /* 失败后原地重试（用当前已填的地址）*/
  retryFetch: function () {
    this.isFailed = false;
    this.title = '重试中…';
    this.doFetch();
  },

  /* 读候选文件：kb 页是「写完就跳」，写又是异步的 → 读空就重试几次 */
  readPick: function () {
    var that = this;
    this.tries = (this.tries || 0) + 1;
    try {
      this.fileApi.readText({
        uri: FILE_PICK,
        success: function (res) {
          var t = that.readTextValue(res);
          if (!t && that.tries < 8) {
            try { setTimeout(function () { that.readPick(); }, 250); } catch (e) { that.setList([]); }
            return;
          }
          that.setList(t ? t.split('\n') : []);
        },
        fail: function () {
          if (that.tries < 8) {
            try { setTimeout(function () { that.readPick(); }, 250); } catch (e) { that.setList([]); }
            return;
          }
          that.setList([]);
        }
      });
    } catch (e) { this.setList([]); }
  },

  setList: function (arr) {
    var items = [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i]) { items.push({ t: arr[i], id: i }); }
    }
    this.list = items;
    this.title = '选字 · 共 ' + items.length + ' 个';
    this.hint = items.length ? '点一个字上屏' : '没有候选字，点下面返回';
  },

  applyMetrics: function () {
    var that = this;
    var dev = null;
    try { dev = require('@system.device'); } catch (e) { dev = null; }
    if (!dev || !dev.getInfo) { return; }
    try {
      dev.getInfo({
        success: function (d) {
          var w = (d && d.windowWidth) ? d.windowWidth : 466;
          var h = (d && d.windowHeight) ? d.windowHeight : 466;
          that.screenW = w + 'px';
          that.screenH = h + 'px';
        },
        fail: function () {}
      });
    } catch (e) {}
  },

  /* 点某项 → 写选择 → 回键盘页
   * HML 里用 onclick="pick($item.t)" 直接把文本传进来（list-item 的事件里没有 index） */
  pick: function (arg) {
    var ch = '';
    if (typeof arg === 'string') { ch = arg; }
    else if (arg && typeof arg.index === 'number' && this.list[arg.index]) { ch = this.list[arg.index].t; }
    if (!ch) { return; }
    try {
      if (this.fileApi) {
        /* 回键盘页前把模式标记写成选字，避免残留 'fetch' 让下次误入取件 */
        this.fileApi.writeText({ uri: FILE_PICKMODE, text: 'pick', success: function () {}, fail: function () {} });
        this.fileApi.writeText({
          uri: FILE_PICKRES,
          text: ch,
          success: function () {},
          fail: function () {}
        });
      }
    } catch (err) {}
    /* 等结果文件落盘再回（异步写） */
    var that = this;
    try {
      setTimeout(function () { that.back(); }, 250);
    } catch (e) {
      this.back();
    }
  },

  back: function () {
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { return; }
    var uri = (this.mode === 'fetch') ? 'pages/index/index' : 'pages/kb/index';
    try { if (typeof r.replace === 'function') { r.replace({ uri: uri }); return; } } catch (e) {}
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: uri }); } } catch (e) {}
  }
};

/*
 * 选字页 · 独立页
 * 进入：键盘页「更多字」→ 写 nx_pick.txt（全部候选，每行一个）+ nx_kbstate.txt（键盘现场）→ 本页
 * 完成：选中 → 写 nx_pickres.txt → replace 回 pages/kb/index（键盘页读存档恢复现场并上屏）
 * ⚠️ $app 在本机运行时不生效 → 一律走文件；铁律：零正则 / 裸名 onclick / list+for+tid
 */
var FILE_PICK = 'internal://app/nx_pick.txt';
var FILE_PICKRES = 'internal://app/nx_pickres.txt';
var FILE_CODE = 'internal://app/nx_code.txt';   /* 取件码（'LAN' = 走局域网）*/
var FILE_TOKEN = 'internal://app/nx_token.txt';

/* ===== 「取件码绑定」两个地址（改这里就行）=====
 * BOX_API：部署 tools/box-server 后的云函数 URL 化地址（结尾不带斜杠）
 * LAN_API：PC 上跑 tools/lan-share.py 的地址（同一 Wi-Fi 时用，见该脚本打印）*/
var BOX_API = '';
/* 局域网：手机/电脑上跑发送端服务，手表访问它的 8123 端口。
 * ⚠️ 地址不再写死——用户在手表上点「改地址」输入手机 IP，存到 nx_host.txt */
var LAN_HOST_DEFAULT = '';   /* 空 = 必须先在手表上填手机 IP（别再塞默认值去撞）*/
var LAN_PORT = 8123;
var FILE_HOST = 'internal://app/nx_host.txt';

export default {
  data: {
    title: '选字',
    list: [],
    backLabel: '返回键盘',
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
    if (!f) { this.setList([]); return; }
    /* 分流：nx_code.txt 有内容 = 取件流程，否则 = 选字流程 */
    this.checkMode();
  },

  checkMode: function () {
    var that = this;
    try {
      this.fileApi.readText({
        uri: FILE_CODE,
        success: function (res) {
          var t = '';
          if (res) {
            if (typeof res.text === 'string') { t = res.text; }
            else if (typeof res === 'string') { t = res; }
          }
          t = that.trimAll(t);
          if (t) { that.mode = 'fetch'; that.backLabel = '返回首页'; that.isPick = false; that.isFetch = true; that.isFailed = false; that.doFetch(t); return; }
          that.mode = 'pick';
          that.isPick = true;
          that.readPick();
        },
        fail: function () { that.mode = 'pick'; that.readPick(); }
      });
    } catch (e) { this.mode = 'pick'; this.readPick(); }
  },

  trimAll: function (s) {
    var t = String(s || '');
    var a = 0;
    var b = t.length;
    while (a < b) { var c = t.charCodeAt(a); if (c === 32 || c === 10 || c === 13 || c === 9) { a = a + 1; } else { break; } }
    while (b > a) { var c2 = t.charCodeAt(b - 1); if (c2 === 32 || c2 === 10 || c2 === 13 || c2 === 9) { b = b - 1; } else { break; } }
    return t.substring(a, b);
  },

  /* 取件：'LAN' 走局域网地址（读用户填的 IP），否则走云端信箱的 /get */
  doFetch: function (code) {
    var that = this;
    if (code === 'LAN') {
      this.readHost(function (host) {
        if (!host) {
          that.isFailed = true;
          that.title = '先在「改地址」里填手机上显示的 IP';
          return;
        }
        that.fetchUrl('http://' + host + ':' + LAN_PORT + '/token.json');
      });
      return;
    }
    if (!BOX_API) { this.endFetch('没配置取件地址'); return; }
    this.fetchUrl(BOX_API + '/get?code=' + code);
  },

  /* 读用户填的手机 IP（nx_host.txt），读不到就用默认值 */
  readHost: function (cb) {
    var that = this;
    try {
      this.fileApi.readText({
        uri: FILE_HOST,
        success: function (res) {
          var t = '';
          if (res) {
            if (typeof res.text === 'string') { t = res.text; }
            else if (typeof res === 'string') { t = res; }
          }
          cb(that.trimAll(t) || LAN_HOST_DEFAULT);
        },
        fail: function () { cb(LAN_HOST_DEFAULT); }
      });
    } catch (e) { cb(LAN_HOST_DEFAULT); }
  },

  /* 去键盘页填手机 IP */
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

  fetchUrl: function (url) {
    var that = this;
    this.title = '取件中…';
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
            if (tk.length < 100) { that.endFetch('Token 太短（' + tk.length + ' 字符）'); return; }
            try {
              that.fileApi.writeText({ uri: FILE_TOKEN, text: String(obj.token), success: function () {}, fail: function () {} });
              that.fileApi.writeText({ uri: FILE_CODE, text: '', success: function () {}, fail: function () {} });
            } catch (e) {}
            that.endFetch('取件成功 ✓ ' + tk.length + ' 字符');
            return;
          }
          that.endFetch((obj && obj.msg) ? ('失败：' + obj.msg) : '取件失败，请重试');
        },
        /* lite 的 fetch 失败回调带 code（如 1003 = 明文 http 不被允许）→ 显示出来便于定位 */
        fail: function (res, code) { that.endFetch('连不上 (code ' + code + ')'); }
      });
    } catch (e) { this.endFetch('取件不可用'); }
  },

  endFetch: function (msg) {
    this.title = msg;
    /* ⚠️ 无论成败都清空取件码文件：否则残留会让下次「更多字」误入取件流程 */
    try { this.fileApi.writeText({ uri: FILE_CODE, text: '', success: function () {}, fail: function () {} }); } catch (e) {}
    /* 只有成功才自动回首页；失败留在本页 → 用户能看清错误、改地址、重试 */
    if (msg.indexOf('成功') < 0) {
      this.isFailed = true;
      return;
    }
    var that = this;
    try { setTimeout(function () { that.back(); }, 900); }
    catch (e) { this.back(); }
  },

  /* 失败后原地重试（用当前已填的地址）*/
  retryFetch: function () {
    this.isFailed = false;
    this.title = '重试中…';
    this.doFetch('LAN');
  },

  /* 读候选文件：kb 页是「写完就跳」，写又是异步的 → 读空就重试几次 */
  readPick: function () {
    var that = this;
    this.tries = (this.tries || 0) + 1;
    try {
      this.fileApi.readText({
        uri: FILE_PICK,
        success: function (res) {
          var t = '';
          if (res) {
            if (typeof res.text === 'string') { t = res.text; }
            else if (typeof res === 'string') { t = res; }
          }
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

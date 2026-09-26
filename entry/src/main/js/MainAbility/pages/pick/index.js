/*
 * 选字页 · 独立页
 * 进入：键盘页「更多字」→ 写 nx_pick.txt（全部候选，每行一个）+ nx_kbstate.txt（键盘现场）→ 本页
 * 完成：选中 → 写 nx_pickres.txt → replace 回 pages/kb/index（键盘页读存档恢复现场并上屏）
 * ⚠️ $app 在本机运行时不生效 → 一律走文件；铁律：零正则 / 裸名 onclick / list+for+tid
 */
var FILE_PICK = 'internal://app/nx_pick.txt';
var FILE_PICKRES = 'internal://app/nx_pickres.txt';

export default {
  data: {
    title: '选字',
    list: [],
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
    this.readPick();
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
    try { if (typeof r.replace === 'function') { r.replace({ uri: 'pages/kb/index' }); return; } } catch (e) {}
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: 'pages/kb/index' }); } } catch (e) {}
  }
};

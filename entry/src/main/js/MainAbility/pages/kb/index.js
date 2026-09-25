/*
 * 自研 Token 键盘（B 方案）· 独立页
 * 进入：index「输入 Token」→ router.replaceUrl('/pages/kb/index')
 * 完成：把输入写入 internal://app/nx_token.txt → replaceUrl 回 index（onShow 自动读取生效）
 * 铁律：零正则 / 裸名 onclick / 键位静态节点（无 for）
 */

var KB_PAGES = [
  'ABCDEFGHIJKLMNOPQRST',
  'UVWXYZ0123456789-_.',
  'abcdefghijklmnopqrst',
  'uvwxyz0123456789-.'
];
var FILE_TOKEN = 'internal://app/nx_token.txt';

export default {
  data: {
    kbBuf: '',
    kbPage: 0,
    kbView: '点下方键盘输入',
    kbCnt: '0 字符',
    k0: '', k1: '', k2: '', k3: '', k4: '',
    k5: '', k6: '', k7: '', k8: '', k9: '',
    k10: '', k11: '', k12: '', k13: '', k14: '',
    k15: '', k16: '', k17: '', k18: '', k19: '',
    fileApi: null,
    routerApi: null,
    vibratorApi: null,
    busy: false,
    /* 尺寸自适应（圆表 466×466 / 方表 408×480） */
    screenW: '466px',
    screenH: '466px',
    rowW: '440px',
    keyW: '80px'
  },

  onInit: function () {
    this.applyMetrics();
    this.renderKb();
    this.renderKbView();
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
          that.rowW = (w - 26) + 'px';
          that.keyW = Math.floor((w - 46) / 5) + 'px';
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  ensureFile: function () {
    if (this.fileApi) { return true; }
    try { this.fileApi = require('@system.file'); } catch (e) { this.fileApi = null; }
    return !!this.fileApi;
  },

  ensureRouter: function () {
    if (this.routerApi) { return true; }
    try { this.routerApi = require('@system.router'); } catch (e) { this.routerApi = null; }
    return !!this.routerApi;
  },

  ensureVibrator: function () {
    if (this.vibratorApi) { return true; }
    try { this.vibratorApi = require('@system.vibrator'); } catch (e) { this.vibratorApi = null; }
    return !!this.vibratorApi;
  },

  vibrate: function () {
    if (!this.ensureVibrator()) { return; }
    try { this.vibratorApi.vibrate({ mode: 'short' }); } catch (e) { }
  },

  renderKb: function () {
    var page = KB_PAGES[this.kbPage] || '';
    for (var i = 0; i < 20; i++) {
      this['k' + i] = page.charAt(i);
    }
  },

  renderKbView: function () {
    var t = this.kbBuf;
    var n = t.length;
    if (n > 14) {
      this.kbView = '…' + t.substring(n - 14);
    } else {
      this.kbView = n ? t : '点下方键盘输入';
    }
    this.kbCnt = n + ' 字符';
  },

  kbAppend: function (ch) {
    if (!ch) { return; }
    this.kbBuf = this.kbBuf + ch;
    this.renderKbView();
  },

  keyTap0: function () { this.vibrate(); this.kbAppend(this.k0); },
  keyTap1: function () { this.vibrate(); this.kbAppend(this.k1); },
  keyTap2: function () { this.vibrate(); this.kbAppend(this.k2); },
  keyTap3: function () { this.vibrate(); this.kbAppend(this.k3); },
  keyTap4: function () { this.vibrate(); this.kbAppend(this.k4); },
  keyTap5: function () { this.vibrate(); this.kbAppend(this.k5); },
  keyTap6: function () { this.vibrate(); this.kbAppend(this.k6); },
  keyTap7: function () { this.vibrate(); this.kbAppend(this.k7); },
  keyTap8: function () { this.vibrate(); this.kbAppend(this.k8); },
  keyTap9: function () { this.vibrate(); this.kbAppend(this.k9); },
  keyTap10: function () { this.vibrate(); this.kbAppend(this.k10); },
  keyTap11: function () { this.vibrate(); this.kbAppend(this.k11); },
  keyTap12: function () { this.vibrate(); this.kbAppend(this.k12); },
  keyTap13: function () { this.vibrate(); this.kbAppend(this.k13); },
  keyTap14: function () { this.vibrate(); this.kbAppend(this.k14); },
  keyTap15: function () { this.vibrate(); this.kbAppend(this.k15); },
  keyTap16: function () { this.vibrate(); this.kbAppend(this.k16); },
  keyTap17: function () { this.vibrate(); this.kbAppend(this.k17); },
  keyTap18: function () { this.vibrate(); this.kbAppend(this.k18); },
  keyTap19: function () { this.vibrate(); this.kbAppend(this.k19); },

  kbDel: function () {
    this.vibrate();
    var t = this.kbBuf;
    if (t.length) {
      this.kbBuf = t.substring(0, t.length - 1);
      this.renderKbView();
    }
  },

  kbPageNext: function () {
    this.vibrate();
    this.kbPage = this.kbPage + 1;
    if (this.kbPage >= 4) { this.kbPage = 0; }
    this.renderKb();
  },

  kbCancel: function () {
    this.vibrate();
    if (!this.ensureRouter()) { return; }
    this.routerApi.replaceUrl({ uri: 'pages/index/index' });
  },

  kbDone: function () {
    this.vibrate();
    var t = this.kbBuf;
    if (!t || t.length < 20) {
      /* 用本页的提示条（复用 kbCnt 位置会闪，走 systemPrompt 不存在——直接改 kbView） */
      this.kbView = 'Token 太短或未输入';
      return;
    }
    if (!this.ensureFile()) {
      this.kbView = '文件模块不可用';
      return;
    }
    var that = this;
    this.busy = true;
    try {
      this.fileApi.writeText({
        uri: FILE_TOKEN,
        text: t,
        success: function () {
          that.busy = false;
          that.kbView = '已保存，返回生效';
          if (that.ensureRouter()) {
            that.routerApi.replaceUrl({ uri: 'pages/index/index' });
          }
        },
        fail: function () {
          that.busy = false;
          that.kbView = '保存失败，请重试';
        }
      });
    } catch (e) {
      this.busy = false;
      this.kbView = '保存失败，请重试';
    }
  }
};

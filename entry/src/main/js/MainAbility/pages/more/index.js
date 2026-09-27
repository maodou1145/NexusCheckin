/*
 * 更多内容 · 独立页（每日英语 / 历史上的今天 / 每日简报 —— 从首页拆出）
 * 为什么单独一页：首页编译产物会让 DevEco 自带 SDK 的 jerry-snapshot 爆堆
 *   （ERR_OUT_OF_MEMORY，两个 SDK 的内存开销不同），把这三屏（23 个方法 + 3 屏 HML ≈ 13KB）
 *   拆成独立预算后，首页即可通过快照生成。
 * 进入：首页「更多内容」入口屏 → 写 nx_more.txt（word / hist / brief）→ 本页按它决定首屏
 * 铁律：零正则 / 裸名 onclick / try-catch 包住引擎差异
 */
var MORE = {
  BRIEF: 'https://60s-api.viki.moe/v2/60s',
  HIST: 'https://60s-api.viki.moe/v2/today_in_history',
  DICT: 'https://dict.youdao.com/jsonapi?q='
};
var FILE_MORE = 'internal://app/nx_more.txt';

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

export default {
  data: {
    screenW: '466px',
    screenH: '466px',
    showWord: false,
    showHist: false,
    showBrief: false,
    switchLabelText: '每日英语',
    histList: true,
    histShow: false,
    h1y: '', h1t: '正在获取…',
    h2y: '', h2t: '',
    h3y: '', h3t: '',
    histInfo: '',
    hdTitle: '',
    hdMeta: '',
    hdDesc: '',
    wordList: true,
    wordShow: false,
    wordText: '',
    wordPhon: '',
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
    loadedHist: false,
    loadedWord: false,
    histOffset: 0,
    histAll: [],
    wordPage: 0,
    wordRawTried: false,
    briefAll: [],
    briefOffset: 0,
    loadedBrief: false,
    toastText: '',
    toastShow: false,
    toastTop: '402px',
    toastW: '466px'
  },

  onInit: function () {
    this.applyMetrics();
    var that = this;
    this.pick = 'word';
    if (this.ensureFile()) {
      try {
        this.fileApi.readText({
          uri: FILE_MORE,
          success: function (res) {
            var t = '';
            if (res) {
              if (typeof res.text === 'string') { t = res.text; }
              else if (typeof res === 'string') { t = res; }
            }
            t = (t || '');
            var _c = '', _i = 0;
            while (_i < t.length) {
              var _ch = t.charAt(_i);
              if (_ch !== ' ' && _ch !== '\t' && _ch !== '\n' && _ch !== '\r') { _c = _c + _ch; }
              _i = _i + 1;
            }
            t = _c;
            if (t === 'hist' || t === 'brief' || t === 'word') { that.pick = t; }
            that.enter();
          },
          fail: function () { that.enter(); }
        });
      } catch (e) { this.enter(); }
    } else { this.enter(); }
  },

  /* 按 pick 显示对应面板并加载数据 */
  enter: function () {
    this.showWord = (this.pick === 'word');
    this.showHist = (this.pick === 'hist');
    this.showBrief = (this.pick === 'brief');
    this.switchLabelText = (this.pick === 'word') ? '历史上的今天'
      : (this.pick === 'hist') ? '每日简报' : '每日英语';
    if (this.showWord) { this.loadWord(false); }
    else if (this.showHist) { this.loadHist(false); }
    else { this.loadBrief(false); }
  },

  /* 循环切换三屏 */
  switchPanel: function () {
    this.vibrate();
    if (this.showWord) { this.pick = 'hist'; }
    else if (this.showHist) { this.pick = 'brief'; }
    else { this.pick = 'word'; }
    this.enter();
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
          that.toastW = w + 'px';
          that.toastTop = (h - 64) + 'px';
        },
        fail: function () {}
      });
    } catch (e) {}
  },

  go: function (uri) {
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { this.toast('路由不可用'); return; }
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: uri }); return; } } catch (e) {}
    try { if (typeof r.replace === 'function') { r.replace({ uri: uri }); } } catch (e) {}
  },

  back: function () {
    this.vibrate();
    this.go('pages/index/index');
  },

  dayIndex: function () {
    var now = new Date();
    var y = now.getFullYear() || 2026;
    var m = now.getMonth() + 1;
    var d = now.getDate();
    return (y * 372 + m * 31 + d) % WORD_BANK.length;
  },

  refreshWdEx: function () {
    this.wdExAll = this.wordEx + '\n' + (this.wordExZh || '');
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

  ensureApi: function () {
    if (this.fetchApi) { return true; }
    try { this.fetchApi = require('@system.fetch'); } catch (e) { this.fetchApi = null; }
    return !!this.fetchApi;
  },

  getJson: function (url, cb) {
    if (!this.ensureApi()) {
      cb(false, '联网模块不可用');
      return;
    }
    this.fetchApi.fetch({
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

  vibrate: function () {
    if (!this.vibratorApi) {
      try { this.vibratorApi = require('@system.vibrator'); } catch (e) { this.vibratorApi = null; }
    }
    if (!this.vibratorApi) {
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

  loadBrief: function (force) {
    var that = this;
    if (this.loadedBrief && !force) {
      return;
    }
    this.loadedBrief = true;
    if (force) {
      this.briefOffset = 0;
    }
    this.getJson(MORE.BRIEF, function (ok, res) {
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
    this.getJson(MORE.HIST, function (ok, res) {
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

  fetchDict: function (word) {
    var that = this;
    if (!word) {
      return;
    }
    this.getJson(MORE.DICT + encodeURL(word), function (ok, res) {
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
};

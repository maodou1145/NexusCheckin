/*
 * 每日黄历 · 独立页（从首页拆出）
 * 为什么单独一页：首页 JS 编译产物逼近 jerry-snapshot 工具的 64KB 堆上限（超了就生成不出 .bc 快照），
 * 把黄历这一屏（解析 3.2KB + 整屏 HML/CSS）拆成独立预算，首页体积立刻回落。
 * 进入：首页「今日黄历」屏 → 点「查看完整黄历」→ 本页
 * 数据：60s API /v2/lunar（免 token，约 6.4KB）
 *       公历/农历/干支/生肖/纳音/宜忌/节气/法定节假日/月相/星座/运势/八字
 * 铁律：零正则 / 裸名 onclick / try-catch 包住引擎差异
 */
var LUNAR_API = 'https://60s-api.viki.moe/v2/lunar';
var CAL_PAGES = 3;

function fmt(v) {
  return (v === undefined || v === null || v === '') ? '--' : String(v);
}

function clamp(s, n) {
  var t = String(s === null || s === undefined ? '' : s);
  if (t.length > n) {
    return t.substring(0, n - 1) + '...';
  }
  return t;
}

export default {
  data: {
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
    screenW: '466px',
    screenH: '466px',
    toastText: '',
    toastShow: false,
    toastTop: '402px',
    toastW: '466px'
  },

  onInit: function () {
    this.calIdx = 0;
    this.loadedCal = false;
    this.applyMetrics();
    this.loadLunar(true);
  },

  onShow: function () {
    /* 从详情页/键盘页回来时兜底刷新一次（首次进页 onInit 已加载） */
    this.loadLunar(false);
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

  ensureApi: function () {
    if (this.fetchApi) { return true; }
    try { this.fetchApi = require('@system.fetch'); } catch (e) { this.fetchApi = null; }
    return !!this.fetchApi;
  },

  getJson: function (url, cb) {
    if (!this.ensureApi()) { cb(false, '联网模块不可用'); return; }
    try {
      this.fetchApi.fetch({
        url: url,
        method: 'GET',
        header: { Accept: 'application/json' },
        success: function (res) {
          var raw = res ? res.data : null;
          var obj = null;
          if (raw && typeof raw === 'object') { obj = raw; }
          else { try { obj = JSON.parse(String(raw)); } catch (e) { obj = null; } }
          if (obj) { cb(true, obj); } else { cb(false, 'HTTP ' + (res ? res.code : 0)); }
        },
        fail: function (res, code) { cb(false, '网络失败 ' + code); }
      });
    } catch (e) { cb(false, '请求异常'); }
  },

  vibrate: function () {
    if (!this.vibratorApi) {
      try { this.vibratorApi = require('@system.vibrator'); } catch (e) { this.vibratorApi = null; }
    }
    if (!this.vibratorApi) { return; }
    try { this.vibratorApi.vibrate({ mode: 'short' }); } catch (e) {}
  },

  toast: function (msg) {
    this.toastText = String(msg || '');
    this.toastShow = true;
    var that = this;
    try {
      setTimeout(function () { that.toastShow = false; }, 1500);
    } catch (e) { this.toastShow = false; }
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

  /* ── 获取 + 解析 ── */
  loadLunar: function (force) {
    var that = this;
    if (this.loadedCal && !force) { return; }
    this.loadedCal = true;
    this.calDate = '正在获取…';
    this.getJson(LUNAR_API, function (ok, res) {
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

    var tags = [];
    var lh = d.legal_holiday || {};
    if (lh.name) { tags.push(fmt(lh.name) + (lh.is_work ? '·班' : '·休')); }
    var tm = d.term || {};
    if (tm.today && tm.today.name) { tags.push('今日' + fmt(tm.today.name)); }
    else if (tm.stage && tm.stage.name) { tags.push('节气·' + fmt(tm.stage.name)); }
    var fe = d.festival || {};
    if (fe.both_desc) { tags.push(fmt(fe.both_desc)); }
    this.calFest = tags.join(' · ');

    this.calGood = '宜  ' + good;
    this.calBad = '忌  ' + bad;

    /* ── 详情第 1 页：基本信息 ── */
    var hName = fmt(tbh.hour) || fmt(lu.hour_desc);
    this.calP1 = fmt(so.full) + ' ' + fmt(so.week_desc) + '\n'
      + fmt(lu.full_with_hour) + '\n'
      + '第 ' + fmt(st.day_of_year) + ' 天 · 年度 ' + fmt(pf.year) + '\n\n'
      + '【干支】' + fmt((cy.year || {}).name) + ' ' + fmt((cy.month || {}).name) + '\n'
      + '       ' + fmt((cy.day || {}).name) + ' ' + fmt((cy.hour || {}).name) + '\n'
      + '【生肖】' + fmt(zz.year) + '年 ' + fmt(zz.month) + '月 ' + fmt(zz.day) + '日 ' + fmt(zz.hour) + '时\n'
      + '【纳音】' + fmt(ny.year) + ' ' + fmt(ny.month) + '\n'
      + '       ' + fmt(ny.day) + ' ' + fmt(ny.hour) + '\n'
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
  }
};

/*
 * 应用市场页（更多应用 / 应用详情 / 订单列表 / 订单详情 / 购买 / 构建）
 * 进入：index「更多应用」/「更多订单」→ router.replace('pages/store/index')，导航意图经 nx_nav.txt 传递
 * 返回：router.replace('pages/index/index')，回程屏位经 nav 文件回传
 * 铁律：零正则 / 裸名 onclick / 无 for 动态节点（列表 6 槽静态 + listBase 平移）
 */

var ORIGIN = 'https://ws.fseatech.cn';
var API_BASE = ORIGIN + '/api';
var RESULT_MAX = 46;

var KB_RATE = 0.12;   /* 1 积分 = 0.12 元（站点计价） */

/* ── 工具 ── */
function fmt(v) {
  if (v === null || v === undefined) { return '-'; }
  return String(v);
}
function cut(s, n) {
  var t = String(s === null || s === undefined ? '' : s);
  if (t.length > n) { return t.substring(0, n - 1) + '…'; }
  return t;
}
function clamp(s, n) {
  var t = String(s === null || s === undefined ? '' : s);
  if (t.length > n) { return t.substring(0, n - 1) + '…'; }
  return t;
}
function humanNum(v) {
  var e = Number(v);
  if (!e && e !== 0) { return '-'; }
  if (e >= 10000) { return Math.round(e / 1000) / 10 + '万'; }
  return String(e);
}
function stripWs(s) {
  var e = String(s === null || s === undefined ? '' : s);
  var out = '';
  for (var i = 0; i < e.length; i++) {
    var c = e.charCodeAt(i);
    if (c === 13 || c === 10 || c === 9 || c === 32) { continue; }
    out += e.charAt(i);
  }
  return out;
}

export default {
  data: {
    token: '',
    points: 0,
    deviceId: 0,
    deviceName: '',
    deviceModel: '',
    busy: false,
    buying: false,

    /* 视图：vList=应用列表  vDetail=应用详情  vOrd=订单列表  vOdD=订单详情 */
    vList: true,
    vDetail: false,
    vOrd: false,
    vOdD: false,

    /* 应用列表（6 静态槽 + listBase 平移） */
    l1n: '', l1d: '', l1p: '',
    l2n: '', l2d: '', l2p: '',
    l3n: '', l3d: '', l3p: '',
    l4n: '', l4d: '', l4p: '',
    l5n: '', l5d: '', l5p: '',
    l6n: '', l6d: '', l6p: '',
    listBase: 0,
    listCount: 0,
    listPageText: '',
    listSwiperIdx: 0,
    listIdx: 0,

    /* 应用详情 */
    dName: '', dDev: '', dDesc: '', dMeta: '', dPoints: '',
    dOwned: false,
    dBtn: '积分兑换', dResult: '',
    dBuild: '', dBuildShow: false,
    dConfirm: false,
    detailApp: null,

    /* 订单列表（3 行 + 翻页） */
    o1n: '', o1s: '',
    o2n: '', o2s: '',
    o3n: '', o3s: '',
    orderInfo: '',
    orderPage: 0,
    orders: [],
    purchased: [],
    loadedOrders: false,
    loadedPurchased: false,
    recList: [],
    allApps: [],
    ownedIds: [],

    /* 订单详情 */
    odNo: '', odApp: '', odVer: '', odDevice: '', odSign: '',
    odStatus: '', odPay: '', odCreated: '',
    odBuild: '', odBuildShow: false, odBuildBtn: '开始构建',
    detailOrder: null,

    /* 尺寸自适应（圆表 466×466 / 方表 408×480） */
    screenW: '466px',
    screenH: '466px',
    rowW: '440px',
    keyW: '80px',

    fileApi: null,
    routerApi: null,
    vibratorApi: null
  },

  onInit: function () {
    this.applyMetrics();
    this.readNav();
    this.loadToken();
    this.loadPurchased(false);
    this.loadOrders(false);
    this.loadRecommend();
    this.loadDevice();
  },

  /* ── 导航：index 写 nx_nav.txt（apps / orders）→ 本页 onInit 读；返回时写 back=N ── */
  readNav: function () {
    if (!this.ensureFile()) { return; }
    var that = this;
    try {
      this.fileApi.readText({
        uri: 'internal://app/nx_nav.txt',
        success: function (res) {
          var t = '';
          if (res && typeof res.text === 'string') { t = res.text; }
          t = stripWs(t);
          if (t.indexOf('back:') === 0) {
            /* 回程：恢复 index 的屏位（写回 back=N 给 index 读） */
            that.writeNav(t);
            return;
          }
          if (t.indexOf('orders') >= 0) {
            that.showView('ord');
          }
          /* apps / 空 → 默认应用列表，无需处理 */
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  writeNav: function (content) {
    if (!this.ensureFile()) { return; }
    try {
      this.fileApi.writeText({ uri: 'internal://app/nx_nav.txt', text: content });
    } catch (e) {
    }
  },

  backToIndex: function () {
    this.vibrate();
    if (!this.ensureRouter()) { return; }
    /* 把来时的屏位写给 index（index onInit 读 back=N 恢复） */
    var back = this.navBack ? ('back:' + this.navBack) : 'back:0';
    this.writeNav(back);
    try {
      this.routerApi.replaceUrl({ uri: 'pages/index/index' });
    } catch (e) {
    }
  },

  /* ── 基础设施 ── */

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

  /* ── 网络封装（回调式；POST 需 CSRF 双提交） ── */

  ensureApi: function () {
    if (this.fetchApi) { return true; }
    try { this.fetchApi = require('@system.fetch'); } catch (e) { this.fetchApi = null; }
    return !!this.fetchApi;
  },

  /* ── 网络串行队列（同 index；真机并发 fetch 会卡死） ── */
  fetchQueued: function (options, onDone) {
    if (!this.q) { this.q = []; }
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
      header['X-CSRF-Token'] = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      header['Cookie'] = 'csrf_token=a1b2c3d4e5f60718293a4b5c6d7e8f90';
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
          try { obj = JSON.parse(String(raw)); } catch (e) { obj = null; }
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

  /* ── 工具 ── */

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
    total = Math.round(total * 100) / 100;
    var fixed = parseInt(g('redeem_points_cost', 'redeemPointsCost'), 10) || 0;
    var fullOnly = (g('full_redeem_only', 'fullRedeemOnly') === true || g('full_redeem_only', 'fullRedeemOnly') === 1);
    var pts = 0;
    if (fullOnly && fixed > 0) {
      pts = fixed;
    } else if (total > 0) {
      pts = Math.ceil(total / KB_RATE);
      if (pts < 1) { pts = 1; }
    }
    return { total: total, points: pts };
  },

  orderStatusText: function (st) {
    var t = String(st === null || st === undefined ? '' : st);
    if (t === 'paid') { return '已支付'; }
    if (t === 'pending') { return '待支付'; }
    if (t === 'cancelled') { return '已取消'; }
    return t === '' ? '未知' : t;
  },

  dayOf: function (iso) {
    var t = String(iso === null || iso === undefined ? '' : iso);
    return t.length >= 10 ? t.substring(5, 10) : '';
  },

  /* ── Token（文件读取，index 写入本页使用） ── */

  loadToken: function () {
    if (!this.ensureFile()) { return; }
    var that = this;
    try {
      this.fileApi.readText({
        uri: 'internal://app/nx_token.txt',
        success: function (res) {
          var t = '';
          if (res && typeof res.text === 'string') { t = res.text; }
          t = stripWs(t);
          if (t) { that.token = t; that.refreshInfo(); }
        },
        fail: function () {
        }
      });
    } catch (e) {
    }
  },

  refreshInfo: function () {
    var that = this;
    if (!this.token) { return; }
    this.request('GET', '/points/info', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data) { return; }
      var d = res.data || {};
      that.points = (d.points === undefined || d.points === null) ? 0 : d.points;
      if (that.detailApp) { that.renderDetail(); }
    });
  },

  /* ── 设备（下单必须 deviceId） ── */

  loadDevice: function () {
    var that = this;
    if (this.deviceId || !this.token) { return; }
    this.request('GET', '/device/list', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data || !res.data.length) { return; }
      var d = res.data[0];
      for (var i = 0; i < res.data.length; i++) {
        if (res.data[i].isDefault) { d = res.data[i]; break; }
      }
      that.deviceId = d.id;
      that.deviceName = d.modelName || d.name || '';
      that.deviceModel = d.model || '';
    });
  },

  /* ── 应用列表（/app/list 全量 → 按设备过滤 → 按下载量降序） ── */

  loadRecommend: function () {
    var that = this;
    if (this.recList && this.recList.length) { return; }
    this.request('GET', '/app/list?page=1&pageSize=200', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data || !res.data.length) { return; }
      that.allApps = res.data;
      that.rebuildAppList();
    });
  },

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
    this.renderListPage();
  },

  renderListPage: function () {
    var arr = this.recList || [];
    this.listCount = arr.length;
    var base = this.listBase;
    var names = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
    for (var i = 0; i < 6; i++) {
      var a = arr[base + i];
      var pre = names[i];
      if (a) {
        var pr = this.calcPrice(a);
        var owned = this.ownedIds.indexOf(a.id) >= 0;
        this[pre + 'n'] = fmt(a.name);
        this[pre + 'd'] = (a.developer || '') + ' · ' + humanNum(a.downloads) + '次下载';
        this[pre + 'p'] = owned ? '已拥有' : (pr.points > 0 ? pr.points + ' 积分' : '0 积分');
      } else {
        this[pre + 'n'] = '';
        this[pre + 'd'] = '';
        this[pre + 'p'] = '';
      }
    }
    if (!arr.length) {
      this.listPageText = '没有可兑换的应用';
    } else {
      var to = base + 6;
      if (to > arr.length) { to = arr.length; }
      this.listPageText = (base + 1) + '-' + to + ' · 共 ' + arr.length + ' 个';
    }
  },

  onListChange: function (e) {
    var i = -1;
    if (e) {
      if (typeof e.index === 'number') { i = e.index; }
      else if (typeof e.currentIndex === 'number') { i = e.currentIndex; }
    }
    if (i >= 0) { this.listIdx = i; }
  },

  listPrev: function () {
    this.vibrate();
    if (this.listBase <= 0) {
      this.listPageText = '已经是第一页';
      return;
    }
    this.listBase = this.listBase - 6;
    this.listSwiperIdx = 0;
    this.renderListPage();
  },

  listNext: function () {
    this.vibrate();
    if (this.listBase + 6 >= this.listCount) {
      this.listPageText = '已经是最后一页';
      return;
    }
    this.listBase = this.listBase + 6;
    this.listSwiperIdx = 0;
    this.renderListPage();
  },

  cardTap0: function () { this.vibrate(); this.openAppDetailAt(this.listBase + 0); },
  cardTap1: function () { this.vibrate(); this.openAppDetailAt(this.listBase + 1); },
  cardTap2: function () { this.vibrate(); this.openAppDetailAt(this.listBase + 2); },
  cardTap3: function () { this.vibrate(); this.openAppDetailAt(this.listBase + 3); },
  cardTap4: function () { this.vibrate(); this.openAppDetailAt(this.listBase + 4); },
  cardTap5: function () { this.vibrate(); this.openAppDetailAt(this.listBase + 5); },

  /* ── 应用详情 ── */

  openAppDetailAt: function (i) {
    var a = (this.recList || [])[i];
    if (!a) { return; }
    this.detailApp = a;
    this.renderDetail();
    this.showDetail();
  },

  showView: function (v) {
    this.vList = (v === 0);
    this.vDetail = (v === 1);
    this.vOrd = (v === 2);
    this.vOdD = (v === 3);
  },

  showDetail: function () { this.showView(1); },
  showList: function () { this.showView(0); },
  showOrd: function () { this.showView(2); },
  showOdD: function () { this.showView(3); },

  renderDetail: function () {
    var a = this.detailApp;
    if (!a) { return; }
    var pr = this.calcPrice(a);
    var canPts = (a.allow_points_redeem === undefined) ? a.allowPointsRedeem : a.allow_points_redeem;
    this.dName = a.name || '';
    this.dDev = (a.developer || '') + ' · ' + humanNum(a.downloads) + '次下载';
    this.dDesc = clamp(a.description || '-', 66);
    this.dMeta = 'v' + (a.version || '') + ' · ' + (a.size || '') + ' · 评分 ' + (a.rating || '-');
    this.dPoints = '兑换需 ' + pr.points + ' 积分 · 我的积分 ' + this.points;
    this.dOwned = this.ownedIds.indexOf(a.id) >= 0;
    this.dConfirm = false;
    this.dBuildShow = false;
    this.dBuild = '';
    if (this.dOwned) {
      this.dBtn = '刷新构建';
      this.dResult = '已在已购列表 · 点按钮查看构建状态';
      this.dBuildShow = true;
      this.refreshBuild();
    } else if (canPts === false) {
      this.dBtn = '不支持积分兑换';
      this.dResult = '请到手机端购买';
    } else {
      this.dBtn = pr.points + ' 积分兑换';
      this.dResult = '点下面按钮兑换';
    }
  },

  /* 详情页金色按钮：已拥有 → 刷新构建；未拥有 → 购买 */
  dGoldTap: function () {
    this.vibrate();
    if (this.dOwned) {
      this.refreshBuild();
      return;
    }
    this.dBuy();
  },

  dBuy: function () {
    var a = this.detailApp;
    if (!a || this.buying) { return; }
    if (this.ownedIds.indexOf(a.id) >= 0) {
      this.dResult = '已经拥有这个应用了';
      return;
    }
    var cost = this.calcPrice(a).points;
    if (this.points < cost) {
      this.dResult = '积分不足：需 ' + cost + '，现有 ' + this.points;
      return;
    }
    if (!this.deviceId) {
      this.dResult = '未读取到设备，稍后再试';
      this.loadDevice();
      return;
    }
    if (!this.dConfirm) {
      this.dConfirm = true;
      this.dBtn = '再点一次确认';
      this.dResult = '将消耗 ' + cost + ' 积分，再点一次确认';
      return;
    }
    var that = this;
    this.buying = true;
    this.dBtn = '下单中…';
    this.purchaseApp(a, function (stage, ok, msg, order) {
      if (stage === 'create') {
        that.dResult = ok ? '订单已创建，正在兑换…' : clamp('下单失败：' + msg, RESULT_MAX);
        if (!ok) { that.buying = false; that.dConfirm = false; that.dBtn = '积分兑换'; }
        return;
      }
      that.buying = false;
      that.dConfirm = false;
      if (ok && order && order.status === 'paid') {
        that.dBtn = '刷新构建';
        that.dOwned = true;
        that.ownedIds.push(a.id);
        that.dResult = '兑换成功！可查看构建状态';
        that.dBuildShow = true;
        that.refreshBuild();
        that.loadedOrders = false;
      } else {
        that.dBtn = '积分兑换';
        that.dResult = clamp(msg || '兑换未完成', RESULT_MAX);
      }
    });
  },

  /* 购买核心：create → pay → status（站点只收积分） */
  purchaseApp: function (app, onStep) {
    var that = this;
    var body = {
      appId: app.id,
      deviceId: this.deviceId,
      signingType: 'auto',
      useCoupon: false,
      usePoints: 0,
      usePointsRedeem: true,
      orderType: 'app'
    };
    this.request('POST', '/order/create', body, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data || !res.data.id) {
        onStep('create', false, (res && res.message) ? (res.message || '') : '', null);
        return;
      }
      var oid = res.data.id;
      onStep('create', true, '', res.data);
      that.request('POST', '/order/pay', { orderId: oid, paymentMethod: 'alipay' }, function (ok2, res2) {
        if (!ok2 || res2.code !== 0) {
          onStep('final', false, (res2 && res2.message) ? (res2.message || '') : '', null);
          return;
        }
        that.request('GET', '/order/status/' + oid, null, function (ok3, res3) {
          var st = (ok3 && res3.code === 0 && res3.data) ? res3.data.status : 'paid';
          onStep('final', st === 'paid', '订单状态：' + st, { status: st, id: oid });
        });
      });
    });
  },

  /* ── 构建状态 ── */

  refreshBuild: function () {
    var o = this.detailOrder;
    var a = this.detailApp;
    var oid = null;
    if (o) {
      oid = o.id;
    } else if (a) {
      var pur = this.purchased || [];
      for (var i = 0; i < pur.length; i++) {
        if (pur[i].id === a.id) { oid = pur[i].orderId; break; }
      }
    }
    if (!oid || !this.token) { return; }
    var that = this;
    this.request('GET', '/order/build/status/' + oid, null, function (ok, res) {
      var d = (ok && res.code === 0) ? res.data : null;
      var txt;
      if (!d) {
        txt = '尚未开始构建';
      } else {
        txt = '构建：' + (d.status || d.state || '进行中');
        if (d.progress !== undefined && d.progress !== null) {
          txt = txt + ' · ' + d.progress + '%';
        }
      }
      if (that.detailOrder) { that.odBuild = txt; that.odBuildShow = true; }
      if (that.detailApp) { that.dBuild = txt; that.dBuildShow = true; }
    });
  },

  ordBuildTap: function () {
    var o = this.detailOrder;
    this.vibrate();
    if (!o || this.buying) { return; }
    var that = this;
    if (this.odBuildBtn !== '开始构建') {
      this.refreshBuild();
      return;
    }
    this.buying = true;
    this.odBuildBtn = '提交中…';
    this.request('POST', '/order/build/start', { orderId: o.id }, function (ok, res) {
      that.buying = false;
      that.odBuildBtn = '刷新构建';
      if (!ok || res.code !== 0) {
        that.odBuild = clamp('构建提交失败：' + ((res && res.message) ? res.message : ''), RESULT_MAX);
        that.odBuildShow = true;
        return;
      }
      that.refreshBuild();
    });
  },

  /* ── 订单列表 + 详情 ── */

  loadOrders: function (force) {
    var that = this;
    if (this.loadedOrders && !force) { return; }
    this.loadedOrders = true;
    if (!this.token) { return; }
    this.request('GET', '/order/list', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data) { return; }
      that.orders = res.data;
      that.orderPage = 0;
      that.renderOrderRows();
    });
  },

  loadPurchased: function (force) {
    var that = this;
    if (this.loadedPurchased && !force) { return; }
    this.loadedPurchased = true;
    if (!this.token) { return; }
    this.request('GET', '/order/purchased', null, function (ok, res) {
      if (!ok || res.code !== 0 || !res.data) { return; }
      var arr = res.data;
      that.purchased = arr;
      var ids = [];
      for (var i = 0; i < arr.length; i++) { ids.push(arr[i].id); }
      that.ownedIds = ids;
      that.renderListPage();
      if (that.detailApp) { that.renderDetail(); }
    });
  },

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
        var pay = String(o.paymentMethod || '');
        var payText = '积分';
        if (pay === 'signing_coupon') { payText = '签名券'; }
        else if (pay === 'alipay') { payText = '支付宝'; }
        else if (pay === 'activation_code') { payText = '激活码'; }
        else if (pay && pay !== 'points') { payText = pay; }
        this[pre + 'n'] = cut(o.appName || '', 16);
        this[pre + 's'] = this.dayOf(o.createdAt) + ' · ' + this.orderStatusText(o.status) + ' · ' + payText;
      } else {
        this[pre + 'n'] = '';
        this[pre + 's'] = '';
      }
    }
    this.orderInfo = '共 ' + arr.length + ' 笔 · 点订单看详情';
  },

  moreOrders: function () {
    this.vibrate();
    var arr = this.orders || [];
    var pages = Math.ceil(arr.length / 3) || 1;
    this.orderPage = this.orderPage + 1;
    if (this.orderPage >= pages) { this.orderPage = 0; }
    this.renderOrderRows();
  },

  ordTap0: function () { this.openOrderDetailAt(this.orderPage * 3 + 0); },
  ordTap1: function () { this.openOrderDetailAt(this.orderPage * 3 + 1); },
  ordTap2: function () { this.openOrderDetailAt(this.orderPage * 3 + 2); },

  openOrderDetailAt: function (i) {
    var o = (this.orders || [])[i];
    if (!o) { return; }
    this.detailOrder = o;
    this.odNo = cut(o.id || '', 30);
    this.odApp = o.appName || '';
    this.odVer = 'v' + (o.appVersion || '');
    this.odDevice = o.deviceModelName || '';
    this.odSign = (o.signingType === 'auto') ? '自动签名' : '手动签名';
    this.odStatus = this.orderStatusText(o.status);
    var pay = String(o.paymentMethod || '');
    var payText = '积分';
    if (pay === 'signing_coupon') { payText = '签名券'; }
    else if (pay === 'alipay') { payText = '支付宝'; }
    else if (pay === 'activation_code') { payText = '激活码'; }
    else if (pay && pay !== 'points') { payText = pay; }
    this.odPay = payText;
    var c = String(o.createdAt || '');
    this.odCreated = (c.length >= 16 ? c.substring(0, 10) + ' ' + c.substring(11, 16) : c);
    this.odBuildShow = (o.status === 'paid');
    this.odBuildBtn = '开始构建';
    this.odBuild = '';
    this.showOdD();
    if (o.status === 'paid') {
      this.refreshBuild();
    }
  }
};

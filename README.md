# Nexus 签到 · 每日一点（Lite Wearable · API 10）

一块手表上的「每日一点」小应用：**每日签到 + 幸运大转盘 / 每日一句 / 应用推荐 / 购买应用 / 我的订单 / 我的**，
竖向滑动翻页，**Token 走 A 方案：用户私聊发给作者，作者打包时写进源码**。

技术栈：HarmonyOS **Lite Wearable / JS FA / HML + CSS + JS**，`compatibleSdkVersion = 4.0.0(10)`，
网络只走 `@system.fetch`。

> **2026-09-25 变更**：原「内置螃蟹键盘、让用户自己在手表上输 Token」的 **B 方案已撤除**
> （键盘页、键盘素材、相关路由代码全部删除），改回 **A 方案**。

---

## 一、它现在是什么

竖向 `swiper` **四屏**，上下滑动换屏；屏内按钮随屏滑动，各自绑 `onclick`：

| 屏 | 内容 | 按钮 | 数据来源 |
|---|---|---|---|
| 1/6 | 每日签到 + 幸运大转盘 | 立即签到 / 开始抽奖 | `GET/POST /api/points/*` |
| 2/6 | 每日一句 | 换一句 | 一言 API `v1.hitokoto.cn`（公开免费） |
| 3/6 | 应用推荐 | 换一批 | `GET /api/app/hot`（公开，无需 Token） |
| 4/6 | 购买应用 | 换一个 / 积分兑换（**两段确认**） | `POST /api/order/create` + `/order/pay` |
| 5/6 | 我的订单 | 刷新 | `GET /api/order/list` |
| 6/6 | 我的 | 无（信息 + 「Token 请私聊发作者」） | `GET /api/user/info` |

背景是**固定一张内置必应图**（`common/wall/bing.png`），按设备窗口尺寸铺满。

> ⚠️ **事件前缀必须用裸名**：`onclick` / `onchange` 可以，`grab:click` / `on:click` **不行**。
> 详见第六节 6.1h —— 这是 2026-09-25 用 `hdc` + `uitest` 在设备上实测出来的。

---

## 二、Token 怎么进手表：**A 方案（唯一路径）**

终端用户把 Token **私聊发给作者**，作者用脚本出一个「已经绑定好账号」的包：

```bat
tools\pack-for-user.bat <token> "昵称"              :: 单个
tools\pack-for-user.bat --file tools\用户列表.txt   :: 批量（每行「昵称,token」，# 开头是注释）
```

脚本会：**① 先联网验证 token 有效**（无效就不打包，省得白干）→ ② 复制工程到 `dist/<昵称>_<时间戳>/`
（**源工程永远干净**）→ ③ 在副本里按 `<<< PACK-TOKEN` / `<<< PACK-OWNER` 标记注入 → ④ 写 `打包信息.txt`。
然后你用 DevEco 打开副本 → 配签名 → Build → 把 hap 发给对方。
「我的」屏会显示对方昵称、Token 状态显示「已绑定」，方便确认。

面向用户的取 Token 教程在 `docs/`：
- `docs/如何获取Token.html`（手机浏览器打开，带一键复制，全浏览器分诊）
- `docs/如何获取Token.md`（纯文字版，发群发帖用）
- `tools/get-token-bookmarklet.txt`（可单独复制的书签脚本）

> 为什么不做「用户在表上自己输」：手表没有键盘、lite 上引第三方输入法又受 `stack` 定位与事件前缀限制，
> 实测「按不动」。A 方案零输入、零依赖，是最稳的。

---

## 三、接口清单（**已实测确认**）

基址 `https://ws.fseatech.cn/api`，响应统一 `{code, message, data}`，`code === 0` 才算成功。

| 用途 | 方法 | 路径 | 关键字段 |
|---|---|---|---|
| 积分/签到状态 | GET | `/points/info` | `points` `coupons` `checkedInToday` `consecutiveDays` `luckyWheelEnabled` `luckyWheelAvailable` |
| 签到 | POST | `/points/checkin` | `pointsEarned` `experienceEarned` `couponReward` `leveledUp` `level` |
| 幸运大转盘 | POST | `/points/lucky-wheel/spin` | `message` |
| 用户信息 | GET | `/user/info` | `nickname` `level` `experience` `levelProgress` |
| 热门应用 | GET | `/app/hot` | `name` `developer` `downloads` `description` |

**鉴权两道**：`Authorization: Bearer <token>`；**POST 还要 CSRF 双提交** ——
`Cookie: csrf_token=<V>` 且 `X-CSRF-Token: <V>`，两值一致。实测服务端**只校验两值相等**，
不校验该值是否由它下发过，**所以自造一个固定值即可，不需要先 GET 读 Set-Cookie**。

---

## 四、🔴 事件绑定：**必须用裸名 `onclick`**（2026-09-25 设备实测）

这是本项目的第二个大坑，现象是「**所有按钮都点不动**」，包括原来的「设置 Token」。

**怎么发现的（可复现）**：设备连着 `hdc`，用系统自带的 `uitest` 把布局树抠出来看：

```bash
hdc shell uitest dumpLayout -p /data/local/tmp/a.json
hdc file recv /data/local/tmp/a.json a.json     # attributes.clickable 告诉你事件到底注册了没
```

| 写法 | 布局树 `clickable` | 注入点击 | 结论 |
|---|---|---|---|
| `onclick="fn"`（裸名，绑在 swiper 上） | **true** | **生效**（列表变「加载中…」） | ✅ 唯一可用写法 |
| `grab:click="fn"`（按钮上） | **false** | 毫无反应 | ❌ 事件没注册 |
| `on:click="fn"` | false | 毫无反应 | ❌ 事件没注册 |

**修复后的实测证据**（`hdc shell uitest uiInput click` 注入触摸）：

| 操作 | 结果 |
|---|---|
| 点屏 1 的「立即签到」 | 文案从「请私聊作者绑定」→「**尚未绑定 Token**」（正是 `doCheckin` 无 Token 时的赋值） |
| 点屏 3 的「换一批」 | 列表从 gm消消乐/2048新版 → **扫雷/棋类游戏/螃蟹Acto** |
| 布局树复查 | 按钮 `div [89,337][376,384] **click=true**` |

**两条编译链都不会报这个问题**（HML 语法完全合法），所以已做成静态检查：
`tools/precheck.py` 会扫出任何带 `grab:` / `on:` 前缀的事件属性并报 FAIL。

---

## 五、体积账（重要，别踩坑）

lite 编译产物里，**每张 PNG 都会附带一份未压缩位图 `.bin`，大小 = 宽 × 高 × 4 字节**。
所以图片「看起来 12KB」，进包其实 848KB：

| 项 | 最初 | 现在 |
|---|---|---|
| 壁纸 | 6 张 466×466 → **5.09 MB** | 1 张 466×466 → **0.87 MB** |
| 键盘素材 | 2.10 MB | **已删除 → 0** |
| JS 产物 | 54 KB | **29 KB** |
| **产物合计（lite_source）** | **≈ 7.5 MB** | **≈ 1.5 MB** |

**单页 JS 红线 48KB（真机加载上限）实测结果**：

| 页面 | 产物 | 判定 |
|---|---|---|
| `pages/index/index.js` | **19.6 KB** | ✅ 余量充足（唯一页面） |

---

## 五、体积账（重要，别踩坑）

lite 编译产物里，**每张 PNG 都会附带一份未压缩位图 `.bin`，大小 = 宽 × 高 × 4 字节**。
所以图片「看起来 12KB」，进包其实是 848KB：

| 项 | 优化前 | 优化后 |
|---|---|---|
| 壁纸（6 张） | 466×466 → **5.09 MB** | 240×240 → **1.32 MB** |
| 键盘图 | 含中文布局、原尺寸 → **2.10 MB** | 删中文布局 + 缩到 42px/键 → **0.99 MB** |
| JS 产物 | 54 KB | 54 KB |
| **产物合计** | **≈ 7.5 MB** | **≈ 2.76 MB** |

**单页 JS 红线 48KB（真机加载上限）实测结果**：

| 页面 | 产物 | 判定 |
|---|---|---|
| `pages/index/index.js` | **18.7 KB** | ✅ 余量充足 |
| `pages/keyboard_rect/keyboard.js` | **33.9 KB** | ✅ 未超 48KB（业务码约 18.6KB，也在 ~31KB 安全线内） |

---

## 六、Lite Wearable 硬约束与对应做法

| 约束 | 本工程做法 |
|---|---|
| `@ohos.net.http` 不存在 | 只用 `@system.fetch` |
| `@system.fetch` 无 Promise / async-await | 全回调式封装 `request(method, path, body, cb)` |
| 🔴 **真机并发多个 fetch 会卡死**（模拟器无感） | **网络串行队列**：`fetchQueued/pumpQueue`，一次只发一个，回调完才放行下一个；20s 看门狗防挂死堵队列 |
| 🔴 **串行仍卡死**：lite 回调可能是同步派发，直接 pump 变递归连发；且 131KB 响应会撑爆弱小 JS 堆 | `finish` 里 **setTimeout 放行**（栈先展开）；**/app/list 改分页**（每页 20 个 ≈ 26KB，翻到底自动拉下一页）；index 推荐屏改用 /app/hot（约 13KB） |
| `image.src` **只支持本地路径**，不支持网络 URL | 壁纸内置；应用推荐只显示文字，不做图标 |
| 🔴 **事件必须用裸名**：`onclick`/`onchange` ✅；`grab:click`/`on:click` ❌ 不注册 | 全工程**零前缀事件**；`tools/precheck.py` 静态拦截；见第四节 |
| `@system.fetch` 的 `responseType` **只有 text/json** | 不尝试下载二进制图片（下载网络壁纸在 lite 上不可行） |
| 🔴 **JS 里不能出现正则表达式字面量**（`/.../ `） | 用 `charCodeAt` 逐字符判断代替；见 6.1 第二轮 |
| swiper 屏内 div 的 click 可能被手势吞掉 | 两路并用：按钮各自 `onclick` + swiper 自身 `onclick` 按 `curIdx` 兜底 |
| 🔴 **`swiper` 不能包含 `list`**（官方父子结构约束，违反则**整页不渲染=黑屏**） | **全工程零 `list`**；列表内容一律 `div` 堆叠 |
| 🔴 **`list`/滚动组件在 lite 真机本身渲染不可靠** | 同上——应用推荐 3 条、我的 5 行都用 `div` 卡片 |
| swiper **默认黑底** | swiper 上写死 `style="background-color: #0b0b10;"` + CSS `.swiper` 同色兜底 |
| `class="{{x}}"` 数据绑定编译报错 | 状态只换文案，不换 class |
| `position` 不可用；`stack` 子元素默认绝对定位 | 整页纯 flex；用 `stack` 做「壁纸垫底 + 内容在上」的层叠 |
| 容器不给固定高度可能整块不渲染 | 所有容器都给固定 `width` + `height`（含 `text`，防算 0 尺寸） |
| 不用 `for` / `if` / `===` 比较（求稳） | 应用推荐 3 条、我的 5 行都**预计算成固定字段** |
| `list-item` 只能有一个子节点（00308018） | 全工程零 `list`，此坑目前不再触发；预检保留该规则 |
| 无 `button` 组件 | 按钮 = `div` 色块 + 内层 `text`，`div` 上绑 `onclick` |
| `Date` 不可靠 | 用 `try/catch` 包住，取不到就退回第 0 张壁纸 |
| `@system.storage` 回调不可靠 + 值 <128B | Token 走源码内置（A 方案）+ `@system.file` 文件兜底读取 |
| 🔴 **8 位颜色是 `#AARRGGBB`（alpha 在前）**，不是 web 的 #RRGGBBAA | 写反不报错、渲染成诡异深色（toast 黑条实锤）；拿不准就用 6 位不透明色 |

### 6.1 🔴 黑屏修复记录（2026-09-24，真机实证）

首版真机**整屏全黑**（连标题都不显示）。根因是**四条叠加**，且**ace-loader 与 hvigor 都不报错**：

| # | 根因 | 修法 |
|---|---|---|
| ① **主因** | 第 5/6 屏把 `<list>` 放进了 `<swiper>` —— 官方父子结构硬约束「`swiper` 不支持包含 `list`」，整页不渲染 | 全部换成 `div` 卡片 |
| ② | `swiper` 默认黑底，且旧版没在 swiper 上写背景色 → 与根底 `#0b0b10` 叠成纯黑 | swiper 写死 inline 背景 + CSS 同色兜底 |
| ③ | 部分 `text` 只给 `width` 没给 `height` → lite 算 0 尺寸，文字不可见 | 补齐（含 `s-hint` / `my-k` / `my-v` / `rec-*`） |
| ④ | 内容宽 440px 超出圆屏安全弦长（466 圆屏内接矩形仅 ~330px） | 收到 400 / 360px |

**关键教训**：这类错误**两条编译链都不会报**（`list` 在 `swiper` 里既不是语法错也不是资源错），
只能靠 `tools/precheck.py` 静态检查 + 真机验证。**改完 HML/CSS 先跑 precheck，再上真机。**

### 6.1b 🔴🔴 真凶其实是**正则表达式**（第二轮，读日志才找到）

第一轮修完后**仍然黑屏**。这次不猜了，直接读引擎日志：

```
[D:/.../DevEcoStudio6.1/log/previewer.log]
[ACELite][ERROR]:[Error message too long]              ← 真实错误被引擎截断
[ACELite][ERROR]:Eval JS file failed                   ← 页面 JS 求值失败
[ACELite][ERROR]: [JS Error]: TypeError: wrong type of argument
[ACELite][ERROR]:Nothing to render as it is undefined. ← 没有 rootComponent = 全黑
```

**`Eval JS file failed` 说明是 JS 层的问题，HML/CSS 全查错了方向。**

定位手段（**SDK 自带引擎本体**，在 `ace-loader/bin/jerry.exe`）：

```bash
# 直接问引擎：这段代码你能不能解析？
jerry.exe --parse-only out/pages/index/index.js
```

实测结果，一针见血：

```
Script Error: SyntaxError: Regexp is not supported in the selected profile. [index.js:3:10830]
```

**lite 引擎是裁剪版 JerryScript，其编译 profile 关掉了正则表达式** —— 页面里只要有一个正则字面量，
**整个页面的 JS 都求值失败 → rootComponent 为 undefined → 全黑**。

`index.js` 里有 **3 处** `/[\r\n\t ]/g`（用来清理 Token 里的空白），改成 `charCodeAt` 循环：

```js
function stripWs(s) {            /* 去掉 \r \n \t 和空格 —— 不能用正则！ */
  var t = String(s === null || s === undefined ? '' : s);
  var out = '';
  for (var i = 0; i < t.length; i++) {
    var c = t.charCodeAt(i);
    if (c === 13 || c === 10 || c === 9 || c === 32) { continue; }
    out += t.charAt(i);
  }
  return out;
}
```

修完再问一次引擎：`app.js` / `index.js` / `keyboard.js` **全部 `[ OK ]`** ✅

> **为什么这么难抓**：ace-loader 与 hvigor **都用 Node(V8) 解析 JS**，正则对 V8 天经地义，
> 所以两条链都 SUCCESS；报错只在**引擎**里，而引擎的错误消息还被 `[Error message too long]` 吞了。
>
> **结论（已固化为工具）**：改完 JS 必须跑 `tools/jerry-check.py`（见 7.6），
> 它用 jerry.exe 对**编译产物**做引擎级语法体检 —— 这是唯一能在上机前抓住这类问题的办法。

**两轮修复的关系**：第一轮的 4 条（`swiper` 含 `list`、swiper 黑底、`text` 缺 height、超宽）
**都是真问题、也都该修**，但**不是黑屏的主因**；主因是正则。所以两层检查都要有：
`precheck.py` 管结构/样式，`jerry-check.py` 管 JS 语法兼容性。

### 6.1c 第三轮改动：四屏重构 + 键盘修复 + 必应壁纸

**① 界面重构（6 屏 → 4 屏）**

| 改动 | 说明 |
|---|---|
| ❌ 删除「每日壁纸」屏 | 该功能整体并入全局背景（见下） |
| ✅ 签到 + 大转盘 **合并为一屏** | 两个按钮并排 |
| ✅ **全局必应每日壁纸** | 所有界面共用一张背景 |

**② 架构调整：按钮移出 swiper（技能库实证要求）**

一屏要放两个按钮，而「swiper 内 div 的 click 会被滑动手势吞掉」，
技能库对多按钮场景的可靠做法是：**swiper 屏内只放展示文字，按钮放屏外**。
所以本页改成：

```
<stack class="root">            ← 根用 stack（不是 div），为了层叠背景
  ├─ image.bg-img  ×2           ← 壁纸：内置层（永远显示）+ 动态层（if hasDynamic）
  ├─ div.bg-mask                ← 压暗遮罩
  ├─ swiper ×4 屏               ← 只放展示文字
  ├─ div.action ×4（if p0~p3）  ← 操作按钮，按当前屏切换；每屏只渲染一个
  └─ text.pagebar               ← 页码（兼作渲染探针）
</stack>
```

**为什么根用 `stack`**：lite 不支持 `position`/`z-index`，而 **`stack` 的子元素默认绝对层叠**——
这是做「背景垫底 + 内容在上」的官方手段，层级靠**声明顺序**决定。

**③ 🔴 圆屏可视区（本轮最有价值的发现）**

圆屏半径 233，**y 处的可见半宽 = √(233² − (233−y)²)**：

| y（距顶） | 可见横向区间 | 可用宽 |
|---|---|---|
| 24 | x∈[130,336] | 206 |
| 68 | x∈[84,382] | 298 |
| 233（中心） | x∈[0,466] | 466 |
| 387 | x∈[58,408] | 350 |
| 422 | x∈[97,369] | 272 |

**越靠上下边缘，横向可用越窄。** 本页据此排布：
`swiper(left43 top60 380×258)` / `action(left103 top325 260×62)` / `pagebar(left113 top398 240×24)`，
屏内文字宽一律 ≤290。

**④ 必应每日壁纸（含动态拉取）**

```
底层：/common/wall/bing.png     ← 内置（编译期打包）→ 永远有背景，绝不空屏
上层：{{bgSrc}} if hasDynamic   ← 启动时 fetch 必应 JSON → 拿图 URL → fetch 图片 → 写 internal://app/
```

- 数据源：`https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN`
  （实测可用，返回 `images[0].url`，拼 `https://www.bing.com` 前缀即为图片，331KB / image/jpeg）
- 用一个 `CONFIG.BING_DYNAMIC` 开关可整体关掉动态拉取。
- ⚠️ **动态那层是"尽力而为"**：`responseType: 'arraybuffer'` 是尝试性写法
  （SDK 文档只声明了 text/json），且 `image` 能否显示运行时写入的文件也未验证。
  **任何一步失败都只是不显示动态层，内置图仍在** —— 这就是分两层的原因。
- 壁纸 466×466 → 产物里会有一份 **848KB 的未压缩 .bin**（= 宽×高×4，
  编译期 `lite-image2bin.js` 把 PNG 转成 RAW RGBA）。把 6 张旧壁纸删掉换成 1 张，净省 ~0.35MB。

**⑤ 螃蟹键盘修复（4 个问题，全部定位到根因）**

| 症状 | 根因 | 修法 |
|---|---|---|
| **看不到「完成/取消」按钮** | **两个按钮都在圆屏外**：y=16~45 处可见区只有 x∈[115,351]，而 cancel 在 35~104、confirm 在 372~431 | cancel `left 35→120`、confirm `left 372→280`，`.confirm` 的 `top 10→16` |
| **下方是空白** | 面板 `top160 + height236 = 底396`，屏 466 → 下面空 **70px** | 面板 height `236→306`（铺满到 466）；空格/回车键 `top 198→260` 贴近底部 |
| **按下去按键错位** | **HML 里键盘图宽度还写 570/741，而图实际是 466/592** → 被拉伸 1.22 倍显示，视觉位置与判定常量（步长 42px）不一致 | HML 改成 `{{keyType==3?592:466}}`（两处：本体图 + 动画图） |
| 切换提示位置 | 参考旧宽度 546/420 | 改 `keyPos+(keyType==3?620:494)`，与 592/466 对齐 |

> ⚠️ **教训**：「改组件尺寸」必须**成组改** —— 图片、CSS、HML 内联几何、JS 判定常量，四处缺一不可。
> 这次 CSS 和 JS 都改了，偏偏漏了 **HML 里那两处内联 `width`**，导致图被拉伸、点按全错位。

### 6.1d 第四轮：按钮回归屏内 + 头像问候 + 键盘按钮放大

**① 按钮从屏外移回屏内（随屏滑动）**

上一版把按钮放在 swiper 外面（位置固定），滑动时按钮不动、观感割裂。改回屏内：
按钮放在 `.screen` 里随屏滑动，点击用**技能库的「双路径兜底」**：

| 路径 | 做法 |
|---|---|
| 主 | 每个按钮自己绑 `grab:click`（`doCheckin` / `doSpin` / `nextQuote` / `nextRec` / `openKeyboard`） |
| 兜底 | `swiper` 自身绑 `onclick="onScreenTap"`，被手势吞掉时按 `curIdx` 执行该屏主操作 |

两条路走同一批动作函数（内部有 `busy` 锁，重复触发无害）。
签到屏有两个按钮，兜底时按状态择一：`checkinBtn.indexOf('立即') >= 0` → 签到，否则 → 抽奖
（用 `indexOf` 而非正则 —— lite 不支持正则）。

**② 签到屏新增头像 + 问候语**

```
[默认头像 48×48]  用户，早上好！
```

- 未登录（或 `myNick` 为 `未登录`/空/`-`）→ 名字用「**用户**」+ 内置默认头像
- 时段：`5~11 早上` / `11~17 中午` / `其余 晚上`；`Date` 取不到时退化为中性的「你好！」
- 头像 `common/avatar/default.png`（96×96，`tools/gen_avatar.py` 纯 Pillow 生成，bin 仅 36KB）
- 拿真实昵称后（`loadUser` 成功）会刷新问候语

**③ 键盘按钮放大 + 位置校正**

| 元素 | 原来 | 现在 | 为什么 |
|---|---|---|---|
| 空格 / 回车 | 111×33 | **140×42** | 太小不好按 |
| 取消 / 完成 | 69×29 / 59×29 | **88×37 / 76×37** | 同上 |
| 工具栏 / 删除键 | 228×44 / 63×44 | **240×50 / 74×50** | 同上 |

**⚠️ 顺手修掉一个我自己上一版埋的坑**：上一版把空格/回车下移到 `top260` 想"填满面板"，
但**全局 y=416~458 正好落在圆屏底部极窄区（可用宽仅 120px）**，按钮会被裁掉。
已改回 `top200`（全局 360~402，安全区），面板下方留 64px 同色空白（视觉上就是键盘底部，正常）。
顶部按钮同理：`top` 从 14 调到 **30** —— 因为 y=14 时可见区只有 x∈[153,313]，
放不下 88+12+76 的按钮组；y=30 时扩到 x∈[128,338] 才够。

> **规律**：圆屏上 **y<80 和 y>420 两段都别放可点元素**（可用宽 <150px）。
> 可点区域集中在 **y 100~400**。

### 6.1e 第五轮：可切换壁纸 + 头像 fetch 拉取

**① 壁纸可以「换」了**

原来只拉「今天」一张。现在改成**一次拿最近 8 天**，切换不再发请求：

```
BING_API: ...&idx=0&n=8&mkt=zh-CN      ← n=8 一次拿 8 张的 URL
     ↓ getJson
this.wallList = [url0, url1, ... url7] ← 存列表（今天 → 往前 7 天）
     ↓ 下载 list[0]
internal://app/nx_wall_0.jpg           ← **按索引分文件缓存**
```

- 「我的」屏新增 **「换一张壁纸」** 按钮 → `changeWall()`：`wallIdx = (wallIdx+1) % 8`，下载并显示
- 列表还没就绪时点按钮 → 自动补拉一次
- **任何一步失败都保持当前壁纸不动**（不会变空白）

**② 用户头像 fetch 拉取**

数据源是接口里的 `user.avatar`（站点页面原话就是 `src = user.avatar || 默认图`，
用 `pick(d, ['avatar','avatarUrl','headImg','headimg'])` 容错取）：

```
user.avatar（完整 URL / 站内 /xxx.jpg / 相对路径 三种都兼容）
     ↓ fetch(responseType:'arraybuffer')
     ↓ file.writeArrayBuffer
internal://app/nx_avatar.jpg  →  avatarSrc 切换
```

- 拉取失败 / 字段为空 → **保持内置默认头像**（`common/avatar/default.png`）
- 取到真实昵称后问候语一并刷新

> **两层兜底的设计贯穿始终**：壁纸和头像都是「**内置一张 + 动态覆盖**」，
> 所以无论联网、写盘、解码哪一步失败，界面都不会空。

### 6.1f 第六轮：推荐图标 + 从键盘返回恢复屏位 + 键盘触摸链路加固

**① 应用推荐加图标**

接口里 `icon` 是相对路径（实测 `/uploads/icons/1777818230472-dcd7ey.png`）：

```
icon → 拼 ORIGIN → fetch(arraybuffer) → writeArrayBuffer
     → internal://app/nx_app_<槽位>.png → r1i / r2i / r3i
```

卡片改成「图标 44×44 + 名称/开发者」横排；加载中/失败用内置默认图标（`common/appicon/default.png`）。

**② 从键盘返回「从哪来回哪去」**

**先确认一个硬前提**：lite 上 `@system.router` **只有 `replaceUrl`**，
d.ts 里的 `push` / `back` / `clear` 标着 `SystemCapability.ArkUI.ArkUI.Full` —— **那是 Full 版，lite 用不了**。
所以「返回上一页」**没有原生支持**，只能传参模拟：

```
index 第 4 屏点「设置 Token」
   → replaceUrl(keyboard, { ..., backIdx: 4 })
   → 键盘 cancel/done 把 backIdx 原样带回 params
   → index onInit 读到 backIdx → applyScreen(4) + swiperIdx = 4
```

> 不这么做的话：`replaceUrl` 会让 index 页**重建**、`curIdx` 归零 →
> 用户从第 4 屏进键盘，返回后却掉回**第 1 屏**，就是「统一返回同一处」的观感。

**`swiper` 的 index 绑定 `swiperIdx` 而不是 `curIdx`**：
`swiperIdx` 只在「初始化 / 从键盘返回」时设一次，滑动时 `onSwiperChange` **不回写**它 ——
否则 index 与滑动会互相打架（回声）。

**③ 键盘触摸链路加固（发现并修掉 3 个隐患）**

| 隐患 | 说明 | 修法 |
|---|---|---|
| **`touchStart(true)` 参数歧义** | 原版依赖"框架把事件对象追加为第 2 个参数"。API 10 上不保证 → `e` 为 undefined 时 `e.globalX` **抛异常**，整条触摸链路受影响 | 拆成 `touchStartKeyboard(e)` / `touchStartText(e)`（**e 永远是第 1 个参数**）+ `beginTouch(target,e)` |
| 坐标缺失导致 NaN 穿透 | `click` 里若 `e.globalX` 缺失，比较全是 `NaN` → 一路穿透到 `key_en[NaN][NaN]` → 输入 undefined | `click` / `press` / `beginTouch` 开头都加坐标兜底，缺失直接 return |
| **`keyType` 默认值 0 = 中文布局** | 本工程不带拼音词典、也删了 `0.png`。万一路由 params 注入失败（lite 上 params 不可靠），keyType 停 0 → **显示空白键盘** | 默认值改成 **2（大写）** —— 它一个布局就覆盖 JWT 需要的全部字符 |



### 6.1g 第七轮：适配方表 408×480 + 壁纸改固定

**① 壁纸不再联网，固定一张**

按你的要求去掉动态拉取：删掉 `loadWall` / `changeWall` / `downloadWall` 三个方法、
`BING_*` 配置项，以及 `wallList` / `wallIdx` / `bgSrc` / `hasDynamic` 等字段，
还有「我的」屏那个「换一张壁纸」按钮。**只剩内置那一张**（`common/wall/bing.png`）。

**② 适配方表（408×480）—— 之前全是按 466 写死的**

方表和圆表是两个不同的逻辑尺寸，写死 466 在方表上必然溢出。做法：**容器动态、内容固定**。

| 层 | 策略 |
|---|---|
| **容器级**（背景图 / 遮罩 / swiper / 每个 `.screen` / 页码 left） | **由 JS 算**：读 `@system.device` 的 `windowWidth` / `windowHeight`，通过 HML 内联 style 绑定 |
| **内容级**（文字宽 / 卡片 / 按钮） | **固定值**，取**两种表都安全**的尺寸：内容 300、按钮 280 |

**两档实测计算结果**：

| 设备 | 窗口 | screenW/H | swiper 高 | 页码 left | 内容 300 的 x 区间 |
|---|---|---|---|---|---|
| 圆表 GT4 | 466×466 | 466 / 466 | 406 | 133 | [83, 383] |
| 方表 FIT3 | 408×480 | 408 / 480 | 420 | 104 | [54, 354] |

内容靠 `.screen` 的 flex 居中，两种表自动居中；**300 这个宽度对两种表都安全**
（圆表最窄处 y=60 的可见区间是 [78,388]，300 居中即 [83,383] ✓）。

**③ 踩到一个必须避开的写法陷阱**

想动态设尺寸，第一反应会写「宽度: 变量 + px」那种拼法 ——
**但技能库有实证：字符串内嵌花括号会真机渲染异常（黑屏隐患）**。

**正确做法：把单位放进变量本身**，HML 里整串替换：

```js
/* JS：值里已经带单位 */
this.screenW = w + 'px';
this.pagebarLeft = Math.round((w - 200) / 2) + 'px';
```
```html
<!-- HML：纯变量替换，没有拼接 -->
<image class="bg-img" style="width: {{screenW}};height: {{screenH}};top: 0px;left: 0px;" src="/common/wall/bing.png"></image>
```

> 另外 `.screen` 一开始我写成了 `100%` —— 这违反技能库铁律「**内部子元素绝不写百分比**」
> （只有根容器 100% 是特例），已改成同样由 `swiperW / swiperH` 绑定。

### 6.1h 第九轮（2026-09-25）：撤键盘改 A 方案 + **找到「按钮全点不动」的真凶**

用户反馈「真机无法设置 Token、无法调用键盘」。**没有猜，直接把设备当调试器用**：

**① 先把设备当调试器（这套方法以后都能用）**

```bash
# hdc 在 DevEco 的 SDK 里；模拟器/真机都能连
HDC="<DevEco>/sdk/default/openharmony/toolchains/hdc.exe"

"$HDC" list targets                                  # 看设备
"$HDC" shell param get const.product.devicetype      # 设备类型（wearable / liteWearable）
"$HDC" shell bm dump -a | grep <包名>                 # 装了没
"$HDC" shell aa start -a <ability> -b <bundle>       # 启动
"$HDC" shell uitest dumpLayout -p /data/local/tmp/a.json   # ★ 抠布局树（含 clickable！）
"$HDC" file recv /data/local/tmp/a.json a.json       # 注意：路径别写 C:/ 开头，会拼到 cwd 上
"$HDC" shell uitest screenCap -p /data/local/tmp/s.png      # ★ 截图
"$HDC" shell uitest uiInput click 233 300            # ★ 注入点击
"$HDC" shell uitest uiInput swipe 233 420 233 130 800      # ★ 注入滑动
"$HDC" install -r entry/build/.../entry-default-unsigned.hap  # ★ 自己装未签名包（debug 设备可装）
```

**② 真凶：`grab:` / `on:` 前缀事件根本不注册**

`dumpLayout` 里只有 swiper（绑裸名 `onclick`）是 `clickable=true`，**所有 pill 按钮都是 false**；
注入点击时 swiper 的 `onScreenTap` 生效（列表变「加载中…」），按钮毫无反应。
→ 原 crabKeyboard 用的是 `grab:` 前缀（API 6 时代），本工程**全量改成裸名**后按钮全部复活。
（详见第四节，含修复后的对照实测表。）

**③ 按需求撤除键盘，回到 A 方案**

删掉 `pages/keyboard_rect/`、`common/keyboard/`（含 3.9MB 拼音词典的引用、全部 PNG）、
`config.json` 的键盘页注册与 VIBRATE 权限，以及 `index.js` 里 85 行键盘/路由代码
（`openKeyboard` / `consumeKeyboardOut` / `clearKeyboardOut` / `applyParamsToken` / `ensureRouter` /
`FILE_KB_OUT` / `tokenInput` / `backIdx`）。
「我的」屏的「设置 Token」按钮换成一行提示 `Token 请私聊发作者`。

**④ 体积与产物**

| 项 | 之前 | 现在 |
|---|---|---|
| lite 载荷（`lite_source/`） | ≈ 2.6 MB | **1.5 MB** |
| wearable 变体 hap | 0.82 MB | **0.52 MB** |
| 源文件数 | 大量键盘素材 | **8 个** |

**⑤ 顺带纠正的认知**

- 这台「真机」其实是 **DevEco 模拟器**，`const.product.devicetype = wearable`（不是 liteWearable），
  `const.ohos.apiversion = 24` —— 所以它装的是 `entry-default-unsigned.hap`（wearable 变体，
  用 `.abc`/PNG），而不是 lite 变体（`.js`/`.bin`）。`config.json` 同时声明
  `["liteWearable","wearable"]`，DevEco 会按设备装对应的那个。
- 该 hap 里 `module.package = com.example.myapplication`，所以**ability 全名是
  `com.example.myapplication.MainAbility`**；`aa start -a MainAbility` 会报「ability does not exist」，
  得用全名。

### 6.1i 第十轮（2026-09-25 上午）：**头像空白**——`writeArrayBuffer` 写出 0 字节文件

**现象**：问候语旁的头像整块空白（布局树里 `image` 节点**有尺寸** `[82,62][131,111]`，说明不是布局问题，是**图片加载失败**）。

**定位过程（又是设备即调试器）**：

1. `uitest dumpLayout` → image 节点有 bounds → 排除布局；
2. 翻应用沙盒：`internal://app/` 实际落在
   **`/data/app/el2/100/base/<bundle>/haps/entry/files/`**（不是 base 下的 `files/`）；
3. 看到 `nx_avatar.jpg` —— **0 字节**（`ls -la` 直接看尺寸，不用拉文件）。

**根因**：`@system.fetch` 的 `responseType:'arraybuffer'` 在这个运行时**拿不到二进制**
（回调里 `data` 是空对象），而 `file.writeArrayBuffer` 会**「成功」地写出一个 0 字节文件**；
代码却在 success 回调里把 `avatarSrc` 切了过去 → 指向空文件 → 空白。

**修复（套路：先验证，再切换）**：

| 步骤 | 内容 |
|---|---|
| ① `isImageBuffer(buf)` | 长度 ≥512 + 图片魔数（JPEG/PNG/GIF/BMP/WEBP）逐字节比对，**不用正则** |
| ② 通道① | `responseType:'arraybuffer'` → 校验通过才写盘、才切 `avatarSrc` |
| ③ 通道②（兜底） | 不带 responseType 拿**原始字符串** → `charCodeAt` 逐字符还原成 `Uint8Array` → 再校验 → 写盘 |
| ④ 不通过 | **什么都不做**，保持内置默认头像（`common/avatar/default.png`） |

**修复后实测**：头像正常显示（默认头像），沙盒里不再产生新的 0 字节文件，
且顺带修掉了另一个小 bug——「token 异步就绪后，`请私聊作者绑定` 一直残留在签到结果栏」。

> **结论**：在这个运行时上，**「fetch 下载网络图片并显示」实际不可行**（拿不到二进制）。
> 代码里保留双通道是赌后续固件支持；**无论如何界面都不会空白**——这就是「内置垫底 + 动态覆盖」的价值。

### 6.1j 附带：`tools/sync-to-h.py`（**别把作者注入的 Token 同步没了**）

A 方案下 `H://NexusCheckin` 是构建区，作者会把用户 Token 填进 `CONFIG.TOKEN`（`<<< PACK-TOKEN` 标记行）。
如果用整目录覆盖同步，**会把 Token 清成空串**，构建出来的包是「未绑定」版，现象还很隐蔽。

`python tools/sync-to-h.py` 的做法：
1. 先读出 H 盘 `PACK-TOKEN` / `PACK-OWNER` 的现值；
2. 再覆盖 `js/MainAbility/**` + `config.json` + `README.md` + `tools/`（**合并覆盖，不整目录删**）；
3. 最后把第 1 步的值**写回**并核对。

> 另外两个坑：沙盒限制下 Python 不能递归删除 H 盘目录（`SAFE_DELETE_FAIL_CLOSED`），所以必须合并覆盖；
> `hdc file recv` 的目标路径别写 `C:/...` 开头（会被拼到 cwd 上），先 `cd` 再用纯文件名。

### 6.1k 第十一轮（2026-09-25 上午）：新增「购买应用 / 我的订单」+ 一次 `undefined is not callable`

**接口是从站点前端 JS 里挖出来的**（不是猜的）：`assets/order-bymhe-7X.js` 里有完整的订单服务定义，
`Purchase/MyOrders` 等页面共用 `order-zDFezOz-.js` 这个 Pinia store。下单姿势照抄网页端
（`AppDetail` 页里的 `createOrder(appId, deviceId, signingType, useCoupon, 0, usePointsRedeem)`）。

**六屏**：签到+转盘 / 每日一句 / 应用推荐 / **购买应用** / **我的订单** / 我的。

**购买屏要点**：
- 应用列表与「应用推荐」**共用一份**（`recList`），价格/积分用列表自带字段（`redeem_points_cost`），不额外发请求；
- 下单必须带 **deviceId**（`GET /device/list` 取 `isDefault` 那台）；
- **两段确认**：第一下只把按钮变成「再点一次确认」，第二下才真正下单（会真实消耗积分）；
  滑离购买屏自动撤销确认；swiper 的兜底 onclick 在这屏走「换一个」而不是购买（防误触）；
- 已购判断：`GET /order/purchased` 的 id 集合，已拥有 → 按钮变「已拥有」不可再买。

**🔴 中间踩了个大坑（这次的现象是「推荐加载不出、页码不动、订单一直加载中」）**：

`loadRecommend` 的成功回调里我调用了 `that.checkOwned()`，**但这个方法没定义**
（写 `loadPurchased` 时漏了）→ 每次推荐接口返回就抛
`TypeError: undefined is not callable`，**把整条回调链炸掉**，后续数据更新全部失效。

**教训两条**：
1. **症状像「网络挂了」「渲染挂了」时，先翻 hilog 找 JS 异常**——
   `hdc shell hilog -x | grep -i "TypeError"`，一条就定位（本项目已把 `console` 日志打进
   `request()` / `onSwiperChange`，hilog 里 `A0c0d0/JSAPP` + `NX ` 前缀可见）；
2. **调用自建方法前先确认它真的存在**——对象字面量里方法一大堆，漏写一个不会有任何编译警告
   （ace-loader / hvigor / jerry 全都不报，因为它语法合法）。

**设备实测结果（`uitest` 逐屏注入验证 + 截图）**：

| 屏 | 实测 |
|---|---|
| 2/6 每日一句 | 正常（一言返回） |
| 3/6 应用推荐 | 正常（螃蟹Acto / 斗地主 / gm消消乐） |
| 4/6 购买应用 | 显示「螃蟹Acto · 需 6 积分 · **已拥有**」→ 按钮变「已拥有」✅ |
| 5/6 我的订单 | 显示真实订单 3 笔（打砖块/恶魔轮盘赌/是男人就下一百层，已支付·积分）+「共 45 笔 · 已支付 45」✅ |
| 页码 | 2/6 → 5/6 全程正确跟随 ✅ |
| hilog | 全程无 JS 异常 ✅ |

**⚠️ 未实测项**：真实下单（会消耗积分）。代码路径与网页端一致，但**没有真实花过积分验证**——
在购买屏「换一个」选一个未拥有的应用，点两下按钮即触发；失败时服务端的 message 会直接打到屏上。

### 6.1l 第十二轮（2026-09-25）：「能买的就那几个」——数据源换成全量列表

**两个来自用户的问题**（拆一个商店下发的 `.app` 包 + 挖接口得出）：

**① 「为什么腕上日历能拉取图片？」—— 它根本不拉**。

解开 `腕上日历fit3&4 翡翠螃蟹适配.app`（实为 zip → `entry-release-lite.hap`）看完：
- **全工程 0 处 `@system.fetch`**；仅有的 2 处 `https://` 是「关于」页**二维码的内容**（爱发电/B站链接）；
- 它显示的所有图（背景/节日/图标等 70+ 张）全是**编译期打包进包的本地 `.bin`**，合计 2MB
  （一张 `background0.bin` 就 783KB）；
- 它是 **API 6/7** 的 liteWearable 工程（`minPlatformVersion: 6`），和我们同一套 lite 技术栈。

→ 结论：**lite 上没有「网络拉图」这回事**，看起来图多只是因为「全打包」。
  这也再次印证本项目的「内置垫底 + 动态覆盖」是对的——垫底层就是它的做法。

**② 「怎么就只有那几个应用可以买？」—— 两层原因**：

| 层 | 原因 | 数量 |
|---|---|---|
| **主因（我的锅）** | 购买屏复用了「应用推荐」的数据源 `/app/hot`，**热门榜只有 10 个** | 10 |
| 服务端真实限制 | 商店共 99 个应用；要同时满足 `status=published` + `device` 含本机型号(fit4) + `allow_auto_signing` + `allow_points_redeem` | **60** |

**修复**：数据源换成 `/app/list?page=1&pageSize=200`（**响应 131KB**，实测能拉下来），
再按设备型号过滤 + 按下载量降序（插入排序，不用 ES6/正则）；拉取失败回退 `/app/hot`。
设备型号来自 `/device/list` 的 `model`（如 `fit4`），拿到后触发 `rebuildAppList()` 重算。

**设备实测**：`NX req/resp /app/list 200`，购买屏已能翻到 hot 榜里没有的应用
（「离殇 · 需 5 积分（应用 0.12 元）」）✅

**🔴 第十三轮数据字段事故（2026-09-25 实锤）**：拆 kb 页的补丁把 data 里
「更多应用列表 / 应用详情 / 订单详情」的字段声明整块误删（listBase/dName/odNo…），导致：
列表页码显示 `NaN-NaN`、点卡片/订单行**无任何反应**、构建按钮「没反应」——
因为 lite 里**未在 data 声明的字段赋值/读取不生效**（`recList[undefined+5]` → undefined 直接 return）。
**已补回全部字段声明并逐项实测**。教训：**删 data 字段时必须先 grep 引用**；
`NaN` 出现在界面上 = 某个 data 字段丢了。

**同类第二坑（「点什么都是 ATRI」的真身）**：订单屏的行点击 `ordTap0/1/2` 固定打开
`orders[0/1/2]`，而「更多订单」翻页后页面显示的是 `orders[3..5]`——
点「是男人就下一百层」跳到 ATRI 详情就是这么来的。
**修**：行下标 = `orderPage * 3 + 槽位`（与列表页 listBase 同一套路）。
装机复测：订单第 2 页点「是男人就下一百层」→ 详情正确显示
是男人（ORDMU7T1RFD3DE6BF5DEF892017 · v5.13 · 已支付 · 尚未开始构建）✓
另：构建状态实测回读真实值（ATRI 的构建 taskId 63989 = failed，
再点开始构建服务端回「重新构建次数已达上限」并原样显示——属服务端侧限制）。

> **布局**：三个视图面板与主屏一致用**垂直居中**（`justify-content: center`），
> 不要用 flex-start（2026-09-25 用户反馈「界面偏上」就是这个原因）。

> ⚠️ 遗留风险：131KB 的响应对 **lite 真机**（非本模拟器）是否吃得消未验证；
> 若拉取超时，代码会自动回退 `/app/hot`（10 个），界面不会空。

### 6.1m 第十三轮（2026-09-25）：**真实购买成功** + 计价公式修正 + 详情补全

**「买不了」的真凶（hilog 定位）**：点击按钮会**冒泡**到 swiper 的 `onclick` 兜底，
购买屏的兜底是「换一个」→ 每点一下按钮，确认状态就被重置、应用被换掉，永远走不到下单。
（验证方法：点「刷新」只产生一条 `/order/list` 请求 → 其它屏不冒泡/无害；购买屏兜底是捣乱的那一个。）
**修法**：`onScreenTap` 只保留屏 1 的兜底（那里有两个按钮、busy 锁防重），其它屏删除。

**计价公式（照抄网页端，挖自 `redeem-ldOUq6q3.js`）**：

```
总额 = app_price + (autoSigningPrice || signing_fee) + 平台服务费 0.5 元
       （平台服务费只在 legacy 模式 + 自动签名 + 非测试应用 + 未自定义签名价时收）
积分 = full_redeem_only 且 redeem_points_cost>0 ? 固定值
     : 总额<=0 ? 0 : max(1, ceil(总额 / 0.12))      ← **1 积分 = 0.12 元**
```

🔴 之前直接拿 `redeem_points_cost` 当积分价是**错的**（很多应用它是 0，但签名费照收），
所以出现了假的「免费获取」——用户一针见血指出「都不要钱，只要积分，也没有免费获取」。

**详情补全**（用户：「没有详细的信息，订单也是」）：
- 购买屏新增：**描述**（44 字截断）+ **版本 · 大小 · 评分** 两行；
- 订单行改为：`应用名` / `日期 · 状态 · 支付方式(积分/签名券/支付宝/激活码) · 金额`。

**✅ 真实下单实测（花 6 积分买了 ATRI -My Dear Moments-）**：

```
第 1 次点 → 「将消耗 6 积分，再点一次确认」
第 2 次点 → NX req POST /order/create 200 → NX req POST /order/pay 200
订单屏   → 「ATRI -My Dear M… · 09-25 · 已支付 · 积分 · 0元」/「共 46 笔」
接口复核 → /order/list 45→46 笔，status=paid；/order/purchased 45→46，ATRI 在列
```

> 重复购买保护也实测到了：对已购应用再下单，服务端返回「该设备已购买此应用」，会原样打到屏上。

**🔴 界面零金额（用户明确要求）**：站点只有积分支付，**界面一律不出现「元」**——
删掉购买屏的金额行与订单行的 `· X元`，计价金额只留在内部用于积分换算。
⚠️ 附带教训：删一行会让后续按钮**整体上移**，用 uitest 注入点击时要**重新 dumpLayout 取坐标**，
不能沿用旧坐标（否则会以为按钮坏了）。

### 6.1n 第十四轮（2026-09-25）：购买流程重构 —— 列表 → 详情 → 购买 → 构建

按需求把「购买」做成完整链路（**页内视图切换**，不用路由——lite 的 replaceUrl 会重建页面丢状态）：

```
屏4 购买应用（精选应用 + 积分明细）
  └─「更多应用」→ 应用列表视图（横向滑动，6槽/页 + 上一页/下一页，60 个可买应用）
        └─ 点任意应用 → 应用详情视图（描述/版本/大小/评分/兑换需X积分·我的积分N/构建状态）
              ├─「X 积分兑换」（两段确认）→ 成功后按钮变「刷新构建」
              └─ 构建状态（GET /order/build/status/{orderId}）
屏5 我的订单 → 点任意订单 → 订单详情视图（单号/版本/状态/支付方式/设备/签名方式/时间/构建状态/开始构建）
```

**实现要点**：
- **横向列表 swiper 只有 6 个静态槽**（lite 不能用 `for` 生成节点）——`listBase` 是槽位对应的列表
  起始下标，用「上一页/下一页」整体平移；点槽位卡片 → `cardTap0..5` → `openAppDetailAt(listBase+i)`；
- **🔴 主 swiper 隐藏必须用 `if` 不能用 `show`**：`show=false` 不从树上移除、仍可命中，
  子视图点按钮/卡片的触摸会被这个幽灵 swiper 截走（实测点卡片没反应/被切回主视图）；
  配套：回主界面时 `swiperIdx = curIdx` 让 swiper 重建到原屏位
- **面板根必须是 `div` 不能是 `stack`**：stack 子元素是层叠不是流式，内部 flex 全失效
  （第一次写成了 stack，按钮全叠在顶部——已改 div + 显式 screenW/H）；面板闭合标签也要同步改；
- **点击冒泡**：按钮点击会冒泡到 swiper 的 onclick 兜底 → `onScreenTap` 只保留屏 1（busy 锁防重），
  其它屏一律删掉（否则购买确认状态会被兜底重置）；
- 构建：`POST /order/build/start {orderId}`（提交）+ `GET /order/build/status/{orderId}`（查询，
  未开始时 `data:null`；已提交返回 `queued/completed` 等状态）。已购应用从 `/order/purchased`
  的 `orderId` 字段查构建；
- 积分明细全面展示：列表卡「X 积分/已拥有」、详情「兑换需 X 积分 · 我的积分 N」、屏4 同行。

**设备实测（uitest 逐视图注入验证 + 截图 docs/验证_*.png）**：
列表视图 60 个应用/6槽翻页 ✓ → 点卡片进详情 ✓（详情/积分/构建状态齐全）→ 订单详情 ✓
（单号/设备/签名方式/时间/构建状态）→ 返回导航 ✓ → 重启后回首屏 ✓（积分 10 = 16-6 ✓）

**⚠️ 体积预警**：功能越加越多，lite 页面产物已到 **46.1KB（红线 48KB）**，只剩 ~2KB 余量——
再加功能必须先精简（或拆页）。release 交付建议走 `packageReleaseApp`（体积更小）。

### 6.1o 第十五轮（2026-09-25）：按压缩反馈 —— 震动 + 轻提示

用户反馈「很多按钮按下后没有文字或震动反馈」。实现：

- **震动**：`@system.vibrator` → `Vibrator.vibrate({mode:'short'})`（螃蟹键盘真机验证过的写法），
  全部 **20 个按钮入口** 都在第一行调用 `this.vibrate()`；`config.json` 重新声明 `ohos.permission.VIBRATE`；
- **轻提示**：全局 toast（root stack 最后一个子节点 = 最顶层，底部胶囊样式），
  `this.toast('换一句…')` 2.5 秒自动消失（setTimeout 失败则保留到下一次提示，不阻塞）；
- 有明确结果文本的动作（签到/兑换/构建）走各自的结果行 + 震动；纯导航/翻页类再加 toast。

**实测**：点「换一句」→ 底部出现「换一句…」胶囊 ✅（截图 docs/验证_按压反馈.png）；
hilog 显示震动调用已到达框架（`VibratorServiceClient: Vibrate time failed, ret:-1`）——
**这是模拟器没有震动硬件**，真机才有的效果 ✅。

> ⚠️ 体积：lite 页面 debug 已到 **48.5KB**（红线 48KB 是 release/装载口径；BuckshotRoulette
> debug 53KB 也正常）。**交付用 release**（`packageReleaseApp`，体积显著更小）；
> 后续再加功能前先精简 debug 体积。

### 6.1p 第十六轮（2026-09-25）：**自研键盘**（B 方案回归）+ 🔴 发现 lite 单页编译体积上限

按需求：B 方案回归（表上输 Token）、A 方案保留、**输入法自研**（螃蟹键盘的 `grab:` 事件
在当前运行时根本不注册，已判定不可用——详见 6.1m）。

**实现**：独立页 `pages/kb/index`（4 页 × 20 键 = 大写A-T / 大写U-Z+数字符号 / 小写a-t / 小写u-z+数字符号，
JWT(base64url) 字符集全覆盖），输入写 `internal://app/nx_token.txt` → `router.replace` 回主界面
→ 主界面 `onShow` 的 `loadToken` 自动读取生效。入口在「我的」屏「输入 Token」按钮；
A 方案（`tools/pack-for-user` 打包注入）保留，界面提示「或私聊发作者定制（免输入）」。

**🔴🔴 本轮最重要发现：lite 引擎对「单页编译产物」有体积上限（约 48-55KB）**

键盘代码并进 index 页后，lite 编译产物到 **55.9KB**，jerry 直接
`Script Error: null`（**报错信息是 null，完全不给线索**），真机/预览器黑屏。
关键事实：
- **debug 和 release 的 lite 页面都不压缩**（release 56.7KB，与 debug 相当）——
  「release 会变小」的经验来自 Buckshot 的 `.bc` 快照口径，不适用未走快照的页面；
- 拆成独立页后：index 48.2KB + kb 12.1KB，**两页都过** ✅；
- 定位手段：jerry-check FAIL + 二分（去掉嫌疑代码块重新编译对比）；
- 附带坑：**对象字面量方法重复定义**（`kbDel` 写了两次）在严格模式编译产物里也是
  `Script Error: null`——V8/node --check 不报（ES6 允许重复键），三条链全静默。

**路由兼容**：全 ACE wearable 运行时的 `@system.router` **没有 `replaceUrl`**（lite 才有），
只有 `replace`（API6 风格）→ `openTokenKb` 做 `typeof` 探测逐个兜底。

**设备实测（uitest 注入）**：
我的屏「输入 Token」→ 键盘页 ✓ → 打 ABC（显示 `ABC · 3 字符`）→ 删除（`AB · 2 字符`）✓
→ 下一页（键位变 UVWXYZ…）✓ → 空内容确认 → 「Token 太短或未输入」不保存 ✓（真 token 无恙）

> ⚠️ 体积预算从此是硬约束：index 48.2KB / kb 12.1KB（红线 ~48KB）。
> **给 index 加功能前必须先给它瘦身**，或把新功能做成独立页。

### 6.2 黑屏第一步### 6.2 黑屏第一步### 6.2 黑屏第一步### 6.2 黑屏第一步### 6.2 黑屏第一步### 6.2 黑屏第一步### 6.2 黑屏第一步：**先读引擎日志，别猜**


```text
构建日志 ：<工程>/.hvigor/outputs/build-logs/build.log
预览器日志：C:\Users\<你>\AppData\Local\Huawei\DevEcoStudio6.1\log\previewer.log
IDE 日志 ：C:\Users\<你>\AppData\Local\Huawei\DevEcoStudio6.1\log\idea.log
```

预览器日志里认这四行（出现即确诊 **JS 求值失败**，与 HML/CSS 无关）：

```
[ACELite][ERROR]:Eval JS file failed
[ACELite][ERROR]:Nothing to render as it is undefined.
[ACELite][ERROR]:Scroll Layer: AppendScrollLayer function parameter rootComponent error.
[ACELite][ERROR]:[Error message too long]        ← 真错误被截断，要靠 jerry.exe 复现
```

> 日志是 **UTF-16 + 含 NUL 字节**，普通 `grep` 会当二进制跳过；用 `python` 读时先 `replace(b'\x00', b'')`。

### 6.3 真机验证顺序（分层诊断，出事能一步定位）

上面四条已修，但真机上若**仍有黑屏**，按这个顺序看，能直接定位到哪一层：

| 步骤 | 看什么 | 看到了说明 | 看不到说明 |
|---|---|---|---|
| 1 | 屏幕**最底部**那行 `1/6 · 上下滑动切换` | 页面框架（根元素 + 布局）正常 | 根元素/页面级问题（回查 §6.1 ③④） |
| 2 | 屏内大字标题 `每日签到` | **swiper 渲染正常** | swiper 层问题（回查 §6.1 ①②） |
| 3 | 上下滑动能否换屏 | `vertical="true"` 生效 | swiper 方向/手势问题 |
| 4 | 点按屏幕有无反应（文案变化） | 组件级 `onclick` 分派生效 | 事件绑定问题 |
| 5 | 滑到第 6 屏点按 → 能否进键盘页 | 路由 + 螃蟹键盘正常 | 键盘页 `grab:` 事件问题（见第八节） |

`pagebar` 故意留在 **swiper 外面**，就是为了当这个「第 1 步探针」用。



---

## 七、编译验证（可复现）

用 SDK 自带的 ace-loader 命令行编译（**与 hvigor 的 modelVersion 解耦**，5.0.4 工程在 6.1.1 环境也能编）：

```bash
TMP="C:/Temp/nx_build"; rm -rf "$TMP"; mkdir -p "$TMP/MainAbility"
cp -r "entry/src/main/js/MainAbility/." "$TMP/MainAbility/"
cat > "$TMP/MainAbility/manifest.json" <<'EOF'
{"appID":"com.example.nexuscheckin","versionName":"1.0.0","versionCode":1000000,
 "minPlatformVersion":10,"pages":["pages/index/index","pages/keyboard_rect/keyboard"]}
EOF
cd "D:/OpenHaymony_SDK_6.1.1/10/js/build-tools/ace-loader" && unset NODE_OPTIONS && \
aceManifestPath="$TMP/MainAbility/manifest.json" node \
  node_modules/webpack/bin/webpack.js --config webpack.lite.config.js \
  --env aceModuleRoot="$TMP/MainAbility" --env aceModuleBuild="$TMP/out" \
  --env cachePath="$TMP/cache" --env deviceType=liteWearable --env buildMode=debug
```

**本次结果：`COMPILE RESULT:SUCCESS {"WARN":7,"NOTE":7}`（0 error）**
警告都是原键盘工程的 `line-height`、`grey` 颜色名，以及 swiper 的 `indicator`
被当作自定义属性 —— 均不阻断。（原版 `translateY(380)` 缺单位的 2 条警告已顺手补上 `px` 修掉。）

> ⚠️ **ace-loader 规则比 hvigor 松，它 SUCCESS ≠ DevEco 能过。** 见下面「7.5 用真正的 hvigor 链验证」。

### 7.5 用真正的 hvigor 链验证（**交付前必做**）

ace-loader 是 SDK 自带的老式独立编译器，**有些 6.1.1 hvigor 的阻断级错误它不报**。
所以出包前一定要过一遍真链：

```powershell
$env:NODE_HOME        = "<node 目录>"
$env:DEVECO_SDK_HOME  = "D:\Devceo Studio 6.1.1\DevEco Studio\sdk"
$env:JAVA_HOME        = "D:\Devceo Studio 6.1.1\DevEco Studio\jbr"   # 少了会 spawn java ENOENT
$env:PATH             = "$env:JAVA_HOME\bin;$env:PATH"
Set-Location "<工程目录>"     # ← 见下面第 1 条，路径不能带中文
& "D:\Devceo Studio 6.1.1\DevEco Studio\tools\hvigor\bin\hvigorw.bat" `
    assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
```

实测结果：**`hvigor BUILD SUCCESSFUL in 15 s 909 ms`，0 ERROR**
（`signingConfigs` 为空时会 WARN "Will skip sign"，产 **unsigned** hap —— 属正常，DevEco 里配了签名才会签。）

产物：`entry/build/default/outputs/default/entry-default-lite-unsigned.hap` = **2.87 MB**。

**这条链上踩过三个坑，记下来别再踩**：

| 坑 | 报错 | 解 |
|---|---|---|
| 1. 工程路径**带中文** | `00306003 Invalid project path`，提示「路径只能含字母、数字、`-` `_` `.` 英文括号、空格、`@`」 | hvigor 不接受中文路径 → **把工程拷到纯 ASCII 路径再构建**（本项目即 `H:\NexusCheckin\`）。这就是为什么不能直接在工作区路径下用 DevEco 构建 |
| 2. `<list-item>` 有多个直接子节点 | `The list-item tag can have only one child node.` + `00308018`，报错卡在 `:entry:default@LegacyBuildJS` | 多行内容必须**外包一层 `div`**。ace-loader **不会报这个**，所以一定要跑 7.5 |
| 3. **不报错但真机黑屏**（最阴） | 无报错，两条链都 SUCCESS | 见「6.1 黑屏修复记录」。**必须靠 `tools/precheck.py` 静态扫** |

**本项目已内置预检脚本**，把这些 hvigor 专有硬错与黑屏隐患在上机前扫一遍：

```bash
python tools/precheck.py <工程目录>
```

检查项（14 条，括号内为「谁会报」）：

| 类别 | 检查项 |
|---|---|
| hvigor 阻断级 | `list-item` 直接子节点 > 1（hvigor 报 00308018）／复合类选择器 `.a.b`／选择器列表 `.a, .b`／`height\|width: auto`／`align-items: baseline`／伪类与子选择器（解析器报 00308018）／`transform` 数值缺单位 |
| **黑屏隐患（两条链都不报）** | 🔴 **JS 正则字面量**／🔴 **`swiper` 内含 `list`**／`list` 子节点非 `list-item`／`list-item` 父非 `list`／容器（`div` 等）缺固定 `width`+`height`／`text` 缺固定 `width`／根元素不是 `div`/`stack`／标签不在白名单 |

> 与 hvigor 一样，**预检一次只报问题清单、不自动改**；改完再跑一次直到退出码 0。

### 7.7 `tools/jerry-check.py` —— 引擎级语法体检（**改 JS 后必跑**）

`precheck.py` 是"看代码像不像有问题"，而这个是**拿真机同款引擎实际解析一遍**：

```bash
python tools/jerry-check.py <工程目录>
# 内部流程：找 SDK 的 ace-loader + jerry.exe → 编译到临时目录 → 对每个产物跑
#           jerry.exe --parse-only → 报出引擎解析失败的文件
```

实测输出：

```
  [ OK ] app.js                                       1.6 KB
  [ OK ] pages/index/index.js                        18.4 KB
  [ OK ] pages/keyboard_rect/keyboard.js             34.1 KB
  ✅ 产物在真机同款引擎上全部解析通过
```

**它是唯一能提前发现「正则导致黑屏」这类问题的手段**，因为：

| | ace-loader | hvigor | **jerry.exe（本工具）** | 真机/预览器 |
|---|---|---|---|---|
| 解析器 | Node/V8 | Node/V8 | **JerryScript（同引擎）** | JerryScript |
| 能否发现正则问题 | ❌ | ❌ | ✅ | ✅（但表现为黑屏） |

> 注意它只保证「**语法层面引擎能接受**」，不保证运行时行为正确
> （例如 `@system.file` 在预览器上不可用，这是运行期的事）。


修复记录 1：`pages/keyboard_rect/keyboard.hml` 里拼音候选词的 `<list-item>` 原本有 **4 个 `<text>` 子节点**
（原 crabKeyboard 就是这样，旧链不报），已用一个 `.alert_pyRow` div 包起来，样式从 `.alert_smallItem` 同步挪过去。
（该区块 UI 上是「拼音更多选项」弹窗，本工程不带词典所以不会出现，但**编译期一样会被拦**。）

修复记录 2：`pages/index/index.hml` 的 `<swiper>` 里原本含 2 个 `<list>` → **整页黑屏**。
已全部改为 `div` 堆叠（应用推荐 3 条 `.rec-card` / 我的 5 行 `.my-row`），并给所有容器与 `text` 补齐固定宽高。

---

## 八、风险与待验证

1. **fetch 下载网络图片在当前运行时不可行**（`responseType:'arraybuffer'` 拿不到二进制，
   见 6.1i 的 0 字节文件实测）。头像逻辑已改成「**验证过才切换**」：
   拿不到真图片就**保持内置默认头像**，界面永远有头像，不会空白。
2. **HTTPS**：SDK 的 `@system.fetch.d.ts` 对 `url` 没有协议限制，但社区有「lite 只支持 http」的说法。
   当前设备实测 `https://ws.fseatech.cn` **可用**（签到/推荐都通了）；
   若换设备报网络失败，把 `CONFIG.ORIGIN` 改成 `http://ws.fseatech.cn` 再试。
3. **一言 API 是第三方**：可能限流/超时，失败时显示「名句获取失败」，点按可重试。
4. **liteWearable 真机未实测**（当前只有 wearable 模拟器）。
   `README` 里的设备适配逻辑按「容器动态 + 内容固定」写，理论上两种表都吃；
   但 **lite 变体（`.bin` 图片 + lite 引擎）上的表现仍待真机确认**。
5. 全部结论以**设备实测**为准；`uitest` 注入法见 6.1h，比肉眼点更快更准。

---

## 九、目录结构

```
NexusCheckin/
├─ build-profile.json5 / hvigorfile.ts / oh-package.json5
├─ hvigor/hvigor-config.json5
├─ docs/
│  ├─ 如何获取Token.html / .md       # 面向用户的取 Token 教程（手机优先、全浏览器分诊）
│  └─ 验证_第3屏应用推荐.png          # 设备实测截图（uitest screenCap）
├─ tools/
│  ├─ pack-for-user.bat / .js        # ★ A 方案定制打包（验 token → 生成绑好账号的工程副本）
│  ├─ precheck.py                    # ★ 静态预检：hvigor 硬错 + 黑屏隐患 + 事件前缀 + JS 正则
│  ├─ jerry-check.py                 # ★ 引擎级语法体检（编译后用 jerry.exe --parse-only 验产物）
│  ├─ check-api.js                   # PC 端 Node 接口自测
│  ├─ gen_icon.py                    # 生成圆形图标（纯标准库）
│  ├─ gen_wallpaper.py               # 生成必应壁纸（纯标准库 + 面积降采样）
│  └─ get-token-bookmarklet.txt      # 可单独复制的书签脚本
├─ dist/                             # 【运行时生成·已 gitignore】定制打包副本
└─ entry/src/main/
   ├─ config.json                    # pages: 只有 index；权限只有 INTERNET
   ├─ resources/base/element/string.json
   ├─ resources/base/media/icon.png, icon_small.png
   └─ js/MainAbility/
      ├─ app.js
      ├─ i18n/zh-CN.json, en-US.json
      ├─ common/
      │  ├─ avatar/default.png       # 内置默认头像（fetch 到用户头像后覆盖显示）
      │  └─ wall/bing.png            # 固定背景壁纸 466×466
      └─ pages/index/index.{hml,css,js}   # 竖向 swiper 四屏，全部逻辑（唯一页面）
```

---

## 十、致谢

- 输入键盘：~~crabKeyboard~~（2026-09-25 按需求撤除；其 API 6 时代用 `grab:` 前缀事件，
  与当前运行时不兼容，是本项目「按钮全点不动」的根因来源）
- 每日一句：一言（Hitokoto）公开 API
- 接口与数据：ws.fseatech.cn

/* 实用工具（独立页）—— 天气 / 翻译 / 世界时间 / 假期倒计时 / 微博热搜
 *
 * 为什么独立成页：lite 引擎对「单页编译产物」有体积上限（实测约 55KB，见 MEMORY），
 * index 页已接近红线，工具页自带预算。
 *
 * 数据源（2026-09-26 全部 curl 实测可达、免 token）：
 *   天气     uapis.cn/api/v1/misc/weather?city=<城市>      温度/天气/风力/湿度
 *   定位     uapis.cn/api/v1/network/myip                  按 IP 拿省市 → 天气城市
 *   世界时间 uapis.cn/api/v1/misc/worldtime?city=<时区名>   注意要时区名(Asia/Tokyo)不是城市名
 *   假期     uapis.cn/api/v1/misc/holiday-calendar         nearby.next = 接下来的假期
 *   热搜     uapis.cn/api/v1/misc/hotboard?type=weibo      内容不可控，谨慎使用
 *   翻译     api.mymemory.translated.net/get?q=&langpair=  免 key、**GET**（uapis 的翻译是 POST）
 *   汇率     open.er-api.com/v6/latest/CNY                 免 key，1¥兑 USD/EUR/JPY/GBP/HKD，每日更新
 *   票房     uapis.cn/api/v1/misc/movie-box-office          list[].movie_name/box_office/sum_box_office
 *   Epic     uapis.cn/api/v1/game/epic-free                 data[].title/original_price_desc（喜加一）
 *   技术日历 uapis.cn/api/v1/history/programmer/today       events[].year/title
 *   吃什么   uapis.cn/api/v1/food/recipe?keyword=<菜名>     items[].title（菜名从内置清单轮换）
 *
 * ⚠️ lite 铁律：无正则、无箭头函数、无模板字符串；网络请求必须**串行**（并发会卡死真机）。
 */

var API = 'https://uapis.cn/api/v1';
var ER_API = 'https://open.er-api.com/v6/latest/CNY';
/* 汇率主源：新浪财经（国内直连，需 Referer）；er-api 是境外源，手表上常超时 */
var SINA_FX = 'https://hq.sinajs.cn/list=fx_susdcny,fx_seurcny,fx_sjpycny,fx_sgbpcny,fx_shkdcny';
var FX_ROWS = [['美元', 'susdcny'], ['欧元', 'seurcny'], ['日元', 'sjpycny'],
  ['英镑', 'sgbpcny'], ['港元', 'shkdcny']];

/* 「今天吃什么」候选菜名（点「换一道」轮换） */
var MENU_DISKS = ['番茄炒蛋', '红烧肉', '麻婆豆腐', '宫保鸡丁', '鱼香肉丝',
  '可乐鸡翅', '糖醋排骨', '蛋炒饭', '红烧鱼', '炒面'];
var MYMEM = 'https://api.mymemory.translated.net/get?q=';

/* 本地词典（离线）：word|音标|释义;word|音标|释义;…
 * 这里是**内置兜底 100 词**（任何设备都能用）；真机会再叠加 rawfile/dict.json 的 2000 词。 */
var DICT_BUILTIN = 'accept|/әk\'sept/|vt. 接受  承认  同意  相信  赞成  承担  ;accord|/ә\'kɒ:d/|n. 一致  调和  协定;account|/ә\'kaunt/|n. 报告  解释  估价  理由  利润  算账  帐;act|/ækt/|n. 行动  行为  幕  法案;action|/\'ækʃәn/|n. 行动  活动  动作  作用  战斗  行为  诉;actually|/\'æktʃuәli/|adv. 事实上  竟然  如今  现在;add|/æd/|vt. 增加  添加  附带说明  计算...总和;against|/ә\'geinst/|prep. 反对  对着  倚靠;age|/eidʒ/|n. 年龄  老年  成年  寿命  时代  时期;aid|/eid/|n. 帮助  外援  助手;air|/єә/|n. 空气  旋律  态度;all|/ɒ:l/|a. 所有的  全部的  一切的;allow|/ә\'lau/|vt. 允许  同意给予  承认;although|/ɒ:l\'ðou/|conj. 虽然  尽管;announce|/ә\'nauns/|vt. 宣布  声称  显示  预告;appear|/ә\'piә/|vi. 出现  显得  来到;area|/\'єәriә/|n. 区域  面积  范围  空地;army|/\'ɑ:mi/|n. 军队  陆军;art|/ɑ:t/|n. 艺术  人文科学  技术  巧妙  诡计  美术;attack|/ә\'tæk/|n. 攻击  抨击;attempt|/ә\'tempt/|n. 尝试  企图;authority|/ɒ:\'θɒriti/|n. 权力  当权者  当局  权威  专家;available|/ә\'veilәbl/|a. 可利用的  可获得的  有效的;back|/bæk/|a. 后面的;base|/beis/|n. 底部  垒  基础  基地;beat|/bi:t/|n. 心跳(声)  打  敲打声  拍子;become|/bi\'kʌm/|vi. 变成  变得;better|/\'betә/|a. 较好的;bit|/bit/|n. 少量  马嚼子  辅币;bite|/bait/|n. 咬  一口;black|/blæk/|n. 黑色  黑颜料;blue|/blu:/|n. 蓝色;book|/buk/|n. 书  书籍  帐簿  名册  工作簿;break|/breik/|n. 休息  中断  破裂处  绝交  破晓  突变;bring|/briŋ/|vt. 带来  产生  促使  提出;brown|/braun/|n. 褐色;building|/\'bildiŋ/|n. 建筑物  建筑;business|/\'biznis/|n. 生意  事情  业务  商业  商行  职责;call|/kɒ:l/|n. 呼叫  访问  打电话  号召  召集  要求;campaign|/kæm\'pein/|n. 战役  运动  竞选运动;capital|/\'kæpitәl/|n. 首都  大写字母  资本;care|/kєә/|n. 小心  照料  忧虑;carry|/\'kæri/|n. 进位  射程  运载;cause|/kɒ:z/|n. 原因  目标;central|/\'sentrәl/|a. 中央的  重要的;centre|/\'sentә/|n. 中心  中心点  中锋;century|/\'sentʃuri/|n. 世纪  百年;chance|/tʃæns. tʃɑ:ns/|n. 机会  意外  可能性;charge|/tʃɑ:dʒ/|n. 指控  费用  冲锋  电荷  炸药  主管  被;chief|/tʃi:f/|n. 领袖  酋长  长官  主要部分;child|/tʃaild/|n. 孩子  产物  追随者;claim|/kleim/|n. 要求  要求权  断言  权利;class|/klɑ:s/|n. 班级  阶级  种类  课;clear|/kliә/|a. 清楚的  明确的  澄清的;club|/klʌb/|n. 俱乐部  木棍  球棒;come|/kʌm/|vi. 过来  来  到达  出现  开始;committee|/kә\'miti/|n. 委员会;company|/\'kʌmpәni/|n. 公司  友伴  交往  连队  朋友  一群;complete|/kәm\'pli:t/|a. 完全的  十足的  完成的;concern|/kәn\'sә:n/|n. 关心  忧虑;condition|/kәn\'diʃәn/|n. 情况  条件;conference|/\'kɒnfәrәns/|n. 会议;continue|/kәn\'tinju:/|vi. 继续  延续  延长;control|/kәn\'trәul/|n. 控制  管理  克制  控制器  操纵装置;cost|/kɒst/|n. 代价  价值  费用;council|/\'kaunsәl/|n. 会议  委员会;country|/\'kʌntri/|n. 国家  乡村  地区  故乡;cover|/\'kʌvә/|n. 盖子  封面  借口;create|/kri:\'eit/|vt. 创造  建造  引起  任命;cup|/kʌp/|n. 杯子  茶杯  优胜杯;current|/\'kʌrәnt/|n. 涌流  趋势  流;cut|/kʌt/|n. 切口  割伤  降低  切  割  砍  削  伤;day|/dei/|n. 天  日子  白天  工作日;decide|/di\'said/|v. 决定  判决;decision|/di\'siʒәn/|n. 决定  决心  决断;demand|/di\'mɑ:nd/|n. 要求  需求  需要;department|/di\'pɑ:tmәnt/|n. 部门  系  机关;describe|/di\'skraib/|vt. 描述  描绘  画;design|/di\'zain/|n. 设计  图样  方案  企图;develop|/di\'velәp/|vt. 发展  使发达  进步  洗印  显影;development|/di\'velәpmәnt/|n. 发展;die|/dai/|vi. 死亡  消逝  平息  熄灭  漠然  渴望;different|/\'difәrәnt/|a. 不同的;difficult|/\'difikәlt/|a. 困难的;direct|/di\'rekt/|a. 直接的  坦白的;director|/di\'rektә/|n. 主管  导演  董事;draw|/drɒ:/|vi. 拉  拖  拔剑;drug|/drʌg/|n. 药  麻药  麻醉药;economic|/.i:kә\'nɒmik/|a. 经济上的  实用的  节省的;economy|/i\'kɒnәmi/|n. 经济  理财  节约;effect|/i\'fekt/|n. 结果  影响  效果  印象;effort|/\'efәt/|n. 努力  成就;eighteen|/\'ei\'ti:n/|num. 十八  十八个;eighty|/\'eiti/|num. 八十  八十个;election|/i\'lekʃәn/|n. 选举  当选  选择权;end|/end/|n. 结束  终点  目标  末端  梢  死亡  残余;event|/i\'vent/|n. 事件  结果  事情的进程  竞赛项目;example|/ig\'zæmpl/|n. 例子  样本  实例;experience|/ik\'spiәriәns/|n. 经历  经验  体验;eye|/ai/|n. 眼睛  视力  看';

/* 本地短语表（离线，中→英）：中文,全拼,首字母;… */
/* 本地短语表（离线，中→英）：中文|英文|全拼|首字母;… */
var PHRASE_TABLE = '你好|Hello|nihao|nh;早上好|Good morning|zaoshanghao|zsh;晚上好|Good evening|wanshanghao|wsh;谢谢|Thank you|xiexie|xx;非常感谢|Thank you very much|feichangganxie|fcgx;不客气|You\'re welcome|bukeqi|bkq;对不起|Sorry|duibuqi|dbq;没关系|It\'s all right|meiguanxi|mgx;再见|Goodbye|zaijian|zj;请稍等|Please wait a moment|qingshaodeng|qsd;请问|Excuse me|qingwen|qw;好的|OK|haode|hd;我明白了|I see|womingbaile|wmbl;我听不懂|I don\'t understand|wotingbudong|wtbd;你会说中文吗|Do you speak Chinese?|nihuishuozhongwenma|nhszwm;请说慢一点|Please speak more slowly|qingshuomanyidian|qsmyd;很高兴认识你|Nice to meet you|hengaoxingrenshini|hgxrsn;麻烦你了|Thanks for your help|mafannile|mfnl;没问题|No problem|meiwenti|mwt;保重|Take care|baozhong|bz;洗手间在哪里|Where is the toilet?|xishoujianzainali|xsjznl;地铁站在哪里|Where is the subway station?|ditiezhanzainali|dtzznl;公交站在哪里|Where is the bus stop?|gongjiaozhanzainali|gjzznl;怎么去机场|How do I get to the airport?|zenmequjichang|zmqjc;怎么去火车站|How do I get to the train station?|zenmequhuochezhan|zmqhcz;打车要多少钱|How much is a taxi?|dacheyaoduoshaoqian|dcydsq;请带我去这个地方|Please take me to this place|qingdaiwoquzhegedifang|qdwqzgdf;这里可以停车吗|Can I park here?|zhelikeyitingchema|zlkytcm;我迷路了|I\'m lost|womilule|wmll;离这里远吗|Is it far from here?|lizheliyuanma|lzlym;走路要多久|How long does it take on foot?|zouluyaoduojiu|zlydj;下一班几点|When is the next one?|xiayibanjidian|xybjd;我要一张票|I\'d like one ticket|woyaoyizhangpiao|wyyzp;请问出口在哪|Where is the exit?|qingwenchukouzaina|qwckzn;这条路对吗|Is this the right way?|zhetiaoluduima|ztldm;左转|Turn left|zuozhuan|zz;右转|Turn right|youzhuan|yz;一直走|Go straight|yizhizou|yzz;到了吗|Are we there yet?|daolema|dlm;我在这里下车|I\'ll get off here|wozaizhelixiache|wzzlxc;菜单给我看一下|May I see the menu?|caidangeiwokanyixia|cdgwkyx;有什么推荐|What do you recommend?|youshenmetuijian|ysmtj;我要这个|I\'ll have this|woyaozhege|wyzg;不要辣|Not spicy, please|buyaola|byl;少放糖|Less sugar, please|shaofangtang|sft;有素食吗|Do you have vegetarian food?|yousushima|yssm;我对花生过敏|I\'m allergic to peanuts|woduihuashengguomin|wdhsgm;再来一份|One more, please|zailaiyifen|zlyf;买单|Check, please|maidan|md;可以刷卡吗|Can I pay by card?|keyishuakama|kyskm;打包|Takeaway, please|dabao|db;好吃|It\'s delicious|haochi|hc;我吃饱了|I\'m full|wochibaole|wcbl;有水吗|Could I have some water?|youshuima|ysm;不要冰|No ice, please|buyaobing|byb;这里有WiFi吗|Is there Wi-Fi here?|zheliyouWiFima|zlyWm;WiFi密码是多少|What\'s the Wi-Fi password?|WiFimimashiduoshao|Wmmsds;请给我一双筷子|Please give me a pair of chopsticks|qinggeiwoyishuangkuaizi|qgwyskz;我吃素|I\'m a vegetarian|wochisu|wcs;这道菜是什么|What is this dish?|zhedaocaishishenme|zdcssm;这个多少钱|How much is this?|zhegeduoshaoqian|zgdsq;太贵了|It\'s too expensive|taiguile|tgl;能便宜点吗|Can you make it cheaper?|nengpianyidianma|npydm;可以试穿吗|Can I try it on?|keyishichuanma|kyscm;有大一号的吗|Do you have a bigger size?|youdayihaodema|ydyhdm;有小一号的吗|Do you have a smaller size?|youxiaoyihaodema|yxyhdm;有其他颜色吗|Do you have other colors?|youqitayansema|yqtysm;我随便看看|I\'m just looking|wosuibiankankan|wsbkk;我要买这个|I\'ll take this|woyaomaizhege|wymzg;可以退货吗|Can I return it?|keyituihuoma|kythm;有发票吗|Could I have a receipt?|youfapiaoma|yfpm;可以扫码吗|Can I scan to pay?|keyisaomama|kysmm;只收现金吗|Cash only?|zhishouxianjinma|zsxjm;一共多少钱|How much in total?|yigongduoshaoqian|ygdsq;帮我包起来|Please wrap it up|bangwobaoqilai|bwbql;这个打折吗|Is this on sale?|zhegedazhema|zgdzm;我可以用支付宝吗|Can I use Alipay?|wokeyiyongzhifubaoma|wkyyzfbm;我可以用微信支付吗|Can I use WeChat Pay?|wokeyiyongweixinzhifuma|wkyywxzfm;请给我一个袋子|Please give me a bag|qinggeiwoyigedaizi|qgwygdz;谢谢，不用了|No, thank you|xiexie，buyongle|xx，byl;我要订一间房|I\'d like to book a room|woyaodingyijianfang|wydyjf;今晚有空房吗|Do you have a room for tonight?|jinwanyoukongfangma|jwykfm;几点可以入住|What time can I check in?|jidiankeyiruzhu|jdkyrz;几点退房|What time is check-out?|jidiantuifang|jdtf;可以延时退房吗|Can I have a late check-out?|keyiyanshituifangma|kyystfm;房间有热水吗|Is there hot water in the room?|fangjianyoureshuima|fjyrsm;空调坏了|The air conditioner doesn\'t work|kongtiaohuaile|kthl;请打扫一下房间|Please clean the room|qingdasaoyixiafangjian|qdsyxfj;请给我一条毛巾|Please give me a towel|qinggeiwoyitiaomaojin|qgwytmj;行李可以寄存吗|Can I leave my luggage here?|xinglikeyijicunma|xlkyjcm;早餐几点开始|What time does breakfast start?|zaocanjidiankaishi|zcjdks;有电梯吗|Is there an elevator?|youdiantima|ydtm;房卡丢了|I lost my room key|fangkadiule|fkdl;我要续住一晚|I\'d like to stay one more night|woyaoxuzhuyiwan|wyxzyw;这里安静吗|Is it quiet here?|zhelianjingma|zlajm;救命|Help!|jiuming|jm;请叫救护车|Please call an ambulance|qingjiaojiuhuche|qjjhc;请叫警察|Please call the police|qingjiaojingcha|qjjc;我生病了|I\'m sick|woshengbingle|wsbl;我需要医生|I need a doctor|woxuyaoyisheng|wxyys;附近有医院吗|Is there a hospital nearby?|fujinyouyiyuanma|fjyyym;我丢了护照|I lost my passport|wodiulehuzhao|wdlhz;我的钱包被偷了|My wallet was stolen|wodeqianbaobeitoule|wdqbbtl;我的手机没电了|My phone is out of battery|wodeshoujimeidianle|wdsjmdl;可以借我充电器吗|Can I borrow a charger?|keyijiewochongdianqima|kyjwcdqm;请帮我报警|Please help me call the police|qingbangwobaojing|qbwbj;这里很危险|It\'s dangerous here|zhelihenweixian|zlhwx;我不舒服|I don\'t feel well|wobushufu|wbsf;我对这个过敏|I\'m allergic to this|woduizhegeguomin|wdzggm;最近的药店在哪|Where is the nearest pharmacy?|zuijindeyaodianzaina|zjdydzn;我需要帮助|I need help|woxuyaobangzhu|wxybz;请帮我一下|Please help me|qingbangwoyixia|qbwyx;我找不到同伴了|I can\'t find my companion|wozhaobudaotongbanle|wzbdtbl;可以借个电话吗|Can I borrow a phone?|keyijiegedianhuama|kyjgdhm;紧急情况|It\'s an emergency|jinjiqingkuang|jjqk;现在几点|What time is it now?|xianzaijidian|xzjd;今天几号|What\'s the date today?|jintianjihao|jtjh;今天星期几|What day is it today?|jintianxingqiji|jtxqj;明天|Tomorrow|mingtian|mt;昨天|Yesterday|zuotian|zt;一个小时|One hour|yigexiaoshi|ygxs;半个小时|Half an hour|bangexiaoshi|bgxs;十分钟|Ten minutes|shifenzhong|sfz;多少钱|How much?|duoshaoqian|dsq;一个人|One person|yigeren|ygr;两个人|Two people|lianggeren|lgr;三个|Three|sange|sg;十|Ten|shi|s;一百|One hundred|yibai|yb;一千|One thousand|yiqian|yq;我可以帮你吗|Can I help you?|wokeyibangnima|wkybnm;这个怎么说|How do you say this?|zhegezenmeshuo|zgzms;这个什么意思|What does this mean?|zhegeshenmeyisi|zgsmys;请写下来|Please write it down|qingxiexialai|qxxl;请再说一遍|Please say it again|qingzaishuoyibian|qzsyb;你叫什么名字|What\'s your name?|nijiaoshenmemingzi|njsmmz;我叫小明|My name is Xiaoming|wojiaoxiaoming|wjxm;你从哪里来|Where are you from?|nicongnalilai|ncnll;我来自中国|I\'m from China|wolaizizhongguo|wlzzg;很高兴见到你|Glad to see you|hengaoxingjiandaoni|hgxjdn;我在这里旅游|I\'m here for travel|wozaizhelilvyou|wzzlly;我第一次来|It\'s my first time here|wodiyicilai|wdycl;这里真漂亮|It\'s beautiful here|zhelizhenpiaoliang|zlzpl;可以拍照吗|Can I take a photo?|keyipaizhaoma|kypzm;帮我拍张照|Could you take a photo for me?|bangwopaizhangzhao|bwpzz;天气预报怎么说|What\'s the weather forecast?|tianqiyubaozenmeshuo|tqybzms;今天天气很好|The weather is nice today|jintiantianqihenhao|jttqhh;会下雨吗|Will it rain?|huixiayuma|hxym;太热了|It\'s too hot|tairele|trl;太冷了|It\'s too cold|tailengle|tll';

var DICT_LIST = null;
var PHRASE_LIST = null;

function splitTable(str, sep) { return String(str || '').split(sep); }

function dictList() {
  if (DICT_LIST) { return DICT_LIST; }
  DICT_LIST = [];
  var seg = splitTable(DICT_BUILTIN, ';');
  for (var i = 0; i < seg.length; i++) {
    var it = seg[i].split('|');
    if (it.length >= 3 && it[0]) { DICT_LIST.push([it[0].toLowerCase(), it[1], it[2]]); }
  }
  return DICT_LIST;
}

function phraseList() {
  if (PHRASE_LIST) { return PHRASE_LIST; }
  PHRASE_LIST = [];
  var seg = splitTable(PHRASE_TABLE, ';');
  for (var i = 0; i < seg.length; i++) {
    var it = seg[i].split('|');
    if (it.length >= 4 && it[0]) { PHRASE_LIST.push([it[0], it[1], it[2], it[3]]); }
  }
  return PHRASE_LIST;
}

/* 去首尾空白（lite 无正则） */
function trimStr(s) {
  var t = String(s || '');
  var a = 0;
  var b = t.length;
  while (a < b) {
    var c = t.charCodeAt(a);
    if (c === 32 || c === 9 || c === 10 || c === 13) { a = a + 1; } else { break; }
  }
  while (b > a) {
    var c2 = t.charCodeAt(b - 1);
    if (c2 === 32 || c2 === 9 || c2 === 10 || c2 === 13) { b = b - 1; } else { break; }
  }
  return t.substring(a, b);
}

/* 世界时间：uapis 要的是时区名 */
var WT_CITIES = [
  ['北京', 'Asia/Shanghai'],
  ['东京', 'Asia/Tokyo'],
  ['伦敦', 'Europe/London'],
  ['纽约', 'America/New_York']
];

var TOOL_PAGES = 10;

export default {
  data: {
    screenW: '466px', screenH: '466px', swiperW: '466px', swiperH: '410px',
    swiperTop: '24px', pagebarLeft: '133px', bgSrc: '/common/wall/bing.png',
    pageText: '1/10', curIdx: 0, swiperIdx: 0,

    /* 1 天气 */
    wxCity: '正在定位…', wxTemp: '--', wxMain: '', wxExtra: '', wxNote: '',

    /* 2 翻译 */
    trSrc: '点「输入文字」用键盘打字', trDst: '', trInfo: '中英互译 · 自动识别',
    trMode: 'net', trModeLabel: '联网', trLast: '',

    /* 3 世界时间 */
    wt1: '--', wt2: '--', wt3: '--', wt4: '--', wtNote: '正在获取…',

    /* 4 假期倒计时 */
    holMain: '正在获取…', hol1: '', hol2: '', hol3: '', holNote: '',

    /* 5 热搜 */
    hot1: '正在获取…', hot2: '', hot3: '', hot4: '', hot5: '', hotInfo: '',

    /* 6 汇率 */
    fx1: '正在获取…', fx2: '', fx3: '', fx4: '', fx5: '', fxNote: '',

    /* 7 电影票房 */
    bo1: '正在获取…', bov1: '', bo2: '', bov2: '', bo3: '', bov3: '', boNote: '',

    /* 8 Epic 喜加一 */
    ep1: '正在获取…', epv1: '', ep2: '', epv2: '', epNote: '',

    /* 9 程序员日历 */
    pt1: '正在获取…', pt2: '', pt3: '', ptNote: '',

    /* 10 今天吃什么 */
    mk1: '正在获取…', mk2: '', mk3: '', mkNote: '',

    toastText: '', toastShow: false, toastTop: '402px', toastW: '466px'
  },

  onInit: function () {
    this.fetchApi = null;
    this.fileApi = null;
    this.vibratorApi = null;
    this.toastTimer = null;
    this.q = [];
    this.qRunning = false;
    this.hotOffset = 0;
    this.menuIdx = 0;
    this.trFrom = '';
    this.trText = '';
    this.dictLoaded = false;
    this.applyMetrics();
    this.loadDictRaw();
  },

  /* 进页：给表冠焦点 + 读翻译输入 + **首次进屏主动加载首屏**
   * ⚠️ 首次经 router 进页时 swiper 的 onchange 不触发 → 不主动加载就会一直停在初始值 */
  onShow: function () {
    this.crownFocus(true);
    if (!this.started) {
      this.started = true;
      this.applyScreen(0);
      this.loadWeather();
    }
    /* 放在首屏加载之后：$app 分支是同步的，会把 swiper 直接切到翻译屏 */
    this.readTrInput();
  },

  onHide: function () { this.crownFocus(false); },
  onDestroy: function () { this.crownFocus(false); },

  crownFocus: function (on) {
    try {
      var s = this.$refs && this.$refs.tswiper;
      if (s && typeof s.rotation === 'function') { s.rotation({ focus: on }); }
    } catch (e) {}
  },

  /* ── 基础设施 ── */
  ensureApi: function () {
    if (this.fetchApi) { return true; }
    try { this.fetchApi = require('@system.fetch'); } catch (e) { this.fetchApi = null; }
    return !!this.fetchApi;
  },

  ensureFile: function () {
    if (this.fileApi) { return true; }
    try { this.fileApi = require('@system.file'); } catch (e) { this.fileApi = null; }
    return !!this.fileApi;
  },

  vibrate: function () {
    if (!this.vibratorApi) {
      try { this.vibratorApi = require('@system.vibrator'); } catch (e) { this.vibratorApi = null; }
    }
    if (!this.vibratorApi) { return; }
    try { this.vibratorApi.vibrate({ mode: 'short' }); } catch (e) {}
  },

  toast: function (msg) {
    var that = this;
    this.toastText = String(msg || '').substring(0, 24);
    this.toastShow = true;
    try { if (this.toastTimer) { clearTimeout(this.toastTimer); } } catch (e) {}
    try { this.toastTimer = setTimeout(function () { that.toastShow = false; }, 2500); } catch (e) {}
  },

  applyMetrics: function () {
    var that = this;
    var dev = null;
    try { dev = require('@system.device'); } catch (e) { dev = null; }
    if (!dev || !dev.getInfo) { return; }
    try {
      dev.getInfo({
        success: function (d) { that.buildMetrics(d); },
        fail: function () {}
      });
    } catch (e) {}
  },

  buildMetrics: function (d) {
    var w = (d && d.windowWidth) ? d.windowWidth : 466;
    var h = (d && d.windowHeight) ? d.windowHeight : 466;
    var sw = h - 56;
    if (sw < 300) { sw = 300; }
    this.screenW = w + 'px';
    this.screenH = h + 'px';
    this.swiperW = w + 'px';
    this.swiperH = sw + 'px';
    this.swiperTop = '24px';
    this.pagebarLeft = Math.round((w - 200) / 2) + 'px';
    this.toastTop = (h - 64) + 'px';
    this.toastW = w + 'px';
  },

  /* ── 串行 GET（lite 真机并发 fetch 会卡死，必须一次一个）── */
  getJson: function (url, cb) {
    if (!this.ensureApi()) { cb(false, '联网模块不可用'); return; }
    var that = this;
    this.fetchQueued({
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
  },

  /* 文本 GET（不走 JSON 解析；header 可带 Referer） */
  getRaw: function (url, cb) {
    if (!this.ensureApi()) { cb(false, '联网模块不可用'); return; }
    var that = this;
    this.fetchQueued({
      url: url,
      method: 'GET',
      header: { Referer: 'https://finance.sina.com.cn/' },
      success: function (res) { cb(true, res ? res.data : null); },
      fail: function (res, code) { cb(false, '网络失败 ' + code); }
    });
  },

  fetchQueued: function (options) {
    if (!this.q) { this.q = []; }
    this.q.push(options);
    this.pumpQueue();
  },

  pumpQueue: function () {
    if (this.qRunning) { return; }
    var opt = this.q.shift();
    if (!opt) { return; }
    var that = this;
    this.qRunning = true;
    var timer = null;
    var done = false;
    var finish = function () {
      if (done) { return; }
      done = true;
      try { if (timer) { clearTimeout(timer); } } catch (e) {}
      that.qRunning = false;
      /* 回调可能是同步派发的 → 用 setTimeout 放行，避免递归连发 */
      try { setTimeout(function () { that.pumpQueue(); }, 50); }
      catch (e) { that.pumpQueue(); }
    };
    try { timer = setTimeout(finish, 20000); } catch (e) { finish(); }
    var ok = opt.success;
    var bad = opt.fail;
    opt.success = function (r) { finish(); if (ok) { ok(r); } };
    opt.fail = function (r, c) { finish(); if (bad) { bad(r, c); } };
    try { this.fetchApi.fetch(opt); } catch (e) { finish(); if (bad) { bad(null, -1); } }
  },

  /* ── 1 天气（先用 IP 定位城市，再查天气）── */
  loadWeather: function () {
    var that = this;
    this.vibrate();
    this.wxCity = '正在定位…';
    this.wxTemp = '--';
    this.wxMain = '';
    this.wxExtra = '';
    this.wxNote = '';
    this.getJson(API + '/network/myip', function (ok, d) {
      var city = '';
      if (ok && d) {
        /* region 形如「中国 四川 自贡」→ 取最后一段当城市 */
        var reg = String(d.region || '');
        var parts = reg.split(' ');
        if (parts.length) { city = parts[parts.length - 1]; }
      }
      that.fetchWeather(city);
    });
  },

  fetchWeather: function (city) {
    var that = this;
    var url = API + '/misc/weather';
    if (city) { url += '?city=' + encodeURL(city); }
    this.getJson(url, function (ok, d) {
      if (!ok || !d || d.temperature === undefined) {
        that.wxCity = city || '定位失败';
        that.wxMain = '获取失败';
        that.wxExtra = '点「刷新」重试';
        return;
      }
      that.wxCity = String(d.city || city || '');
      that.wxTemp = String(d.temperature) + '°';
      that.wxMain = String(d.weather || '');
      that.wxExtra = String(d.wind_direction || '') + ' ' + String(d.wind_power || '') +
        ' · 湿度 ' + String(d.humidity) + '%';
      that.wxNote = String(d.report_time || '') + ' · 点「刷新」更新';
    });
  },

  /* ── 2 翻译（MyMemory，GET；中文→英、其它→中，自动判断）── */
  openTrInput: function () {
    this.vibrate();
    var that = this;
    /* ① 先写 $app 全局（同步、模拟器与真机都可靠） */
    try { if (typeof $app !== 'undefined' && $app) { $app.nxKbMode = 'tr'; } } catch (e) {}
    /* 清掉上次的键盘存档，避免旧现场覆盖本次 */
    if (this.ensureFile()) {
      try { this.fileApi.writeText({ uri: 'internal://app/nx_kbstate.txt', text: '', success: function () {}, fail: function () {} }); } catch (e) {}
    }
    /* ② 再尽力写文件（真机 lite 通道）—— fire-and-forget，不等回调 */
    if (this.ensureFile()) {
      try {
        this.fileApi.writeText({
          uri: 'internal://app/nx_kbmode.txt',
          text: 'tr',
          success: function () {},
          fail: function () {}
        });
      } catch (e) {}
    }
    /* ③ 立即进入键盘页（旧版等 writeText 回调 → 模拟器上卡住） */
    this.gotoKb();
  },

  gotoKb: function () {
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { this.toast('路由不可用'); return; }
    var opt = { uri: 'pages/kb/index' };
    var ok = false;
    /* ⚠️ 本机 @system.router 只有 replace（无 replaceUrl）→ replace 优先 */
    try { if (typeof r.replace === 'function') { r.replace(opt); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      try { if (typeof r.replaceUrl === 'function') { r.replaceUrl(opt); ok = true; } } catch (e) { ok = false; }
    }
    if (!ok) { this.toast('打开键盘失败'); }
  },

  /* 键盘页返回后：取用户输入并翻译。
   * ① 优先读 $app 全局（键盘页 kbDone 写入；同步、模拟器与真机都可靠）；
   * ② 回退读 internal://app/nx_tr.txt（真机 lite 文件通道）。 */
  readTrInput: function () {
    var that = this;
    var t = '';
    try {
      if (typeof $app !== 'undefined' && $app && $app.nxTrText) {
        t = trimTail(String($app.nxTrText));
        $app.nxTrText = '';
      }
    } catch (e) {}
    if (t) { this.applyTrText(t); return; }
    if (!this.ensureFile()) { return; }
    /* 读 nx_tr.txt；与「上次已消费」(nx_tr_last.txt) 相同就跳过
     * —— 根治「每次进工具页都自动跳翻译屏」（清空文件在部分环境不可靠） */
    var applyIfNew = function (r2) {
      var s = '';
      if (r2) {
        if (typeof r2.text === 'string') { s = r2.text; }
        else if (typeof r2 === 'string') { s = r2; }
      }
      s = s ? trimTail(s) : '';
      if (!s || s === that.trText || s === that.trLast) { return; }
      that.trLast = s;
      try {
        that.fileApi.writeText({ uri: 'internal://app/nx_tr_last.txt', text: s, success: function () {}, fail: function () {} });
      } catch (e) {}
      that.applyTrText(s);
    };
    var readTr = function () {
      try {
        that.fileApi.readText({ uri: 'internal://app/nx_tr.txt', success: applyIfNew, fail: function () {} });
      } catch (e) {}
    };
    try {
      this.fileApi.readText({
        uri: 'internal://app/nx_tr_last.txt',
        success: function (r1) {
          var last = '';
          if (r1) {
            if (typeof r1.text === 'string') { last = r1.text; }
            else if (typeof r1 === 'string') { last = r1; }
          }
          that.trLast = last ? trimTail(last) : '';
          readTr();
        },
        fail: function () { that.trLast = ''; readTr(); }
      });
    } catch (e) { readTr(); }
  },

  /* 展示待翻译文本：切到翻译屏并翻译（从键盘页回来是「重建本页」→ 必须主动切屏） */
  applyTrText: function (t) {
    this.trText = t;
    this.trSrc = t;
    this.swiperIdx = 1;
    this.applyScreen(1);
    this.translate(t);
  },

  /* 联网 / 本地 切换 */
  toggleTrMode: function () {
    this.vibrate();
    this.trMode = this.trMode === 'net' ? 'local' : 'net';
    this.trModeLabel = this.trMode === 'net' ? '联网' : '本地';
    if (this.trText) { this.translate(this.trText); }
  },

  /* 真机加载 2000 词大词库（rawfile）；读不到就继续用内置 100 词兜底 */
  loadDictRaw: function () {
    var that = this;
    if (!this.ensureFile()) { return; }
    try {
      this.fileApi.readText({
        uri: 'internal://rawfile/dict.json',
        success: function (res) {
          var txt = '';
          if (res) {
            if (typeof res.text === 'string') { txt = res.text; }
            else if (typeof res === 'string') { txt = res; }
          }
          if (!txt) { return; }
          try {
            var arr = JSON.parse(txt);
            if (!arr || !arr.length) { return; }
            var base = dictList();
            for (var i = 0; i < arr.length; i++) {
              var e = arr[i];
              if (e && e[0]) { base.push([String(e[0]).toLowerCase(), String(e[1] || ''), String(e[2] || '')]); }
            }
            that.dictLoaded = true;
          } catch (e2) {}
        },
        fail: function () {}
      });
    } catch (e) {}
  },

  translate: function (text) {
    var that = this;
    if (!text) { return; }
    if (this.trMode === 'local') { this.localTranslate(text); return; }
    /* 含中文 → 译成英文；否则译成中文 */
    var hasCjk = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0x4e00 && c <= 0x9fff) { hasCjk = true; break; }
    }
    var from = hasCjk ? 'zh-CN' : 'en';
    var to = hasCjk ? 'en' : 'zh-CN';
    this.trFrom = from;
    this.trDst = '翻译中…';
    this.trInfo = (hasCjk ? '中文 → English' : 'English → 中文');
    this.getJson(MYMEM + encodeURL(text) + '&langpair=' + from + '%7C' + to, function (ok, d) {
      var out = '';
      if (ok && d && d.responseData) { out = String(d.responseData.translatedText || ''); }
      if (!out) {
        that.trDst = '';
        that.trInfo = '翻译失败，点「重译」重试';
        return;
      }
      that.trDst = out;
      that.trInfo = (hasCjk ? '中文 → English' : 'English → 中文') + ' · 点「重译」再来';
    });
  },

  /* 本地（离线）翻译：中→英查短语表，英→中查词库 */
  localTranslate: function (text) {
    var t = trimStr(text);
    if (!t) { return; }
    var hasCjk = false;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c >= 0x4e00 && c <= 0x9fff) { hasCjk = true; break; }
    }
    if (hasCjk) {
      var ph = phraseFind(t);
      if (ph) {
        this.trDst = ph[1];
        this.trInfo = '本地短语 · 中文→English';
      } else {
        this.trDst = '';
        this.trInfo = '本地短语库没有，切「联网」试试';
      }
    } else {
      var e = dictFind(t);
      if (e) {
        this.trDst = e[2];
        this.trInfo = '本地词库 · ' + e[1] + ' · 点「重译」再查';
      } else {
        this.trDst = '';
        this.trInfo = '本地词库没有，切「联网」试试';
      }
    }
  },

  retranslate: function () {
    this.vibrate();
    if (!this.trText) { this.toast('先点「输入文字」'); return; }
    this.translate(this.trText);
  },

  /* ── 3 世界时间 ── */
  loadWorld: function () {
    var that = this;
    this.vibrate();
    this.wtNote = '正在获取…';
    for (var i = 0; i < WT_CITIES.length; i++) {
      this.queryWorld(i, WT_CITIES[i][0], WT_CITIES[i][1]);
    }
  },

  queryWorld: function (idx, name, tz) {
    var that = this;
    this.getJson(API + '/misc/worldtime?city=' + encodeURL(tz), function (ok, d) {
      var txt = name + '  --';
      if (ok && d && d.datetime) {
        var dt = String(d.datetime);
        var p = dt.indexOf(' ');
        var hm = p > 0 ? dt.substring(p + 1, p + 6) : dt;
        txt = name + '  ' + hm;
      }
      if (idx === 0) { that.wt1 = txt; }
      else if (idx === 1) { that.wt2 = txt; }
      else if (idx === 2) { that.wt3 = txt; }
      else { that.wt4 = txt; }
      that.wtNote = '本地时间 · 点「刷新」更新';
    });
  },

  /* ── 4 假期倒计时 ── */
  loadHoliday: function () {
    var that = this;
    this.vibrate();
    this.holMain = '正在获取…';
    this.hol1 = ''; this.hol2 = ''; this.hol3 = '';
    this.getJson(API + '/misc/holiday-calendar?include_nearby=1&nearby_limit=8&exclude_past=1', function (ok, d) {
      if (!ok || !d) { that.holMain = '获取失败'; that.holNote = '点「刷新」重试'; return; }
      var next = (d.nearby && d.nearby.next) ? d.nearby.next : [];
      var seen = {};
      var rows = [];
      for (var i = 0; i < next.length; i++) {
        var evs = next[i].events || [];
        for (var k = 0; k < evs.length; k++) {
          var nm = String(evs[k].name || '');
          if (!nm || seen[nm]) { continue; }
          seen[nm] = true;
          rows.push([nm, String(next[i].date || '')]);
        }
      }
      if (!rows.length) { that.holMain = '暂无假期数据'; return; }
      var days0 = that.daysUntil(rows[0][1]);
      that.holMain = '距离 ' + rows[0][0] + ' 还有 ' + days0 + ' 天';
      that.hol1 = that.fmtHol(rows[1]);
      that.hol2 = that.fmtHol(rows[2]);
      that.hol3 = that.fmtHol(rows[3]);
      that.holNote = rows[0][0] + ' · ' + rows[0][1];
    });
  },

  fmtHol: function (row) {
    if (!row) { return ''; }
    return row[0] + '  ' + row[1].substring(5) + ' · ' + this.daysUntil(row[1]) + ' 天后';
  },

  daysUntil: function (dateStr) {
    /* dateStr 形如 2026-10-01；与今天比天数（本地时区） */
    var y = 0, m = 0, d = 0;
    try {
      var seg = String(dateStr).split('-');
      y = parseInt(seg[0], 10); m = parseInt(seg[1], 10); d = parseInt(seg[2], 10);
    } catch (e) { return 0; }
    var now = new Date();
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var t1 = new Date(y, m - 1, d).getTime();
    var n = Math.round((t1 - t0) / 86400000);
    return n < 0 ? 0 : n;
  },

  /* ── 5 微博热搜 ── */
  loadHot: function () {
    var that = this;
    this.vibrate();
    this.hotInfo = '正在获取…';
    this.getJson(API + '/misc/hotboard?type=weibo&limit=10', function (ok, d) {
      if (!ok || !d || !d.list || !d.list.length) {
        that.hot1 = '获取失败'; that.hotInfo = '点「刷新」重试';
        return;
      }
      that.hotAll = d.list;
      that.hotOffset = 0;
      that.renderHot();
    });
  },

  renderHot: function () {
    var list = this.hotAll || [];
    if (!list.length) { return; }
    var out = [];
    for (var i = 0; i < 5; i++) {
      var it = list[(this.hotOffset + i) % list.length] || {};
      var rank = (this.hotOffset + i) % list.length + 1;
      out.push(rank + '. ' + String(it.title || '').substring(0, 16));
    }
    this.hot1 = out[0]; this.hot2 = out[1]; this.hot3 = out[2];
    this.hot4 = out[3]; this.hot5 = out[4];
    this.hotInfo = '微博热搜 · 点「换一批」看更多';
  },

  nextHot: function () {
    this.vibrate();
    if (!this.hotAll || !this.hotAll.length) { this.loadHot(); return; }
    this.hotOffset = this.hotOffset + 5;
    if (this.hotOffset >= this.hotAll.length) { this.hotOffset = 0; }
    this.renderHot();
  },

  /* ── 6 汇率（主源新浪财经，国内可达；er-api 兜底）── */
  loadFx: function () {
    var that = this;
    this.vibrate();
    this.fxNote = '正在获取…';
    this.getRaw(SINA_FX, function (ok, raw) {
      if (ok && raw && String(raw).indexOf('fx_') >= 0) {
        that.renderSinaFx(String(raw));
        return;
      }
      /* 兜底：境外源 er-api（可能超时） */
      that.getJson(ER_API, function (ok2, d) {
        if (!ok2 || !d || !d.conversion_rates) {
          that.fx1 = '获取失败'; that.fxNote = '点「刷新」重试'; return;
        }
        var r = d.conversion_rates;
        that.fx1 = '1¥ = ' + that.fmtRate(r.USD) + ' 美元';
        that.fx2 = '1¥ = ' + that.fmtRate(r.EUR) + ' 欧元';
        that.fx3 = '1¥ = ' + that.fmtRate(r.JPY) + ' 日元';
        that.fx4 = '1¥ = ' + that.fmtRate(r.GBP) + ' 英镑';
        that.fx5 = '1¥ = ' + that.fmtRate(r.HKD) + ' 港元';
        that.fxNote = '对人民币汇率 · 每日更新';
      });
    });
  },

  /* 新浪返回 var hq_str_fx_susdcny="时间,价,价,…,现价,…";
   * 字段[1] 是现价（=1 外币兑人民币元）→ 取倒数换算成 1¥ 兑外币 */
  renderSinaFx: function (raw) {
    var rates = {};
    var segs = raw.split(';');
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var a = seg.indexOf('fx_s');
      var eq = seg.indexOf('=', a);
      var b = seg.indexOf('"', eq);
      if (a < 0 || eq < 0 || b < 0) { continue; }
      var code = seg.substring(a + 4, eq);
      var p = seg.substring(b + 1).split(',');
      var v = Number(p[1]);
      if (code && v > 0) { rates[code] = v; }
    }
    var out = [];
    for (var k = 0; k < FX_ROWS.length; k++) {
      var nm = FX_ROWS[k][0];
      var v2 = rates[FX_ROWS[k][1]];
      out.push(v2 > 0 ? ('1¥ = ' + this.fmtRate(1 / v2) + ' ' + nm) : ('1¥ = -- ' + nm));
    }
    this.fx1 = out[0]; this.fx2 = out[1]; this.fx3 = out[2]; this.fx4 = out[3]; this.fx5 = out[4];
    this.fxNote = '对人民币汇率 · 新浪财经';
  },

  /* 截断：优先在标点处断句，避免把长句拦腰截断 */
  cutTxt: function (t, n) {
    var str = String(t || '');
    if (str.length <= n) { return str; }
    var seps = '，,；;。';
    for (var i = 3; i < n; i++) {
      if (seps.indexOf(str.charAt(i)) >= 0) { return str.substring(0, i + 1); }
    }
    return str.substring(0, n);
  },

  fmtRate: function (v) {
    var n = Number(v);
    if (!n || n !== n) { return '--'; }
    if (n >= 100) { return n.toFixed(1); }
    if (n >= 1) { return n.toFixed(2); }
    return n.toFixed(4);
  },

  /* ── 7 电影票房 ── */
  loadBox: function () {
    var that = this;
    this.vibrate();
    this.bo1 = '正在获取…'; this.bov1 = ''; this.bo2 = ''; this.bov2 = ''; this.bo3 = ''; this.bov3 = '';
    this.boNote = '';
    this.getJson(API + '/misc/movie-box-office', function (ok, d) {
      if (!ok || !d || !d.list || !d.list.length) {
        that.bo1 = '获取失败'; that.boNote = '点「刷新」重试'; return;
      }
      var l = d.list;
      var mk = d.market || {};
      for (var i = 0; i < 3 && i < l.length; i++) {
        var it = l[i] || {};
        var nm0 = String(it.movie_name || '');
        var pa = nm0.indexOf('（');
        if (pa > 2) { nm0 = nm0.substring(0, pa); }
        var nm = (i + 1) + '. ' + trimStr(nm0).substring(0, 13);
        var vv = '今日 ' + String(it.box_office || '--') + ' · 累计 ' + String(it.sum_box_office || '--');
        if (i === 0) { that.bo1 = nm; that.bov1 = vv; }
        else if (i === 1) { that.bo2 = nm; that.bov2 = vv; }
        else { that.bo3 = nm; that.bov3 = vv; }
      }
      that.boNote = '今日大盘 ' + String(mk.box_office || '--');
    });
  },

  /* ── 8 Epic 喜加一 ── */
  loadEpic: function () {
    var that = this;
    this.vibrate();
    this.ep1 = '正在获取…'; this.epv1 = ''; this.ep2 = ''; this.epv2 = ''; this.epNote = '';
    this.getJson(API + '/game/epic-free', function (ok, d) {
      if (!ok || !d || !d.data || !d.data.length) {
        that.ep1 = '获取失败'; that.epNote = '点「刷新」重试'; return;
      }
      var l = d.data;
      that.ep1 = that.cutTxt(l[0].title, 16);
      that.epv1 = '原价 ' + String(l[0].original_price_desc || '--') + ' · 现在免费';
      if (l.length > 1) {
        that.ep2 = that.cutTxt(l[1].title, 16);
        that.epv2 = '原价 ' + String(l[1].original_price_desc || '--') + ' · 现在免费';
      }
      that.epNote = 'Epic 喜加一 · 点「刷新」更新';
    });
  },

  /* ── 9 技术日历（程序员历史上的今天）── */
  loadProg: function () {
    var that = this;
    this.vibrate();
    this.pt1 = '正在获取…'; this.pt2 = ''; this.pt3 = ''; this.ptNote = '';
    this.getJson(API + '/history/programmer/today', function (ok, d) {
      if (!ok || !d || !d.events || !d.events.length) {
        that.pt1 = '获取失败'; that.ptNote = '点「刷新」重试'; return;
      }
      var e = d.events;
      var that2 = this;
      var row = function (it) {
        return String(it.year || '') + '年 ' + that2.cutTxt(it.title, 16);
      };
      that.pt1 = row(e[0]);
      that.pt2 = e.length > 1 ? row(e[1]) : '';
      that.pt3 = e.length > 2 ? row(e[2]) : '';
      that.ptNote = String(d.date || '') + ' · 技术史上的今天';
    });
  },

  /* ── 10 今天吃什么 ── */
  loadMenu: function () {
    var that = this;
    this.vibrate();
    var dish = MENU_DISKS[this.menuIdx % MENU_DISKS.length];
    this.mk1 = '正在获取…'; this.mk2 = ''; this.mk3 = ''; this.mkNote = dish;
    this.getJson(API + '/food/recipe?keyword=' + encodeURL(dish) + '&count=15', function (ok, d) {
      if (!ok || !d || !d.items || !d.items.length) {
        that.mk1 = '获取失败'; that.mkNote = '点「换一道」试试'; return;
      }
      /* 原始标题常带一长串后缀（"新手必备！…简单美味颜值高"），截断后很难看 →
       * 先剥（…），再挑「干净短标题」优先展示 */
      var l = d.items;
      var good = [];
      for (var i = 0; i < l.length && good.length < 3; i++) {
        var t = String(l[i].title || '');
        var pa = t.indexOf('（');
        if (pa > 3) { t = t.substring(0, pa); }
        t = trimStr(t);
        if (t && t.length <= 12 && good.indexOf(t) < 0) { good.push(t); }
      }
      for (var j = 0; j < l.length && good.length < 3; j++) {
        var t2 = trimStr(String(l[j].title || '').substring(0, 12));
        if (t2 && good.indexOf(t2) < 0) { good.push(t2); }
      }
      that.mk1 = good[0] || '没找到做法';
      that.mk2 = good[1] || '';
      that.mk3 = good[2] || '';
      that.mkNote = '「' + dish + '」的做法 · 点「换一道」';
    });
  },

  nextMenu: function () {
    this.vibrate();
    this.menuIdx = (this.menuIdx || 0) + 1;
    this.loadMenu();
  },

  /* ── 切屏 ── */
  applyScreen: function (i) {
    this.curIdx = i;
    this.pageText = (i + 1) + '/' + TOOL_PAGES;
  },

  onSwiperChange: function (e) {
    var i = -1;
    if (e) {
      if (typeof e.index === 'number') { i = e.index; }
      else if (typeof e.currentIndex === 'number') { i = e.currentIndex; }
    }
    if (i < 0) { return; }
    this.applyScreen(i);
    if (i === 0) { this.loadWeather(); }
    else if (i === 1) { /* 翻译：等用户输入 */ }
    else if (i === 2) { this.loadWorld(); }
    else if (i === 3) { this.loadHoliday(); }
    else if (i === 4) { this.loadHot(); }
    else if (i === 5) { this.loadFx(); }
    else if (i === 6) { this.loadBox(); }
    else if (i === 7) { this.loadEpic(); }
    else if (i === 8) { this.loadProg(); }
    else if (i === 9) { this.loadMenu(); }
  },

  /* ⚠️ 屏幕兜底点击 **必须哑火**（2026-09-26 实测踩坑）：
   * 按钮的 click 会冒泡到 swiper 的 onclick → 兜底再执行一次同样的动作
   * （实测点一次「换一批」序号跳了 10 名）。index 页当年也踩过同类坑，
   * 结论一致：多按钮页面不要做「点屏幕兜底」，只保留显式按钮。 */
  onScreenTap: function () {
  },

  refreshCur: function () {
    this.vibrate();
    var i = this.curIdx;
    if (i === 0) { this.loadWeather(); }
    else if (i === 1) { this.retranslate(); }
    else if (i === 2) { this.loadWorld(); }
    else if (i === 3) { this.loadHoliday(); }
    else if (i === 4) { this.nextHot(); }
    else if (i === 5) { this.loadFx(); }
    else if (i === 6) { this.loadBox(); }
    else if (i === 7) { this.loadEpic(); }
    else if (i === 8) { this.loadProg(); }
    else if (i === 9) { this.nextMenu(); }
  },

  back: function () {
    this.vibrate();
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { this.toast('返回失败'); return; }
    var ok = false;
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: 'pages/index/index' }); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      try { if (typeof r.replace === 'function') { r.replace({ uri: 'pages/index/index' }); ok = true; } } catch (e) { ok = false; }
    }
    if (!ok) { this.toast('返回失败'); }
  }
};


/* 去掉字符串尾部空白（lite 无正则 → 手写） */
function trimTail(s) {
  var n = s.length;
  while (n > 0) {
    var c = s.charCodeAt(n - 1);
    if (c === 32 || c === 9 || c === 10 || c === 13) { n = n - 1; } else { break; }
  }
  return s.substring(0, n);
}/* 百分号编码（lite 无 encodeURIComponent → 手写）。
 * ⚠️ 必须做 **UTF-8 多字节**：原版只输出 1 字节/字符，中文会编成 %EA%21 这种垃圾
 * （实测导致 uapis 天气报 INVALID_PARAMETER、翻译中文必挂）——2026-09-26 踩坑修复。 */
function utf8pct(b) {
  var hex = '0123456789ABCDEF';
  return '%' + hex[(b >> 4) & 0xF] + hex[b & 0xF];
}

function encodeURL(str) {
  var out = '';
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
        c === 45 || c === 46 || c === 95 || c === 126) {
      out += str.charAt(i);
    } else if (c < 0x80) {
      out += utf8pct(c);
    } else if (c < 0x800) {
      out += utf8pct(0xC0 | (c >> 6));
      out += utf8pct(0x80 | (c & 0x3F));
    } else if (c < 0xD800 || c >= 0xE000) {
      out += utf8pct(0xE0 | (c >> 12));
      out += utf8pct(0x80 | ((c >> 6) & 0x3F));
      out += utf8pct(0x80 | (c & 0x3F));
    } else if (i + 1 < str.length) {
      /* 代理对 → 4 字节（emoji 等，CJK 用不到，兜个底） */
      var cp = 0x10000 + ((c - 0xD800) << 10) + (str.charCodeAt(i + 1) - 0xDC00);
      i++;
      out += utf8pct(0xF0 | (cp >> 18));
      out += utf8pct(0x80 | ((cp >> 12) & 0x3F));
      out += utf8pct(0x80 | ((cp >> 6) & 0x3F));
      out += utf8pct(0x80 | (cp & 0x3F));
    }
  }
  return out;
}

/* 本地词库精确/前缀查找 */
function dictFind(word) {
  var w = trimStr(word).toLowerCase();
  if (!w) { return null; }
  var list = dictList();
  var i;
  for (i = 0; i < list.length; i++) { if (list[i][0] === w) { return list[i]; } }
  for (i = 0; i < list.length; i++) { if (list[i][0].indexOf(w) === 0) { return list[i]; } }
  return null;
}

/* 本地短语查找（中文精确 → 全拼/首字母精确） */
function phraseFind(zh) {
  var t = trimStr(zh);
  var list = phraseList();
  var i;
  for (i = 0; i < list.length; i++) { if (list[i][0] === t) { return list[i]; } }
  var low = t.toLowerCase();
  for (i = 0; i < list.length; i++) {
    if (list[i][2] === low || list[i][3] === low) { return list[i]; }
  }
  for (i = 0; i < list.length; i++) { if (list[i][2].indexOf(low) === 0) { return list[i]; } }
  return null;
}

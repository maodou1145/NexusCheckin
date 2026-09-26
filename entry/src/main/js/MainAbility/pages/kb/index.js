/*
 * 自研键盘 · 独立页（双模式 × 双语言 × 拼音输入）
 *   · kbMode：tk = 输 Token｜tr = 翻译输入（模式经 $app + nx_kbmode.txt 传递）
 *   · kbLang：en = 英文优先布局｜zh = 拼音输入（打字 → 候选行选字）
 *   · 候选行一屏 5 个；中文模式点「更多字」→ 打开独立选字页 pages/pick（可滚动看全部）
 * 铁律：零正则 / 裸名 onclick / 键位静态节点（无 for）
 */

var KB_PAGES = [
  'abcdefghijklmnopqrst',
  'uvwxyz0123456789-_.',
  'ABCDEFGHIJKLMNOPQRST',
  'UVWXYZ0123456789-.'
];

var COMMON_EN = ['the', 'hello', 'thank', 'please', 'sorry', 'water', 'food', 'hotel',
  'taxi', 'ticket', 'help', 'doctor', 'police', 'price', 'money', 'time', 'today',
  'tomorrow', 'left', 'right', 'straight', 'airport', 'station', 'toilet', 'menu',
  'coffee', 'rice', 'noodle', 'chicken', 'beef', 'fish', 'fruit', 'cheap', 'expensive',
  'card', 'cash', 'phone', 'wifi', 'password', 'hospital', 'pharmacy', 'name', 'friend',
  'china', 'english', 'chinese', 'good', 'big', 'small', 'fast'];

/* 常用短语（zh 模式候选，排在单字之后）：中文,全拼,首字母;… */
var PY_TABLE = '你好,nihao,nh;早上好,zaoshanghao,zsh;晚上好,wanshanghao,wsh;谢谢,xiexie,xx;非常感谢,feichangganxie,fcgx;不客气,bukeqi,bkq;对不起,duibuqi,dbq;没关系,meiguanxi,mgx;再见,zaijian,zj;请稍等,qingshaodeng,qsd;请问,qingwen,qw;好的,haode,hd;我明白了,womingbaile,wmbl;我听不懂,wotingbudong,wtbd;你会说中文吗,nihuishuozhongwenma,nhszwm;请说慢一点,qingshuomanyidian,qsmyd;很高兴认识你,hengaoxingrenshini,hgxrsn;麻烦你了,mafannile,mfnl;没问题,meiwenti,mwt;保重,baozhong,bz;洗手间在哪里,xishoujianzainali,xsjznl;地铁站在哪里,ditiezhanzainali,dtzznl;公交站在哪里,gongjiaozhanzainali,gjzznl;怎么去机场,zenmequjichang,zmqjc;怎么去火车站,zenmequhuochezhan,zmqhcz;打车要多少钱,dacheyaoduoshaoqian,dcydsq;请带我去这个地方,qingdaiwoquzhegedifang,qdwqzgdf;这里可以停车吗,zhelikeyitingchema,zlkytcm;我迷路了,womilule,wmll;离这里远吗,lizheliyuanma,lzlym;走路要多久,zouluyaoduojiu,zlydj;下一班几点,xiayibanjidian,xybjd;我要一张票,woyaoyizhangpiao,wyyzp;请问出口在哪,qingwenchukouzaina,qwckzn;这条路对吗,zhetiaoluduima,ztldm;左转,zuozhuan,zz;右转,youzhuan,yz;一直走,yizhizou,yzz;到了吗,daolema,dlm;我在这里下车,wozaizhelixiache,wzzlxc;菜单给我看一下,caidangeiwokanyixia,cdgwkyx;有什么推荐,youshenmetuijian,ysmtj;我要这个,woyaozhege,wyzg;不要辣,buyaola,byl;少放糖,shaofangtang,sft;有素食吗,yousushima,yssm;我对花生过敏,woduihuashengguomin,wdhsgm;再来一份,zailaiyifen,zlyf;买单,maidan,md;可以刷卡吗,keyishuakama,kyskm;打包,dabao,db;好吃,haochi,hc;我吃饱了,wochibaole,wcbl;有水吗,youshuima,ysm;不要冰,buyaobing,byb;这里有WiFi吗,zheliyouWiFima,zlyWm;WiFi密码是多少,WiFimimashiduoshao,Wmmsds;请给我一双筷子,qinggeiwoyishuangkuaizi,qgwyskz;我吃素,wochisu,wcs;这道菜是什么,zhedaocaishishenme,zdcssm;这个多少钱,zhegeduoshaoqian,zgdsq;太贵了,taiguile,tgl;能便宜点吗,nengpianyidianma,npydm;可以试穿吗,keyishichuanma,kyscm;有大一号的吗,youdayihaodema,ydyhdm;有小一号的吗,youxiaoyihaodema,yxyhdm;有其他颜色吗,youqitayansema,yqtysm;我随便看看,wosuibiankankan,wsbkk;我要买这个,woyaomaizhege,wymzg;可以退货吗,keyituihuoma,kythm;有发票吗,youfapiaoma,yfpm;可以扫码吗,keyisaomama,kysmm;只收现金吗,zhishouxianjinma,zsxjm;一共多少钱,yigongduoshaoqian,ygdsq;帮我包起来,bangwobaoqilai,bwbql;这个打折吗,zhegedazhema,zgdzm;我可以用支付宝吗,wokeyiyongzhifubaoma,wkyyzfbm;我可以用微信支付吗,wokeyiyongweixinzhifuma,wkyywxzfm;请给我一个袋子,qinggeiwoyigedaizi,qgwygdz;谢谢，不用了,xiexie，buyongle,xx，byl;我要订一间房,woyaodingyijianfang,wydyjf;今晚有空房吗,jinwanyoukongfangma,jwykfm;几点可以入住,jidiankeyiruzhu,jdkyrz;几点退房,jidiantuifang,jdtf;可以延时退房吗,keyiyanshituifangma,kyystfm;房间有热水吗,fangjianyoureshuima,fjyrsm;空调坏了,kongtiaohuaile,kthl;请打扫一下房间,qingdasaoyixiafangjian,qdsyxfj;请给我一条毛巾,qinggeiwoyitiaomaojin,qgwytmj;行李可以寄存吗,xinglikeyijicunma,xlkyjcm;早餐几点开始,zaocanjidiankaishi,zcjdks;有电梯吗,youdiantima,ydtm;房卡丢了,fangkadiule,fkdl;我要续住一晚,woyaoxuzhuyiwan,wyxzyw;这里安静吗,zhelianjingma,zlajm;救命,jiuming,jm;请叫救护车,qingjiaojiuhuche,qjjhc;请叫警察,qingjiaojingcha,qjjc;我生病了,woshengbingle,wsbl;我需要医生,woxuyaoyisheng,wxyys;附近有医院吗,fujinyouyiyuanma,fjyyym;我丢了护照,wodiulehuzhao,wdlhz;我的钱包被偷了,wodeqianbaobeitoule,wdqbbtl;我的手机没电了,wodeshoujimeidianle,wdsjmdl;可以借我充电器吗,keyijiewochongdianqima,kyjwcdqm;请帮我报警,qingbangwobaojing,qbwbj;这里很危险,zhelihenweixian,zlhwx;我不舒服,wobushufu,wbsf;我对这个过敏,woduizhegeguomin,wdzggm;最近的药店在哪,zuijindeyaodianzaina,zjdydzn;我需要帮助,woxuyaobangzhu,wxybz;请帮我一下,qingbangwoyixia,qbwyx;我找不到同伴了,wozhaobudaotongbanle,wzbdtbl;可以借个电话吗,keyijiegedianhuama,kyjgdhm;紧急情况,jinjiqingkuang,jjqk;现在几点,xianzaijidian,xzjd;今天几号,jintianjihao,jtjh;今天星期几,jintianxingqiji,jtxqj;明天,mingtian,mt;昨天,zuotian,zt;一个小时,yigexiaoshi,ygxs;半个小时,bangexiaoshi,bgxs;十分钟,shifenzhong,sfz;多少钱,duoshaoqian,dsq;一个人,yigeren,ygr;两个人,lianggeren,lgr;三个,sange,sg;十,shi,s;一百,yibai,yb;一千,yiqian,yq;我可以帮你吗,wokeyibangnima,wkybnm;这个怎么说,zhegezenmeshuo,zgzms;这个什么意思,zhegeshenmeyisi,zgsmys;请写下来,qingxiexialai,qxxl;请再说一遍,qingzaishuoyibian,qzsyb;你叫什么名字,nijiaoshenmemingzi,njsmmz;我叫小明,wojiaoxiaoming,wjxm;你从哪里来,nicongnalilai,ncnll;我来自中国,wolaizizhongguo,wlzzg;很高兴见到你,hengaoxingjiandaoni,hgxjdn;我在这里旅游,wozaizhelilvyou,wzzlly;我第一次来,wodiyicilai,wdycl;这里真漂亮,zhelizhenpiaoliang,zlzpl;可以拍照吗,keyipaizhaoma,kypzm;帮我拍张照,bangwopaizhangzhao,bwpzz;天气预报怎么说,tianqiyubaozenmeshuo,tqybzms;今天天气很好,jintiantianqihenhao,jttqhh;会下雨吗,huixiayuma,hxym;太热了,tairele,trl;太冷了,tailengle,tll';

/* 拼音单字表（3500 常用字，按使用频率降序）：
 *   PY_SYL  = 音节表（393 个，逗号分隔）
 *   PY_DATA = 每条 3 字符：汉字 + 2 位 36 进制音节号（紧凑编码，约 19KB） */
var PY_SYL = 'le,shi,zai,he,you,ta,bu,wo,ren,ye,wei,jiu,shang,nian,zhong,ni,yi,dao,dui,lai,yu,di,da,zhi,de,ge,hou,qu,jiang,dan,cong,yue,xia,ba,duo,ke,bing,hao,hui,chu,huo,ri,suo,xiang,qi,hen,qian,xin,que,zui,xiao,geng,ru,cai,bian,zuo,nei,ji,ting,cheng,jiao,liang,dang,san,ben,wu,men,jia,tong,chi,tian,wai,fen,fu,ze,guo,zhu,wan,yin,ceng,yuan,ne,shou,tou,nv,kai,jun,ming,er,shu,dai,xian,ying,zhan,tai,nan,zhang,jin,zong,shan,gong,ling,quan,kuai,a,ma,an,zhao,kou,zi,na,gan,ju,si,reng,dong,shao,ci,xie,bei,sha,xue,qiang,wang,fa,yang,zhou,ding,sheng,fang,chao,nin,bao,zao,bie,xing,fan,chang,la,tiao,jian,guan,tu,ping,sui,me,pa,guang,li,qin,chuan,mai,jie,qie,ban,wen,ti,mang,gang,gu,ya,gai,kuan,bi,lin,qiao,mou,jing,gao,chong,shuang,liu,qing,diao,luan,cun,duan,hu,ku,xi,gui,cha,hua,han,chan,zen,feng,tuan,gua,mu,bang,zhua,huan,yun,bai,tui,lou,dou,guai,pai,xiu,dun,nong,lie,nuan,e,gen,mo,pi,juan,pang,mao,zu,tan,leng,du,song,zhuan,she,nai,zan,tang,chun,nu,sun,huai,jue,miao,pu,zhe,heng,tao,zhai,chui,gou,zou,niang,mi,seng,zheng,pian,zhuang,meng,zhun,hai,yao,ce,xun,en,tuo,kang,shen,dian,xiong,cao,chuang,kong,zeng,ka,ruo,mei,hun,zha,peng,sai,wa,che,diu,can,ca,chou,liao,lang,lv,man,fei,rong,yan,lia,ha,shuai,ai,zhuo,ou,xu,pin,yong,za,zun,bo,sou,pao,ao,nen,shua,biao,kuo,sao,sa,huang,hong,xuan,kun,lu,lei,ning,mian,niao,chai,nie,re,po,kui,rou,tie,shai,keng,su,cui,cou,lan,nang,min,niu,yo,pan,chuo,hang,kua,pen,qiu,lve,ran,gun,rang,tun,lao,sang,fou,nao,chen,qia,cang,lun,die,cuo,zhen,kan,long,cu,sen,bin,nuo,shuan,zhui,ken,ang,kuang,rao,pei,lian,chuai,beng,hei,pie,deng,luo,pou,weng,kao,shun,shui,run,se,piao,mie,shuo,te,qiong,rui,nve,teng,jiong,cuan,suan,gei,qun,neng,zang,miu,zei,ruan,zuan';
var PY_DATA = '了00是01在02和03有04他05不06我07人08也09为0a就0b上0c年0d中0e你0f一0g到0h对0i来0j与0k地0l又04大0m之0n以0g得0o她05个0p后0q去0r将0s但0t从0u月0v下0w把0x于0k时01只0n多0y可0z并10好11会12出13或14日15所16向17已0g其18很19使01前1a新1b想17却1c它05最1d小1e更1f如1g再02才1h便1i做1j内1k及1l听1m成1n各0p事01号11叫1o两1p当1q三1r本1s无1t们1u家1v市01同1w吃1x天1y外1z即1l分20打0m副21则22像17国23住24万25因26曾27元28呢29手2a头2b作1j女2c开2d军2e名2f二2g属2h受2a带2i先2j应2k吧0x县2j心1b占2l处13区0r太2m南2n张2o今2p总2q回12山2r党1q共2s另2t全2u倒0h快2v啊2w吗2x按2y找2z口30均2e字31入1g拿32城1n干33据34四35子31书2h仍36东37少38次39些3a北3b杀3c学3d强3e写3a既1l往3f台2m原28发3g任08未0a杨3h兵10位0a明2f州3i定3j声3k五1t低0l坐1j儿2g极1l放3l朝3m主24您3n报3o早3p别3q初13性3r型3r反3s指0n乡17方3l完25常3t意0g式01左1j拉3u条3v剑3w动37官3x师01仅2p教1o哪32变1i图3y平3z府21制0n望3f岁40建3w命2f加1v场3t众0e么41怕42信1b急1l取0r光43力44数2h亲45传46买47接48且49办4a待2i文4b提4c忙4d尽2p喝03啦3u刚4e故4f体4c座1j呀4g李44令2t德0o合03右04亦0g改4h刀0h宽4i必4j居34呈1n战2l安2y掌2o林4k土3y桥4l古4f某4m惊4n搞4o冲4p双4q六4r情4s掉4t乱4u周3i几1l承1n村4v收2a半4a供2s九0b敢33余0k兼3w十01断4w似01吴1t形3r忽4x七18久0b史01卖47权2u哭4y八0x喜4z伤0c架1v归50实01差51姓3r朱24刺39关3x化52底0l含53机1l产54块2v怎55封56团57期18岛0h代2i旧0b嘴1d挂58敌0l京4n愿28墓59世01举34帮5a抓5b换5c件3w房3l宫2s云5d拜5e推5f复21句34克0z救0b楼5g具34斗5h层27奔1s届48木59怪5i抱3o拍5j交1o修5k员28欲0k何03停1m刘4r善2r单0t晚25吨5l亚4g抢3e弄5m列5n厂3t暖5o感33凭3z守2a俄5p功2s散1r义0g公2s攻2s引26投2b树2h寺35岗4e墙3e尚0c凡3s根5q末5r枪3e值0n响17势01批5s包3o替4c司35卷5t旁5u夏0w招2z冒5v族5w利44坛5x冷5y保3o假1v板4a御0k易0g妈2x度5z宋60专61忘3f射62乃63巴0x咱64支0n厚0q微0a布06升3k依0g唐65春66奇18楚13喊53份20广43怒67孙68坏69叶09哥0p决6a压4g弹0t显2j室01业09摸5r庙6b扑6c宝3o果23抬2m卒5w星3r哩44客0z摆5e借48折6d击1l戴2i呆2i奉56唱3t华52味0a始01横6e亮1p套6f兴3r仙2j倍3b格0p忌1l核03器18寨6g吓0w乘1n厅1m叹5x恨19斯35吹6h够6i姊31夫21弦2j户4x挥12岂18奏6j持1x亿0g夜09围0a局34圣3k懂37存4v念0d娘6k插51境4n密6l僧6m商0c排5j堂65争6n圆28偏6o尔2g撞6p工2s帝0l挺1m告4o千1a梦6q松60旗18准6r乐00志0n失01害6s啥3c基1l丁3j政6n咬6t劝2u宜0g侧6u寻6v恩6w印26异0g拖6x查51抗6y伸6z店70兄71帐2o智0n操72暗2y养3h呼4x托6x宗2q仗2o柄10弟0l拱2s岭2t床73劲2p君2e孔74恶5p奖0s术2h哼6e夺0y搭0m扶21佛21价1v增75戏4z歌0p切49尖3w卡76塔05弱77枚78挡1q婚79吐3y扎7a捧7b案2y塞7c尾0a挖7d夹1v搬4a扯7e丢7f施01曲0r参7g授2a斜3a挑3v擦7h亭1m扇2r尼0f临4k护4x丝35抽7i屋1t旨0n创73例44校1e料7j廊7k亩59审6z旅7l摇6t怔6n杯3b富21慢7m圈2u废7n愈0k容7o嘉1v思35征6n拔0x尤04俺2y丹0t严7p吉1l偷2b寄1l叔2h歇3a吸4z刻0z划52俩7q妖6t吻4b尸01柳4r哈7r堆0i抵0l俘21摔7s棒5a士01伏21唉7t呵03佳1v岩7p役0g埋47捉7u探5x垂6h斩2l幅21欧7v掷0n徐7w休5k样3h彩1h嫁1v壁4j俱34备3b庆4s品7x扔36握07挤1l峰56拥7y抹5r亡3f喂0a影2k执0n冰10撤7e忠0e曹72娶0r杂7z尊80妙6b拨81拳2u徒3y搜82忍08助24傻3c减3w捕06抛83壳0z律7l库4y奥84梁1p患5c嫩85互4x兽2a档1q弯25巨34寒53刷86己1l历44景4n孤4f标87展2l付21净4n敲4l倾4s扩88岸2y扫89杖2o拟0f怀69担0t园28威0a撒8a慌8b伊0g榜5a哄8c农5m勇7y悬8d孝1e剩3k坤8e录8f割0p棺3x摩5r勒8g宁8h免8i娃7d忧04尿8j径4n剧34柱24拆8k棉8i整6n峡0w固4f川46仪0g嫌2j堤0l勾6i捏8l姑4f乌1t埃7t凶71态2m扬3h槽72挨7t卫0a察51款4i哨38唤5c妻18凉1p恐74柴8k季1l刑3r剂1l摄62典70庸7y惹8m坡8n剪3w伯81庄6p掩7p墩5l亏8o壮6p席4z柔8p伴4a欠1a召2z拐5i戒48仇7i乾1a充4p朗7k卵4u息4z晋2p帖8q晃8b幕59押4g扣30健3w冠3x委0a桃6f劈5s堡3o冬37优04扁1i晒8r檐7p丑7i梅78井4n希4z抖5h擒45朵0y枝0n吊4t抚21弃18截48杆33坑8s夷0g庵2y奴67惧34俗8t婶6z困8e俊2e削3d敬4n撑1n暂64催8u乎4x叉51凑8v拾01怨28壶4x抄3m兰8w囊8x叙7w披5s填1y揪0b敏8y扭8z普6c携3a允5d务1t哟90斋6g候0q彼4j判91杈51掘6a搂5g刮58晕5d姐48廷1m伙14兑0i尝3t宣8d戳92劫48哎7t启18杭93册6u垮94喷95导0h友04崖4g欢5c丘96奶63侯0q拒34墨5r姆59什6z兆2z嗤1x捣0h巧4l习4z侍01妇21岳0v掠97拌4a堵5z侵45仰3h染98摘6g棋18撰61旋8d棍99愁7i恭2s伐3g仁08惨7g惯3x坟20拦8w屡7l坚3w丽44嚷9a捡3w仆6c扒0x技1l桂50域0k卿4s吞9b梨44倚0g劳9c拼7x序7w卦58悟1t服21咽7p控74揭48兜5h崇4p吼0q康6y挣6n侨4l予0k伞1r梢38娜32姜0s卧07模5r吵3m医0g丈2o援28坊3l彭7b刃08斑4a枯4y剥81弓2s损68擅2r丧9d匹5s凿3p揉8p垫70捐5t勿1t否9e唯0a恼9f侄0n欺18尘9g偶7v侠0w恰9h扮4a奕0g宴7p仓9i束2h串46呜1t伦9j捞9c桌7u挽25妹78卸3a乙0g搁0p斧21屏3z嵌1a倘65吕7l佣7y傅21冻37奸3w伪0a坝0x凤56晴4s叠9k撕35坦5x棱5y宅6g憋3q丐4h丛0u午1t撮9l唇66昭2z孟6q幸3r循6v旺3f寸4v恕2h塘65凝8h材1h夸94椒1o枕9m宿8t尺1x拂21振9m丸25搅1o扛6y摊5x幼04坪3z延7p掏6f昏79析4z栽02享17攀91乳1g杜5z冤28喘46妥6x棵0z寿2a奈63屯9b暮59宠4p卜81效1e巡6v拣3w乞18咳0z嫂89售2a卢8f宰02悲3b帅7s宏8c椅0g株24徙4z丰56吏44嚼6a卤8f冈4e揖0g械3a喇3u博81桑9d昆8e构6i棚7b堪9n企18拢9o匾1i惠12促9p帽5v桩6p剿1o旱53暴3o森9q捷48悔12姥9c斤2p栏8w匠0s幽04佑04唬4x塌05楞5y桶1w捆8e悉4z婆8n彬9r梯4c捎38摹5r杉2r哗52挟3a哀7t堕0y曼7m挪9s慈39栖18兔3y呛3e拴9t勤45巢3m择22坠9u帕42咧5n枉3f啃9v柜50债6g屁5s凹84敷21寓0k扳4a娇1o检3w杰48枢2h冯56搓9l卑3b拧8h哑4g巾2p播81庶2h映2k捅1w匪7n乖5i叛91挎94怯49刨83咏7y仿3l吟26儒1g危0a檀5x恒6e捻0d崔8u喉0q柬3w乍7a斟9m懒8w屈0r昂9w协3a币4j晶4n乔4l巷17梗1f慧12凸3y宾9r刊9n植0n旷9x扰9y揽8w厌7p弊4j捶6h址0n宇0k恢12俯21函53伍1t佩9z恋a0剃4c帆3s揣a1庭1m坎9n契18庇4j弧4x掀2j梭16勋6v叮3j崩a2惜4z婴2k屎01撬4l妄3f桨0s弥6l挠9f哲6d媒78愚0k帘a0券2u僵0s晓1e仔02棘1l昌3t嗜01愤20匣0w梳2h攒64橙1n揩2d嘿a3凛4k敛a0储13寡58啄7u姚6t捂1t廉a0幢73掐9h斥1x搏81厢17昔4z努67勘9n嗅5k晨9g抑0g庞5u撇a4咒3i慰0a棕2q撩7j枣3p咸2j妓1l挫9l彪87椎6h介48寝45堰7p概4h冶09垒8g杏3r呐32括88厘44吱0n妆6p孕5d寇30慎6z幌8b桦52匀5d勃81凳a5悄4l冀1l壕11幻5c卓7u咪6l乏3g傍5a嘶35夕4z徽12枷1v屑3a厨13伟0a怠2i塑8t佃70描6b橱13慕59忿20募59旦0t俏4l估4f昧78奋20撵0d榨7a凌2t戈0p搀54况9x昙5x凯2d恃01恳9v柑33坞1t愧8o欣1b丙10劣5n啸1e怜a0倦5t姨0g勺38抡9j偿3t曙2h樱2k戚18愕5p拭01恍8b僻5s歉1a尉0a惶8b搔89吁7w侮1t宵1e履7l柏5e彻7e姿31匈71庐8f抠30峻2e憨53暇0w拄24喻0k囚96框9x樊3s叭0x拘34栋37拇59呕7v悦0v圃6c宪2j嘱24央3h惰0y掖09朋7b敞3t唆16晌0c啰a6仲0e厦3c壤9a厉44晾1p槐69嗽82棠65掰5e朴6c吭8s晦12吠7n媚78嫡0l岔51拗84啼4c垦9v拓6x培9z倡3t愉0k剖a7垛0y孽8l夯93敦5l巫1t咕4f扼5p栅7a伶2t柿01榛9m拙7u宦5c嚎11宛25忆0g彰2o帜0n喧8d悍53栗44嫉1l椿66巍0a惩1n屠3y刹3c旭7w嗦16樟2o揍6j掂70嗡a8拷a9侦9m枫56攘9a昨1j叨0h叼4t孩6s傲84寂1l恤7w措9l掺7g旬6v删2r擂8g榆0k埂1f摧8u垢6i亥6s妒5z懦9s婉25奢62掸0t婿7w惑14匙01埠06徊69伺39幔7m昼3i僚7j擎4s捺32桐1w廓88桅0a哺06屿0k巩2s啤5s懈3a撼53栈2l榴4r夭6t唾6x吮aa咨31憎75杠4e吆6t栓9t峭4l凄18偎0a奠70挚0n嘀0l垄9o孵21哆0y惭7g厕6u暑2h励44侣7l坯5s勉8i噪3p嬉4z媳4z剔4c囤5l朽5k橘34乒3z凰8b抒2h悠04榄8w俭3w倔6a帚3i娄5g乓5u檬6q匆0u匿0f匕4j弛1x悼0h憾53叽1l刁4t姻26兢4n晤1t椭6x梆5a楷2d妨3l慷6y嘁18娱0k悴8u梧1t嘲3m楔3a嚣1e彤1w奄7p怖06冗7o悯8y惕4c冕8i嗓9d懊84昵0f忱9g惦70侥1o慨2d捍53椰09峦4u喳7a惫3b仑9j捌0x寥7j恬1y楣78崎18宙3i榕7o侈1x娩8i凫21搪65橡17啡7n榔7k崭2l咐21唠9c拯6n吩20哮1e咖76壹0g屉4c朦6q屹0g橄33叁1r徘5j吝4k囱0u惋25憔4l坷0z晰4z墅2h刽50圾1l唁7p唧1l嘹7j噩5p垃3u俐44傀50寞5r咆83咙9o柠8h呻6z檩4k儡8g柒18岖0r止0n正6n此39步06武1t歧18歪1z歹2i死35歼3w殃3h殉6v殊2h残7g殖0n殴7v段4w殷26殿70毁12毅0g母59每78毒5z比4j毕4j毙4j毛5v毡2l毫11毯5x氏01民8y氓4d气18氛20氢4s氧3h氨2y氮0t氯7l水ab永7y汁0n求96汇12汉53汗53汛6v汞2s江0s池1x污1t汤65汪3f汰2m汹71汽18沃07沈6z沉9g沐59沙3c沛9z沟6i没78沥44沦9j沧9i沪4x沫5r沮34河03沸7n油04治0n沼2z沽4f沾2l沿7p泄3a泉2u泊8n泌6l法3g泛3s泞8h泡83波81泣18泥0f注24泪8g泰2m泳7y泵a2泻3a泼8n泽22洁48洋3h洒8a洗4z洛a6洞37津2p洪8c洲3i活14洼7d洽9h派5j流4r浅1a浆0s浇1o浊7u测6u济1l浑79浓5m浙6d浦6c浩11浪7k浮21浴0k海6s浸2p涂3y消1e涉62涌7y涎2j涕4c涛6f涝9c涡07涣5c涤0l润ac涧3w涨2o涩ad涮9t涯4g液09涵53淀70淆1e淋4k淌65淑2h淘6f淡0t淤0k淫26淮69深6z淳66混79淹7p添1y清4s渊28渐3w渔0k渗6z渠0r渡5z渣7a渤81温4b港4e渴0z游04渺6b湃5j湖4x湘17湾25湿01溃8o溅3w溉4h源28溜4r溢0g溪4z溯8t溶7o溺0f滋31滑52滓31滔6f滚99滞0n满7m滤7l滥8w滨9r滩5x滴0l漂ae漆18漏5g漓44演7p漠5r漩8d漫7m漱2h漾3h潘91潜1a潦9c潭5x潮3m澄1n澈7e澎7b澜8w澡3p澳84激1l濒9r瀑6c灌3x火14灭af灯a5灰12灵2t灶3p灸0b灼7u灾02灿7g炉8f炊6h炎7p炒3m炕6y炫8d炬34炭5x炮83炸7a点70炼a0烁ag烂8w烈5n烘8c烙9c烛24烟7p烤a9烦3s烧38烫65热8m烹7b焊53焕5c焙3b焚20焦1o焰7p然98煌8b煎3w煞3c煤78照2z煮24熄4z熊71熏6v熔7o熙4z熟2h熬84燃98燎7j燕7p燥3p爆3o爪2z爬42爱7t爵6a父21爷09爸0x爹9k爽4q片6o版4a牌5j牍5z牙4g牛8z牡59牢9c牧59物1t牲3k牵1a特ah牺4z犀4z犁44犬2u犯3s状6p犹04狂9x狈3b狐4x狗6i狞8h狠19狡1o独5z狭0w狮01狰6n狱0k狸44狼7k猎5n猖3t猛6q猜1h猩3r猪24猫5v猬0a献2j猴0q猾52猿28玄8d率7l玉0k王3f玖0b玛2x玩25玫78环5c现2j玲2t玷70玻81珊2r珍9m珠24班4a球96琅7k理44琉4r琐16琢1j琳4k琴45琼ai瑞aj瑟ad瑰50璃44璧4j瓜58瓢ae瓣4a瓤9a瓦7d瓮a8瓶3z瓷39甘33甚6z甜1y生3k甥3k用7y甩7s甫21田1y由04甲1v申6z电70男2n甸70画52畅3t界48畏0a畔91留4r畜13略97畦18番3s畴7i畸1l疆0s疏2h疑0g疗7j疙0p疚0b疟ak疤0x疫0g疮73疯56疲5s疹9m疼al疾1l病10症6n痊2u痒3h痕19痘5h痛1w痢44痪5c痰5x痴1x痹4j瘟4b瘤4r瘦2a瘩0m瘪3q瘫5x瘸1c瘾26癌7t癞0j癣8d登a5白5e百5e皂3p的0o皆48皇8b皮5s皱3i皿8y盅0e盆95盈2k益0g盏2l盐7p监3w盒03盔8o盖4h盗0h盘91盛3k盟6q目59盯3j盲4d直0n相17盹5l盼91盾5l省3k眉78看9n真9m眠8i眨7a眯6l眶9x眷5t眼7p着6d睁6n睛4n睡ab督5z睦59睬1h睹5z瞄6b瞎0w瞒7m瞧4l瞪a5瞬aa瞭7j瞳1w瞻2l矗13矛5v矢01知0n矩34矫1o短4w矮7t石01矾3s矿9x码2x砂3c砌18砍9n研7p砖61砚7p砰7b破8n砸7z砾44础13硅50硕ag硝1e硫4r硬2k确1c硼7b碉4t碌8f碍7t碎40碑3b碗25碘70碟9k碧4j碰7b碱3w碳5x碴51碾0d磁39磅5a磕0z磨5r磷4k磺8b礁1o示01礼44社62祈18祖5w祝24神6z祟40祠39祥17票ae祭1l祷0h祸14禀10禁2p福21离44禽45禾03秀5k私35秃3y秆33秉10秋96种0e科0z秒6b秕4j秘6l租5w秤1n秦45秧3h秩0n秫2h积1l称1n秸48移0g秽12稀4z程1n稍38税ab稚0n稠7i稳4b稻0h稼1v稽1l稿4o穆59穗40穴3d究0b穷ai空74穿46突3y窃49窄6g窍4l窑6t窒0n窖1o窗73窘am窜an窝07窟4y窥8o窿9o立44竖2h站2l竞4n竟4n章2o竣2e童1w竭48端4w竹24竿33笆0x笋68笑1e笔4j笙3k笛0l笤3v符21笨1s第0l笼9o等a5筋2p筏3g筐9x筑24筒1w答0m策6u筛8r筝6n筷2v筹7i签1a简3w箍4f箕1l算ao管3x箩a6箫1e箭3w箱17篇6o篓5g篙4o篡an篮8w篱44篷7b簇9p簸81簿06籍1l米6l类8g籽31粉20粒44粗9p粘2l粟8t粤0v粥3i粪20粮1p粱1p粹8u精4n糊4x糕4o糖65糙72糜6l糟3p糠6y糯9s系4z紊4b素8t索16紧2p紫31累8g絮7w繁3s纠0b红8c纤2j约0v级1l纪1l纫08纬0a纯66纱3c纲4e纳32纵2q纷20纸0n纹4b纺3l纽8z线2j练a0组5w绅6z细4z织0n终0e绊4a绍38绎0g经4n绑5a绒7o结48绕9y绘12给ap络a6绝6a绞1o统1w绢5t绣5k继1l绩1l绪7w续7w绰92绳3k维0a绵8i绷a2绸7i综2q绽2l绿7l缀9u缅8i缆8w缎4w缓5c缔0l缕7l编1i缘28缚21缝56缠54缤9r缨2k缩16缭7j缰0s缴1o缸4e缺1c罐3x网3f罕53罗a6罚3g罢0x罩2z罪1d置0n署2h羊3h美78羔4o羞5k羡2j群aq羹1f羽0k翁a8翅1x翎2t翔17翘4l翠8u翩6o翰53翻3s翼0g耀6t老9c考a9者6d而2g耍86耐63耕1f耗11耘5d耙0x耳2g耸60耻1x耽0t耿1f聂8l聊7j聋9o职0n联a0聘7x聚34聪0u肃8t肄0g肆35肉8p肋00肌1l肖1e肘3i肚5z肛4e肝33肠3t股4f肢0n肤21肥7n肩3w肪3l肮9w肯9v育0k肴6t肺7n肾6z肿0e胀2o胁3a胃0a胆0t背3b胎2m胖5u胚9z胜3k胞3o胡4x胧9o胯94胰0g胳0p胶1o胸71能ar脂0n脆8u脉47脊1l脏as脐18脑9f脓5m脖81脚1o脯6c脱6x脸a0脾5s腊3u腋09腌7p腐21腔3e腕25腥3r腮7c腰6t腹21腺2j腻0f腾al腿5f膀5a膊81膏4o膘87膛65膜5r膝4z膨7b膳2r臀9b臂4j臊89臣9g自31臭7i至0n致0n臼0b舀6t舅0b舆0k舌62舍62舒2h舔1y舞1t舟3i航93般4a舰3w舱9i舵0y舶81舷2j船46艇1m艘82良1p艰3w色ad艳7p艺0g艾7t节48芋0k芍38芒4d芙21芜1t芝0n芥48芦8f芬20芭0x芯1b花52芳3l芹45芽4g苇0a苍9i苏8t苔2m苗6b苛0z苞3o苟6i若77苦4y苫2r英2k苹3z茁7u茂5v范3s茄1v茅5v茉5r茎4n茧3w茫4d茬51茴12茵26茶51茸7o荆4n草72荐3w荒8b荔44荚1v荞4l荠1l荡1q荣7o荤79荧2k药6t荷03荸4j莉44莫5r莱0j莲a0获14莹2k莺2k莽4d菇4f菊34菌2e菜1h菠81菩6c菱2t菲7n萄6f萌6q萍3z萎0a萝a6萤2k营2k萧1e萨8a落a6著24葛0p葡6c董37葫4x葬as葱0u葵8o蒂0l蒋0s蒙6q蒜ao蒲6c蒸6n蒿11蓄7w蓉7o蓖4j蓝8w蓬7b蔑af蔓7m蔗6d蔚0a蔫0d蔬2h蔼7t蔽4j蕉1o蕊aj蕴5d蕾8g薄3o薇0a薛3d薪1b薯2h藏9i藐6b藕7v藤al藻3p蘑5r蘸2l虎4x虏8f虐ak虑7l虚7w虫4p虱01虹8c虽40虾0w蚀01蚁0g蚂2x蚊4b蚌5a蚓26蚕7g蚜4g蚣2s蚤3p蚪5h蚯96蛀24蛆0r蛇62蛉2t蛋0t蛔12蛙7d蛛24蛤7r蛮7m蛹7y蛾5p蜀2h蜂56蜈1t蜒7p蜓1m蜕5f蜗07蜘0n蜜6l蜡3u蜻4s蝇2k蝉54蝌0z蝎3a蝗8b蝙1i蝠21蝴4x蝶9k螃5u融7o螟2f螺a6蟀7s蟆2x蟋4z蟹3a蠕1g蠢66血3d衅1b行3r衍7p衔2j街48衙4g衡6e衣0g补06表87衩51衫2r衬9g衰7s衷0e袁28袄84袋2i袍83袒5x袖5k袜7d被3b袭4z袱21裁1h裂5n装6p裆1q裕0k裙aq裤4y裳0c裸a6裹23褂58褐03褒3o褥1g褪5f襟2p西4z要6t覆21见3w观3x规50觅6l视01览8w觉6a角1o解48触13言7p誉0k誊al誓01警4n譬5s计1l订3j认08讥1l讨6f让9a训6v议0g讯6v记1l讲0s讳12讶4g许7w讹5p论9j讼60讽56设62访3l诀6a证6n评3z诅5w识01诈7a诉8t诊9m词39译0g试01诗01诚1n话52诞0t诡50询6v该4h详17诫48诬1t语0k误1t诱04诲12说ag诵60请4s诸24诺9s读5z诽7n课0z谁ab调4t谅1p谆6r谈5x谊0g谋4m谍9k谎8b谐3a谒09谓0a谚7p谜6l谢3a谣6t谤5a谦1a谨2p谬at谭5x谱6c谴1a谷4f豁14豆5h豌25象17豪11豫0k豹3o豺8k貌5v贝3b贞9m负21贡2s财1h责22贤2j败5e账2o货14质0n贩3s贪5x贫7x贬1i购6i贮24贯3x贰2g贱3w贴8q贵50贷2i贸5v费7n贺03贼au贾1v贿12赁4k赂8f赃as资31赊62赋21赌5z赎2h赏0c赐39赔9z赖0j赘9u赚61赛7c赞64赠75赡2r赢2k赤1x赦62赫03走6j赴21赵2z赶33起18趁9g超3m越0v趋0r趟65趣0r足5w趴42趾0n跃0v跋0x跌9k跑83跛81距34跟5q跨94跪50路8f跳3v践3w跷4l跺0y踊7y踏05踢4c踩1h踪2q踱0y蹂8p蹄4c蹈0h蹋05蹦a2蹬a5蹭27蹲5l躁3p躏4k身6z躬2s躯0r躲0y躺65车7e轧4g轨50轩8d转61轮9j软av轰8c轴3i轻4s载02轿1o较1o辅21辆1p辈3b辉12辐21辑1l输2h辕28辖0w辙6d辛1b辜4f辞39辟5s辣3u辨1i辩1i辫1i辰9g辱1g边1i辽7j达0m迁1a迂0k迄18迅6v过23迈47迎2k运5d近2p返3s还6s这6d进2p远28违0a连a0迟1x迫8n述2h迷6l迹1l追9u退5f送60适01逃6f逆0f选8d逊6v透2b逐24递0l途3y逗5h通1w逛43逝01逞1n速8t造3p逢56逮2i逸0g逻a6逼4j逾0k遂40遇0k遍1i遏5p道0h遗0g遣1a遥6t遭3p遮6d遵80避4j邀6t邑0g邓a5邢3r那32邦5a邪3a邮04邻4k郁0k郊1o郎7k郑6n部06郭23都5h鄙4j酌7u配9z酒0b酗7w酝5d酣53酥8t酪9c酬7i酱0s酵1o酷4y酸ao酿6k醇66醉1d醋9p醒3r采1h释01里44重0e野09量1p金2p鉴3w针9m钉3j钓4t钙4h钝5l钞3m钟0e钠32钢4e钥6t钦45钧2e钩6i钮8z钱1a钳1a钻aw钾1v铁8q铃2t铅1a铆5v铐a9铛1q铜1w铝7l铡7a铣4z铭2f铲54银26铸24铺6c链a0销1e锁16锄13锅23锈5k锉9l锋56锌1b锐aj错9l锚5v锡4z锣a6锤6h锥9u锦2p锨2j锭3j键3w锯34锰6q锹4l锻4w镀5z镇9m镊8l镐4o镜4n镣7j镰a0镶17长2o门1u闪2r闭4j问4b闯73闰ac闲2j间3w闷1u闸7a闹9f闺50闻4b闽8y阀3g阁0p阅0v阎7p阐54阔88队0i阱4n防3l阳3h阴26阵9m阶48阻5w阿2w附21际1l陆8f陈9g陋5g陌5r降0s限2j陕2r陡5h院28除13陨5d险2j陪9z陵2t陶6f陷2j隅0k隆9o随40隐26隔0p隘7t隙4z障2o隧40隶44难2n雀1c雁7p雄71雅4g集1l雇4f雌39雏13雕4t雨0k雪3d雳44零2t雷8g雹3o雾1t需7w震9m霉78霍14霎3c霜4q霞0w露8f霸0x霹5s青4s靖4n静4n非7n靠a9靡6l面8i革0p靴3d靶0x鞋3a鞍2y鞠34鞭1i韧08韩53韭0b音26韵5d页09顶3j顷4s项17顺aa须7w顽25顾4f顿5l颁4a颂60预0k颅8f领2t颇8n颈4n颊1v频7x颓5f颖2k颗0z题4c颜7p额5p颠70颤54风56飒8a飘ae飞7n食01餐7g饥1l饭3s饮26饰01饱3o饲35饵2g饶9y饺1o饼10饿5p馁1k馅2j馆3x馋54馍5r馏4r馒7m首2a香17马2x驮6x驯6v驰1x驱0r驳81驴7l驶01驹34驻24驼6x驾1v骂2x骄1o骆a6骇6s验7p骏2e骑18骗6o骚89骡a6骤3i骨4f髓40高4o鬓9r鬼50魁8o魂79魄8n魏0a魔5r鱼0k鲁8f鲜2j鲤44鲫1l鲸4n鳄5p鳍18鳖3q鳞4k鸟8j鸠0b鸡1l鸣2f鸥7v鸦4g鸭4g鸯3h鸳28鸵6x鸽0p鸿8c鹃5t鹅5p鹉1t鹊1c鹏7b鹤03鹦2k鹰2k鹿8f麦47麸21麻2x黄8b黍2h黎44黑a3黔1a默5r鼎3j鼓4f鼠2h鼻4j齐18齿1x龄2t龙9o龟50';

var FILE_TOKEN = 'internal://app/nx_token.txt';
var FILE_TR = 'internal://app/nx_tr.txt';
var FILE_MODE = 'internal://app/nx_kbmode.txt';
var FILE_STATE = 'internal://app/nx_kbstate.txt';
var FILE_PICK = 'internal://app/nx_pick.txt';
var FILE_PICKRES = 'internal://app/nx_pickres.txt';

var PY_CHAR_LIST = null;
var PY_LIST = null;
var PY_WORDS = null;      /* 词组词典原始串「词,全拼;…」（rawfile，词频降序）⚠️ 不解析成数组：
                           * 真机 RAM 仅 512KB，几千条 JS 数组+字符串对象 ≈ 数 MB 必炸；
                           * 只留一个字符串，匹配时流式扫描（scanWords），峰值内存=串本体 */
var dictTried = false;

function b36(s) {
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) { n = n * 36 + (c - 48); }
    else if (c >= 97 && c <= 122) { n = n * 36 + (c - 87); }
    else if (c >= 65 && c <= 90) { n = n * 36 + (c - 55); }
  }
  return n;
}

function pyChars() {
  if (PY_CHAR_LIST) { return PY_CHAR_LIST; }
  var syls = PY_SYL.split(',');
  var out = [];
  for (var i = 0; i + 2 < PY_DATA.length; i += 3) {
    var c = PY_DATA.charAt(i);
    var full = syls[b36(PY_DATA.substr(i + 1, 2))] || '';
    if (c && full) { out.push([c, full, full.charAt(0)]); }
  }
  PY_CHAR_LIST = out;
  return out;
}

function pyList() {
  if (PY_LIST) { return PY_LIST; }
  PY_LIST = [];
  var seg = PY_TABLE.split(';');
  for (var i = 0; i < seg.length; i++) {
    var it = seg[i].split(',');
    if (it.length >= 3 && it[0]) { PY_LIST.push([it[0], it[1], it[2]]); }
  }
  return PY_LIST;
}

function toInt(s) {
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) { n = n * 10 + (c - 48); } else { break; }
  }
  return n;
}

function trimTail(s) {
  var n = s.length;
  while (n > 0) {
    var c = s.charCodeAt(n - 1);
    if (c === 32 || c === 9 || c === 10 || c === 13) { n = n - 1; } else { break; }
  }
  return s.substring(0, n);
}

export default {
  data: {
    kbMode: 'tk',
    kbLang: 'en',
    langLabel: '中文',
    kbBuf: '',
    kbPy: '',
    kbPage: 0,
    kbView: '点下方键盘输入',
    kbCnt: '0 字符',
    c0: '', c1: '', c2: '', c3: '', c4: '',
    k0: '', k1: '', k2: '', k3: '', k4: '',
    k5: '', k6: '', k7: '', k8: '', k9: '',
    k10: '', k11: '', k12: '', k13: '', k14: '',
    k15: '', k16: '', k17: '', k18: '', k19: '',
    fileApi: null,
    routerApi: null,
    vibratorApi: null,
    busy: false,
    screenW: '466px',
    screenH: '466px',
    rowW: '440px',
    keyW: '82px',
    candW: '82px',
    fnW: '83px'
  },

  onInit: function () {
    this.cands = [];
    this.applyMetrics();
    this.renderKb();
    this.renderKbView();
    this.refreshCands();
    this.restoreOrInit();
  },

  /* ⚠️ $app 在本机运行时不生效（实测）→ 跨页传参一律走文件。
   * 从选字页回来时 nx_kbstate.txt 有存档 → 恢复现场；否则按调用方写的模式初始化。 */
  restoreOrInit: function () {
    var that = this;
    if (!this.ensureFile()) { this.readMode(); return; }
    try {
      this.fileApi.readText({
        uri: FILE_STATE,
        success: function (res) {
          var t = '';
          if (res) {
            if (typeof res.text === 'string') { t = res.text; }
            else if (typeof res === 'string') { t = res; }
          }
          if (t) {
            var p = t.split('\n');
            /* 只认合法存档（首行必须是 tk/tr），垃圾/残留一律忽略 */
            if (p[0] !== 'tk' && p[0] !== 'tr') { t = ''; }
          }
          if (t) {
            var p = t.split('\n');
            that.kbMode = p[0] || that.kbMode;
            that.kbLang = p[1] || that.kbLang;
            that.langLabel = that.kbLang === 'zh' ? 'English' : '中文';
            that.kbBuf = p[2] || '';
            that.kbPy = p[3] || '';
            var pg = toInt(p[4] || '0');
            that.kbPage = (pg >= 0 && pg <= 3) ? pg : 0;
            /* 中文模式只有两个字母页：存档里残留的大写/数字页直接归零 */
            if (that.kbMode === 'tr' && that.kbLang === 'zh' && that.kbPage > 1) { that.kbPage = 0; }
            that.writeFile(FILE_STATE, '');
            that.renderKb();
            that.renderKbView();
            that.refreshCands();
            that.applyPickResult();
            return;
          }
          that.readMode();
          that.applyPickResult();
        },
        fail: function () { that.readMode(); that.applyPickResult(); }
      });
    } catch (e) { this.readMode(); this.applyPickResult(); }
  },

  /* 选字页选中的字 → 上屏 */
  applyPickResult: function () {
    var that = this;
    if (!this.ensureFile()) { return; }
    try {
      this.fileApi.readText({
        uri: FILE_PICKRES,
        success: function (res) {
          var t = '';
          if (res) {
            if (typeof res.text === 'string') { t = res.text; }
            else if (typeof res === 'string') { t = res; }
          }
          if (!t) { return; }
          that.writeFile(FILE_PICKRES, '');
          that.kbBuf = that.kbBuf + t;
          that.kbPy = '';
          that.renderKbView();
          that.refreshCands();
        },
        fail: function () {}
      });
    } catch (e) {}
  },

  /* fire-and-forget 写文件（本机 writeText 回调不返回，不能等） */
  writeFile: function (uri, text) {
    if (!this.ensureFile()) { return; }
    try {
      this.fileApi.writeText({ uri: uri, text: text, success: function () {}, fail: function () {} });
    } catch (e) {}
  },

  /* 模式来源：① $app（调用方写入）② nx_kbmode.txt（lite 文件通道） */
  readMode: function () {
    var that = this;
    try {
      if (typeof $app !== 'undefined' && $app && $app.nxKbMode) {
        if (String($app.nxKbMode).indexOf('tr') === 0) { this.applyTrMode(); return; }
      }
    } catch (e) {}
    if (this.kbMode === 'tr') { this.applyTrMode(); return; }
    if (!this.ensureFile()) { return; }
    try {
      this.fileApi.readText({
        uri: FILE_MODE,
        success: function (res) {
          var t = '';
          if (res) {
            if (typeof res.text === 'string') { t = res.text; }
            else if (typeof res === 'string') { t = res; }
          }
          if (t && t.indexOf('tr') === 0) { that.applyTrMode(); }
        },
        fail: function () {}
      });
    } catch (e) {}
  },

  applyTrMode: function () {
    this.kbMode = 'tr';
    this.renderKbView();
    this.refreshCands();
  },

  returnPage: function () {
    return this.kbMode === 'tr' ? 'pages/daily/index' : 'pages/index/index';
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
          that.candW = Math.floor((w - 46) / 5) + 'px';
          that.fnW = Math.floor((w - 50) / 5) + 'px';
        },
        fail: function () {}
      });
    } catch (e) {}
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

  vibrate: function () {
    if (!this.vibratorApi) {
      try { this.vibratorApi = require('@system.vibrator'); } catch (e) { this.vibratorApi = null; }
    }
    if (!this.vibratorApi) { return; }
    try { this.vibratorApi.vibrate({ mode: 'short' }); } catch (e) {}
  },

  renderKb: function () {
    var page = KB_PAGES[this.kbPage] || '';
    for (var i = 0; i < 20; i++) { this['k' + i] = page.charAt(i); }
    if (!this.k19) { this.k19 = '空格'; }
  },

  renderKbView: function () {
    var t = this.kbBuf;
    var n = t.length;
    if (n > 12) { this.kbView = '…' + t.substring(n - 12); }
    else if (n) { this.kbView = t; }
    else { this.kbView = this.kbMode === 'tr' ? '输入要翻译的文字' : '点下方键盘输入'; }
    if (this.kbMode === 'tr' && this.kbLang === 'zh' && this.kbPy) {
      this.kbView = this.kbView + ' ' + this.kbPy;
    }
    this.kbCnt = n + ' 字符 · ' + (this.kbMode === 'tr' ? (this.kbLang === 'zh' ? '中文拼音' : '英文') : 'Token');
  },

  /* 词组词典（rawfile/py_words.txt：词,全拼; 词频降序）——rawfile 不占页面 55KB 预算。
   * 模拟器/读不到时静默退回「常用语+单字」，真机加载后自动补一次候选刷新 */
  loadWordDict: function () {
    if (dictTried || PY_WORDS) { return; }
    dictTried = true;
    if (!this.ensureFile()) { return; }
    var that = this;
    try {
      this.fileApi.readText({
        uri: 'internal://rawfile/py_words.txt',
        success: function (res) {
          var t = '';
          if (res) {
            if (typeof res.text === 'string') { t = res.text; }
            else if (typeof res === 'string') { t = res; }
          }
          /* 只留原始字符串（≈118KB），绝不 split 成几千条数组（512KB RAM 红线） */
          if (t && t.length > 100) {
            PY_WORDS = t;
            that.refreshCands();
          }
        },
        fail: function () {}
      });
    } catch (e) {}
  },

  wordDict: function () {
    if (!PY_WORDS && !dictTried) { this.loadWordDict(); }
    return PY_WORDS;
  },

  /* 在原始词库串上流式扫描：opt=0 全拼精确 / 1 全拼前缀。命中才 push（去重），
   * 临时子串即用即弃，不产生大数组 */
  scanWords: function (t, q, opt, all) {
    var pos = 0;
    while (pos < t.length) {
      var end = t.indexOf(';', pos);
      if (end < 0) { end = t.length; }
      var cm = t.indexOf(',', pos);
      if (cm > pos && cm < end) {
        var py = t.substring(cm + 1, end);
        var hit = opt === 0 ? (py === q) : (py !== q && py.indexOf(q) === 0);
        if (hit) {
          var w = t.substring(pos, cm);
          if (all.indexOf(w) < 0) { all.push(w); }
        }
      }
      pos = end + 1;
    }
  },

  /* 算出全部匹配（选字页也用它），候选行只显示前 5 个 */
  buildCands: function () {
    var all = [];
    var j;
    if (this.kbMode === 'tr' && this.kbLang === 'zh') {
      var cs = pyChars();
      var ps = pyList();
      var ws = this.wordDict();
      var q = this.kbPy.toLowerCase();
      if (q) {
        /* ① 单字全拼精确（频率序） */
        for (j = 0; j < cs.length; j++) {
          if (cs[j][1] === q && all.indexOf(cs[j][0]) < 0) { all.push(cs[j][0]); }
        }
        /* ② 词组全拼精确 → ③ 词组全拼前缀（边打边出词，词频序，流式扫描） */
        if (ws) {
          this.scanWords(ws, q, 0, all);
          this.scanWords(ws, q, 1, all);
        }
        /* ④ 常用语（全拼/首字母前缀） */
        for (j = 0; j < ps.length; j++) {
          if ((ps[j][1].indexOf(q) === 0 || ps[j][2].indexOf(q) === 0) && all.indexOf(ps[j][0]) < 0) { all.push(ps[j][0]); }
        }
        /* ⑤ 单字前缀 */
        for (j = 0; j < cs.length; j++) {
          if (cs[j][1] !== q && cs[j][1].indexOf(q) === 0 && all.indexOf(cs[j][0]) < 0) { all.push(cs[j][0]); }
        }
      } else {
        for (j = 0; j < cs.length; j++) { all.push(cs[j][0]); }
      }
    } else if (this.kbMode === 'tr') {
      var q2 = trimTail(this.kbBuf.toLowerCase());
      var last = q2;
      var sp = q2.lastIndexOf(' ');
      if (sp >= 0) { last = q2.substring(sp + 1); }
      var k;
      if (last) {
        for (k = 0; k < COMMON_EN.length; k++) {
          if (COMMON_EN[k].indexOf(last) === 0 && COMMON_EN[k] !== last) { all.push(COMMON_EN[k]); }
        }
      } else {
        for (k = 0; k < COMMON_EN.length; k++) { all.push(COMMON_EN[k]); }
      }
    }
    this.cands = all;
    return all;
  },

  refreshCands: function () {
    var all = this.buildCands();
    var i;
    for (i = 0; i < 5; i++) {
      this['c' + i] = all[i] ? String(all[i]).substring(0, 4) : '';
    }
  },

  /* 「更多字」→ 打开独立选字页（带全部候选，可滚动） */
  openPicker: function () {
    var all = this.cands || [];
    /* ⚠️ 没打拼音时 buildCands 会把 3500 个字全倒出来 → 列表过重、卡住，直接拦掉 */
    if (this.kbMode === 'tr' && this.kbLang === 'zh' && !this.kbPy) {
      this.kbView = '先打拼音，再点「更多字」';
      return;
    }
    if (!all.length) { this.kbView = '没有候选字'; return; }
    /* 上限 120，防止超长列表拖垮手表 */
    if (all.length > 120) { all = all.slice(0, 120); }
    this.vibrate();
    /* 文件传参：nx_kbstate.txt = 现场（回来恢复）；nx_pick.txt = 全部候选（每行一个） */
    this.writeFile(FILE_STATE, this.kbMode + '\n' + this.kbLang + '\n' + this.kbBuf + '\n' + this.kbPy + '\n' + this.kbPage);
    this.writeFile(FILE_PICK, all.join('\n'));
    this.writeFile(FILE_PICKRES, '');
    /* ⚠️ 文件写是异步的：立刻跳会让选字页读到空 → 等 300ms 再跳 */
    var that = this;
    try {
      setTimeout(function () { that.goto('pages/pick/index'); }, 300);
    } catch (e) {
      this.goto('pages/pick/index');
    }
  },

  /* 「翻页」按钮：中文模式只在两个字母页间翻（u-z 在第二页，必须有键能到）；
   * 其他模式翻全部 4 页（大小写/数字符号） */
  fnPage: function () {
    this.vibrate();
    var isZh = this.kbMode === 'tr' && this.kbLang === 'zh';
    this.kbPage = this.kbPage + 1;
    if (isZh) {
      if (this.kbPage > 1) { this.kbPage = 0; }
    } else {
      if (this.kbPage >= 4) { this.kbPage = 0; }
    }
    this.renderKb();
  },

  candPick: function (i) {
    var v = (this.cands || [])[i];
    if (!v) { return; }
    this.vibrate();
    if (this.kbMode === 'tr' && this.kbLang === 'zh') {
      this.kbBuf = this.kbBuf + v;
      this.kbPy = '';
    } else {
      var t = this.kbBuf;
      var sp = t.lastIndexOf(' ');
      if (sp >= 0) { this.kbBuf = t.substring(0, sp + 1) + v + ' '; }
      else { this.kbBuf = v + ' '; }
    }
    this.renderKbView();
    this.refreshCands();
  },

  candTap0: function () { this.candPick(0); },
  candTap1: function () { this.candPick(1); },
  candTap2: function () { this.candPick(2); },
  candTap3: function () { this.candPick(3); },
  candTap4: function () { this.candPick(4); },

  kbAppend: function (ch) {
    if (!ch) { return; }
    if (ch === '空格') {
      /* 标准输入法习惯：拼音打着的时候空格=上屏首选 */
      if (this.kbMode === 'tr' && this.kbLang === 'zh' && this.kbPy) {
        this.candPick(0);
        return;
      }
      this.kbBuf = this.kbBuf + ' ';
    }
    else if (this.kbMode === 'tr' && this.kbLang === 'zh') { this.kbPy = this.kbPy + ch; }
    else { this.kbBuf = this.kbBuf + ch; }
    this.renderKbView();
    this.refreshCands();
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
    if (this.kbMode === 'tr' && this.kbLang === 'zh' && this.kbPy) {
      this.kbPy = this.kbPy.substring(0, this.kbPy.length - 1);
    } else if (this.kbBuf.length) {
      this.kbBuf = this.kbBuf.substring(0, this.kbBuf.length - 1);
    }
    this.renderKbView();
    this.refreshCands();
  },

  kbLangToggle: function () {
    this.vibrate();
    if (this.kbMode !== 'tr') { this.kbView = '仅翻译模式可切换中英'; return; }
    this.kbLang = this.kbLang === 'zh' ? 'en' : 'zh';
    this.langLabel = this.kbLang === 'zh' ? 'English' : '中文';
    this.kbPy = '';
    this.renderKbView();
    this.refreshCands();
  },

  /* ⚠️ 本机实测 @system.router 只有 replace（无 replaceUrl）→ 两个都试 */
  goto: function (uri) {
    var r = null;
    try { r = require('@system.router'); } catch (e) { r = null; }
    if (!r) { this.kbView = '路由不可用'; return; }
    try { if (typeof r.replace === 'function') { r.replace({ uri: uri }); return; } } catch (e) {}
    try { if (typeof r.replaceUrl === 'function') { r.replaceUrl({ uri: uri }); return; } } catch (e) {}
    this.kbView = '跳转失败';
  },

  kbCancel: function () {
    this.vibrate();
    this.goto(this.returnPage());
  },

  kbDone: function () {
    this.vibrate();
    var isTr = this.kbMode === 'tr';
    if (isTr && this.kbLang === 'zh' && this.kbPy) {
      var pick = (this.cands && this.cands.length) ? this.cands[0] : this.kbPy;
      this.kbBuf = this.kbBuf + pick;
      this.kbPy = '';
      this.renderKbView();
    }
    var t = trimTail(this.kbBuf);
    if (!t || (!isTr && t.length < 20)) {
      this.kbView = isTr ? '还没输入文字' : 'Token 太短或未输入';
      return;
    }
    try {
      if (typeof $app !== 'undefined' && $app) {
        if (isTr) { $app.nxTrText = t; } else { $app.nxToken = t; }
      }
    } catch (e) {}
    if (this.ensureFile()) {
      try {
        this.fileApi.writeText({
          uri: (isTr ? FILE_TR : FILE_TOKEN),
          text: t,
          success: function () {},
          fail: function () {}
        });
      } catch (e) {}
    }
    this.goto(this.returnPage());
  }
};

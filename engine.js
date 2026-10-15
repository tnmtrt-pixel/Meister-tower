/* オリキャラ対戦：データとバトルの仕組み（画面に依存しない） */
(function(G){
const DICE=3,MAXD=6,PLAYER_HP=40,TOP=10,TOP2=20,FATIGUE=9;

/* 条件 c:{t,n} / ダメージ dmg:{b:固定,m:出目倍率} / 効果 fx / t:必要な★ */
const CHARS=[
 {id:'dodo',name:'ドド先輩',img:'img/dodo.webp',color:'#7F98BC',role:'守り型・のんびり回復',
  passive:{k:'guardStart',n:'ふかふか羽毛',d:'自分のターン開始時にガード2を得る'},
  lines:['のんびりいこうよ〜。でも負けないよ？','ふぅ、先輩の意地だね','ちょっと…昼寝しすぎたかな'],moves:[
  {n:'ドドアタック',c:{t:'any'},dmg:{b:1,m:1}},
  {n:'もふもふボディ',c:{t:'min',n:4},fx:{guard:6}},
  {n:'のんびり昼寝',c:{t:'max',n:3},fx:{heal:5}},
  {n:'先輩の貫禄',c:{t:'even'},fx:{weak:3}},
  {n:'大きなくちばし',c:{t:'min',n:5},dmg:{b:8},t:2},
  {n:'先輩の説教',c:{t:'max',n:2},dmg:{b:3},fx:{dDown:1},t:2},
  {n:'ドスコイ',c:{t:'pair'},dmg:{b:14},t:3}]},
 {id:'fox',name:'ギアフォックス',img:'img/fox.webp',color:'#2F5AA8',role:'技巧型・振り直しが得意',
  passive:{k:'reroll1',n:'器用な手先',d:'ターン開始時、出目1のサイコロを全部振り直す'},
  lines:['その構造、ぜんぶ分解してあげる！','設計どおり！','くっ、ネジが一本足りなかった…'],moves:[
  {n:'ドライバー突き',c:{t:'odd'},dmg:{b:2,m:1}},
  {n:'スパナ叩き',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'分解',c:{t:'max',n:2},dmg:{b:2},fx:{weak:3}},
  {n:'微調整',c:{t:'any'},dmg:{b:1},fx:{reroll:1}},
  {n:'ゴーグル分析',c:{t:'eq',n:6},fx:{pow:4},t:2},
  {n:'電動ドライバー',c:{t:'min',n:4},dmg:{b:3,m:1},t:2},
  {n:'組み立て完了',c:{t:'pair'},dmg:{b:14},fx:{dUp:1},t:3}]},
 {id:'wolf',name:'ウルフ',img:'img/wolf.webp',color:'#2B3A6B',role:'攻撃型・ピンチで燃える',
  passive:{k:'rage',n:'熱血',d:'体力が半分以下のとき、攻撃ダメージ+2'},
  lines:['国家資格の前に、まずはお前だ！','よっしゃ、合格ラインだ！','次は…絶対に受かる！'],moves:[
  {n:'火花',c:{t:'max',n:3},dmg:{m:2}},
  {n:'気合い',c:{t:'max',n:2},fx:{pow:4}},
  {n:'安全第一',c:{t:'even'},dmg:{b:1},fx:{guard:3},t:2},
  {n:'資格勉強',c:{t:'odd'},dmg:{b:3},fx:{dUp:1}},
  {n:'溶接ビーム',c:{t:'min',n:5},dmg:{b:9}},
  {n:'アーク放電',c:{t:'even'},dmg:{b:2,m:1},t:2},
  {n:'国家資格アタック',c:{t:'pair'},dmg:{b:17},t:3}]},
 {id:'onmyo',name:'オンミョウ',img:'img/onmyo.webp',color:'#45424A',role:'妨害型・相手を縛る',
  passive:{k:'armor',n:'鬼面',d:'受ける攻撃ダメージが常に1減る'},
  lines:['……陰と陽、どちらに転ぶか','定めのとおり','……面白い'],moves:[
  {n:'陰の刃',c:{t:'odd'},dmg:{b:2,m:1}},
  {n:'陽の結界',c:{t:'even'},fx:{guard:5}},
  {n:'墨染め',c:{t:'any'},dmg:{b:3},fx:{reroll:1}},
  {n:'鬼の睨み',c:{t:'min',n:4},dmg:{b:1},fx:{weak:4}},
  {n:'呪符',c:{t:'max',n:2},dmg:{b:2},fx:{dDown:1},t:2},
  {n:'式神召喚',c:{t:'min',n:4},dmg:{b:3},fx:{guard:2},t:2},
  {n:'陰陽転生',c:{t:'pair'},dmg:{b:10},fx:{heal:6},t:3}]},
 {id:'tsukiyo',name:'ツキヨ',img:'img/tsukiyo.webp',color:'#1E2A5A',role:'技巧型・ゾロ目で輝く',
  passive:{k:'pairPow',n:'星降る夜',d:'ターン開始時にゾロ目が出ていたら次の攻撃+3'},
  lines:['星が、きみの負けを告げてる','星読みどおり','今夜は曇りだったか…'],moves:[
  {n:'星の爪',c:{t:'any'},dmg:{m:1}},
  {n:'三日月',c:{t:'max',n:3},dmg:{b:2,m:1}},
  {n:'夜空の翼',c:{t:'min',n:4},dmg:{b:6}},
  {n:'歯車の加護',c:{t:'even'},fx:{guard:3,dUp:1}},
  {n:'星読み',c:{t:'max',n:2},fx:{pow:3,reroll:1},t:2},
  {n:'星座の導き',c:{t:'even'},dmg:{b:5},fx:{dUp:1},t:2},
  {n:'流れ星',c:{t:'eq',n:6},dmg:{b:14},t:3}]},
 {id:'mouse',name:'チュータ',img:'img/mouse.webp',color:'#6F95C8',role:'小技型・ロボと連携',
  passive:{k:'smallHit',n:'ちょこちょこ',d:'ダメージ5以下の攻撃は+2'},
  lines:['チュー！ロボと一緒にがんばるぞ！','やったチュー！','ロボ、修理しなきゃ…'],moves:[
  {n:'かじる',c:{t:'any'},dmg:{b:3}},
  {n:'スパナパンチ',c:{t:'even'},dmg:{b:4}},
  {n:'ロボ発進',c:{t:'min',n:4},dmg:{b:1,m:1}},
  {n:'ロボ修理',c:{t:'odd'},fx:{heal:4}},
  {n:'ちょこまか',c:{t:'max',n:3},dmg:{b:1},fx:{reroll:1},t:2},
  {n:'ロボビーム',c:{t:'min',n:5},dmg:{b:9},t:2},
  {n:'ロボ合体',c:{t:'pair'},dmg:{b:18},fx:{guard:5},t:3}]},
 {id:'owl',name:'ホー博士',img:'img/owl.webp',color:'#8A6A45',role:'強化型・計算して一撃',
  passive:{k:'powBonus',n:'博識',d:'「次の攻撃+」の効果がさらに+1'},
  lines:['計算はすでに終わっておる','ホッホッ、理論どおりじゃ','計算に誤差があったか…'],moves:[
  {n:'設計図',c:{t:'max',n:3},fx:{pow:4}},
  {n:'理論武装',c:{t:'even'},fx:{guard:5}},
  {n:'ホーホー',c:{t:'odd'},dmg:{b:2},fx:{weak:3}},
  {n:'博士の一撃',c:{t:'min',n:5},dmg:{b:3,m:1}},
  {n:'夜目',c:{t:'max',n:2},fx:{dUp:1,reroll:1},t:2},
  {n:'精密計算',c:{t:'even'},dmg:{b:4,m:1},t:2},
  {n:'完璧な設計',c:{t:'pair'},dmg:{b:16},fx:{pow:3},t:3}]},
 {id:'gorilla',name:'ボルトゴリラ',img:'img/gorilla.webp',color:'#3E8E3A',role:'攻撃型・電撃パワー',
  passive:{k:'six',n:'パワー全開',d:'出目6を使った攻撃のダメージ+3'},
  lines:['フルパワーでいくぜ、ウホッ！','100万ボルトの勝利だ！','充電…切れ…'],moves:[
  {n:'放電',c:{t:'even'},dmg:{b:1,m:1}},
  {n:'胸たたき',c:{t:'max',n:2},fx:{pow:5}},
  {n:'コード書き換え',c:{t:'odd'},dmg:{b:1},fx:{reroll:1}},
  {n:'電撃パンチ',c:{t:'min',n:4},dmg:{b:1,m:1}},
  {n:'ハイボルテージ',c:{t:'eq',n:6},dmg:{b:12},fx:{dDown:1},t:2},
  {n:'ジャングルボルト',c:{t:'odd'},dmg:{b:2,m:1},t:2},
  {n:'100万ボルト',c:{t:'pair'},dmg:{b:16},t:3}]},
 {id:'robot',name:'メカロボ',img:'img/robot.webp',color:'#2E6FD8',role:'守り型・安定して戦う',
  passive:{k:'regen',n:'自己修復',d:'自分のターン終了時に体力2回復'},
  lines:['戦闘モード、起動シマス','ミッション、完了','システム…ダウン…'],moves:[
  {n:'ロボパンチ',c:{t:'any'},dmg:{b:3}},
  {n:'センサー照準',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'アーマーモード',c:{t:'min',n:3},fx:{guard:5}},
  {n:'修理プログラム',c:{t:'odd'},fx:{heal:4}},
  {n:'ブースター',c:{t:'max',n:2},fx:{dUp:1},t:2},
  {n:'ロケットパンチ',c:{t:'min',n:5},dmg:{b:10},t:2},
  {n:'フルバースト',c:{t:'pair'},dmg:{b:14},fx:{guard:3},t:3}]},
 {id:'rocker',name:'セブンティーン',img:'img/rocker.webp',color:'#A82828',role:'一発逆転型・ギャンブラー',
  passive:{k:'gamble',n:'ロックンロール',d:'毎ターン サイコロ+1個。ただしターン開始時に1ダメージ'},
  lines:['俺のギターで、黙らせてやるよ','アンコールはいらねぇ','……今日は弦が切れただけだ'],moves:[
  {n:'ギターソロ',c:{t:'any'},dmg:{m:1}},
  {n:'シャウト',c:{t:'odd'},dmg:{b:2},fx:{weak:3}},
  {n:'ギタースマッシュ',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'アンコール',c:{t:'max',n:2},fx:{dUp:1,reroll:1}},
  {n:'パワーコード',c:{t:'min',n:5},dmg:{b:9},t:2},
  {n:'スピーカー爆音',c:{t:'even'},dmg:{b:3},fx:{weak:2},t:2},
  {n:'ジュウナナ',c:{t:'pair'},dmg:{b:17},t:3}]},
];
const HIDDEN={id:'takumi',name:'匠',img:'img/takumi.webp',crest:'匠',color:'#A87A12',role:'隠しキャラ・塔の主',hidden:true,
  passive:{k:'master',n:'マイスターの技',d:'攻撃ダメージ+1、得るガード+1'},
  lines:['夜に磨く、未来を創る力を見せてよ！','まだまだ磨きが足りないね。また挑戦してよ！','すごい！ きみこそ本物のマイスターだよ！'],moves:[
  {n:'匠の一打',c:{t:'any'},dmg:{m:1}},
  {n:'研ぎ澄ます',c:{t:'max',n:2},fx:{pow:4}},
  {n:'段取り八分',c:{t:'even'},fx:{guard:4,dUp:1}},
  {n:'仕上げ',c:{t:'min',n:4},dmg:{b:6}},
  {n:'精密加工',c:{t:'odd'},dmg:{b:3,m:1},t:2},
  {n:'検査',c:{t:'eq',n:1},fx:{dDown:1,weak:3},t:2},
  {n:'奥義・千本鍛え',c:{t:'pair'},dmg:{b:18},t:3}]};
const ALL=[...CHARS,HIDDEN];
ALL.forEach(c=>c.moves.forEach(m=>m.t=m.t||1));
const byId=id=>ALL.find(c=>c.id===id);

/* ---- 言語（ja / zh＝簡体字中国語） ---- */
let LANG='ja';
const L=(ja,zh)=>LANG==='zh'?zh:ja;
const ZH={
 chars:{
  dodo:{name:'多多前辈',role:'防守型·悠闲回复',pn:'蓬松羽毛',pd:'自己的回合开始时获得护盾2',lines:['慢慢来嘛～不过我可不会输哦？','呼，这就是前辈的骨气','好像……午觉睡太久了']},
  fox:{name:'齿轮狐',role:'技巧型·擅长重掷',pn:'灵巧双手',pd:'回合开始时，点数为1的骰子全部重掷',lines:['把你的结构全部拆开！','和设计的一样！','可恶，少了一颗螺丝……']},
  wolf:{name:'沃夫',role:'攻击型·越危险越燃',pn:'热血',pd:'体力在一半以下时，攻击伤害+2',lines:['在国家资格考试之前，先打倒你！','好耶，过关了！','下次……一定要考过！']},
  onmyo:{name:'阴阳',role:'干扰型·束缚对手',pn:'鬼面',pd:'受到的攻击伤害总是减少1',lines:['……阴与阳，会倒向哪一边','命中注定','……有意思']},
  tsukiyo:{name:'月夜',role:'技巧型·靠对子发光',pn:'星降之夜',pd:'回合开始时若掷出对子，下次攻击+3',lines:['星星告诉我，你会输','正如星象所示','今晚是阴天吗……']},
  mouse:{name:'啾太',role:'小技型·与机器人配合',pn:'碎步',pd:'伤害5以下的攻击+2',lines:['啾！和机器人一起加油！','赢啦啾！','机器人，得修一修了……']},
  owl:{name:'呼博士',role:'强化型·计算后一击',pn:'博学',pd:'「下次攻击+」的效果再+1',lines:['计算早已完成','呼呼，正如理论所示','计算有误差吗……']},
  gorilla:{name:'伏特猩猩',role:'攻击型·电击力量',pn:'全力输出',pd:'用点数6发动的攻击伤害+3',lines:['全力上了，吼！','百万伏特的胜利！','电……没电了……']},
  robot:{name:'机甲罗博',role:'防守型·稳定作战',pn:'自我修复',pd:'自己的回合结束时恢复2点体力',lines:['战斗模式，启动','任务，完成','系统……关闭……']},
  rocker:{name:'十七',role:'一发逆转型·赌徒',pn:'摇滚',pd:'每回合骰子+1个，但回合开始时受到1点伤害',lines:['用我的吉他让你闭嘴','不需要安可','……今天只是琴弦断了']},
  takumi:{name:'匠',role:'隐藏角色·塔之主',pn:'大师之技',pd:'攻击伤害+1，获得的护盾+1',lines:['让我看看你夜里磨练、开创未来的力量吧！','磨练得还不够哦，再来挑战吧！','好厉害！你才是真正的大师！']},
 },
 moves:{
  'ドドアタック':'多多冲撞','もふもふボディ':'毛茸茸身体','のんびり昼寝':'悠闲午睡','先輩の貫禄':'前辈的威严','大きなくちばし':'大鸟喙','先輩の説教':'前辈的说教','ドスコイ':'嘿咻猛推',
  'ドライバー突き':'螺丝刀突刺','スパナ叩き':'扳手敲击','分解':'拆解','微調整':'微调','ゴーグル分析':'护目镜分析','電動ドライバー':'电动螺丝刀','組み立て完了':'组装完成',
  '火花':'火花','気合い':'鼓劲','安全第一':'安全第一','資格勉強':'资格学习','溶接ビーム':'焊接光束','アーク放電':'电弧放电','国家資格アタック':'国家资格攻击',
  '陰の刃':'阴之刃','陽の結界':'阳之结界','墨染め':'墨染','鬼の睨み':'鬼之瞪视','呪符':'咒符','式神召喚':'召唤式神','陰陽転生':'阴阳转生',
  '星の爪':'星之爪','三日月':'新月','夜空の翼':'夜空之翼','歯車の加護':'齿轮的加护','星読み':'占星','星座の導き':'星座指引','流れ星':'流星',
  'かじる':'啃咬','スパナパンチ':'扳手拳','ロボ発進':'机器人出发','ロボ修理':'机器人修理','ちょこまか':'东跑西窜','ロボビーム':'机器人光束','ロボ合体':'机器人合体',
  '設計図':'设计图','理論武装':'理论武装','ホーホー':'呼呼','博士の一撃':'博士的一击','夜目':'夜视','精密計算':'精密计算','完璧な設計':'完美设计',
  '放電':'放电','胸たたき':'捶胸','コード書き換え':'改写代码','電撃パンチ':'电击拳','ハイボルテージ':'高电压','ジャングルボルト':'丛林伏特','100万ボルト':'百万伏特',
  'ロボパンチ':'机器人拳','センサー照準':'传感器瞄准','アーマーモード':'装甲模式','修理プログラム':'修复程序','ブースター':'推进器','ロケットパンチ':'火箭拳','フルバースト':'全弹发射',
  'ギターソロ':'吉他独奏','シャウト':'嘶吼','ギタースマッシュ':'吉他重击','アンコール':'安可','パワーコード':'强力和弦','スピーカー爆音':'音箱轰鸣','ジュウナナ':'十七',
  '匠の一打':'匠之一击','研ぎ澄ます':'磨砺','段取り八分':'准备八分','仕上げ':'收尾','精密加工':'精密加工','検査':'检验','奥義·千本鍛え':'奥义·千锤百炼'},
 floors:['见习之间','车床室','制图室','焊接工房','电气实习室','化学室','机械工厂','信息处理室','风暴屋顶','塔主之间','试作室','锻造场','控制室','研究所','精密测量室','发电站','设计局','风暴展望台','观星回廊','天空工房'],
 rules:{odd:'用奇数点数发动的攻击伤害+2',dice:'双方骰子+1个',even:'用偶数点数发动的攻击伤害+2',pair:'对子技能伤害+4',heal:'恢复量变为2倍',guardHalf:'获得的护盾减半',six:'用点数6发动的攻击伤害+3',storm:'回合开始时，当前行动方受到1点伤害',boss:'对方队伍攻击伤害+1'},
};

const FLOORS=[
 {n:'見習いの間',rule:null},
 {n:'旋盤室',rule:{k:'odd',d:'奇数の出目で使った攻撃ダメージ+2'}},
 {n:'製図室',rule:{k:'dice',d:'お互いサイコロ+1個'}},
 {n:'溶接工房',rule:{k:'even',d:'偶数の出目で使った攻撃ダメージ+2'}},
 {n:'電気実習室',rule:{k:'pair',d:'ゾロ目技のダメージ+4'}},
 {n:'化学室',rule:{k:'heal',d:'回復量が2倍'}},
 {n:'機械工場',rule:{k:'guardHalf',d:'得るガードが半分'}},
 {n:'情報処理室',rule:{k:'six',d:'出目6を使った攻撃ダメージ+3'}},
 {n:'嵐の屋上',rule:{k:'storm',d:'ターン開始時、そのターンの人が1ダメージ'}},
 {n:'塔の主の間',rule:{k:'boss',d:'相手チームの攻撃ダメージ+1'}},
 /* 上層（10F突破で解放）：奇数階は敵がレベルアップ、偶数階は敵が1人増える */
 {n:'試作室',rule:{k:'dice',d:'お互いサイコロ+1個'}},
 {n:'鍛造場',rule:{k:'even',d:'偶数の出目で使った攻撃ダメージ+2'}},
 {n:'制御室',rule:{k:'six',d:'出目6を使った攻撃ダメージ+3'}},
 {n:'研究所',rule:{k:'heal',d:'回復量が2倍'}},
 {n:'精密測定室',rule:{k:'guardHalf',d:'得るガードが半分'}},
 {n:'発電所',rule:{k:'pair',d:'ゾロ目技のダメージ+4'}},
 {n:'設計局',rule:{k:'odd',d:'奇数の出目で使った攻撃ダメージ+2'}},
 {n:'嵐の展望台',rule:{k:'storm',d:'ターン開始時、そのターンの人が1ダメージ'}},
 {n:'星見の回廊',rule:{k:'dice',d:'お互いサイコロ+1個'}},
 {n:'天空の工房',rule:{k:'boss',d:'相手チームの攻撃ダメージ+1'}},
];
const BK={chars:{},floors:FLOORS.map(f=>({n:f.n,d:f.rule&&f.rule.d}))};
ALL.forEach(c=>BK.chars[c.id]={name:c.name,role:c.role,pn:c.passive.n,pd:c.passive.d,lines:[...c.lines],moves:c.moves.map(m=>m.n)});
function setLang(l){LANG=l==='zh'?'zh':'ja';const zh=LANG==='zh';
  ALL.forEach(c=>{const b=BK.chars[c.id],z=ZH.chars[c.id]||{};c.name=zh&&z.name||b.name;c.role=zh&&z.role||b.role;c.passive.n=zh&&z.pn||b.pn;c.passive.d=zh&&z.pd||b.pd;
    c.lines=zh&&z.lines||[...b.lines];c.moves.forEach((m,k)=>m.n=zh&&ZH.moves[b.moves[k]]||b.moves[k])});
  FLOORS.forEach((f,i)=>{f.n=zh&&ZH.floors[i]||BK.floors[i].n;if(f.rule)f.rule.d=zh&&ZH.rules[f.rule.k]||BK.floors[i].d});
  return LANG}
const getLang=()=>LANG;
const floorStar=f=>f<=3?1:f<=6?2:3;
/* 上層の敵レベル：11-12F=Lv1、13-14F=Lv2 … 19-20F=Lv5（周回ごとに+2） */
const enemyLv=(f,lap=1)=>f>TOP?Math.ceil((f-TOP)/2)+(lap-1)*2:0;
const lvBonus=lv=>Math.floor(lv/2);
const floorCount=f=>f>TOP?(f%2===0?4:3):f<=3?1:f<=7?2:3;
const floorHP=(f,lap)=>f>TOP?Math.round((30+enemyLv(f,lap)*2)*(f%2===0?.8:1)):(f<=7?24+f*2:20+f*2);
const bossHP=(f,lap)=>f===TOP2?50+(lap-1)*10:40;
const floorCoins=f=>2+Math.ceil(f/2)+(f===TOP?10:f===TOP2?15:0);

/* ---- 表示用ラベル ---- */
function condLabel(c){return(LANG==='zh'?{any:'任意',even:'偶数',odd:'奇数',pair:'对子'}:{any:'なんでも',even:'偶数',odd:'奇数',pair:'ゾロ目'})[c.t]||(c.t==='min'?c.n+L('以上','以上'):c.t==='max'?c.n+L('以下','以下'):L(c.n+'のみ','仅'+c.n))}
function condOk(c,v){return c.t==='any'||c.t==='pair'||(c.t==='even'&&v%2===0)||(c.t==='odd'&&v%2===1)||(c.t==='min'&&v>=c.n)||(c.t==='max'&&v<=c.n)||(c.t==='eq'&&v===c.n)}
function dmgLabel(d){if(!d)return'';const P=L('出目','点数'),m=d.m?(d.m>1?P+'×'+d.m:P):'';return m&&d.b?m+'+'+d.b:m||String(d.b)}
function fxLabel(f){if(!f)return[];const o=[];
  if(f.guard)o.push(L(`ガード${f.guard}`,`护盾${f.guard}`));if(f.pow)o.push(L(`次の攻撃+${f.pow}`,`下次攻击+${f.pow}`));if(f.weak)o.push(L(`相手の次の攻撃−${f.weak}`,`对方下次攻击−${f.weak}`));
  if(f.heal)o.push(L(`体力${f.heal}回復`,`恢复体力${f.heal}`));if(f.dUp)o.push(L(`次のターン サイコロ+${f.dUp}`,`下回合骰子+${f.dUp}`));if(f.dDown)o.push(L(`相手の次のターン サイコロ−${f.dDown}`,`对方下回合骰子−${f.dDown}`));if(f.reroll)o.push(L('サイコロ1個を振り直して戻す','重掷1个骰子并返还'));return o}

/* 技の強化（レベル1つごとに数値+2） */
function applyLv(m,lv){if(!lv)return m;const c=JSON.parse(JSON.stringify(m));c.lv=lv;
  if(c.dmg)c.dmg.b=(c.dmg.b||0)+2*lv;
  else{c.fx=c.fx||{};const k=['guard','heal','pow','weak'].find(k=>c.fx[k]);if(k)c.fx[k]+=2*lv;else c.fx.guard=(c.fx.guard||0)+2*lv}
  return c}

/* 技の価値（自動編成用） */
const FACE=[1,2,3,4,5,6];
function moveValue(m){const ok=FACE.filter(v=>condOk(m.c,v)),p1=ok.length/6,prob=m.c.t==='pair'?.42:1-Math.pow(1-p1,3);
  const avg=m.c.t==='pair'?3.5:ok.reduce((a,v)=>a+v,0)/Math.max(1,ok.length);
  let v=m.dmg?(m.dmg.b||0)+(m.dmg.m||0)*avg:0;const f=m.fx||{};
  v+=(f.guard||0)*.7+(f.pow||0)*1.1+(f.weak||0)*.7+(f.heal||0)*.8+(f.dUp||0)*2.5+(f.dDown||0)*3+(f.reroll||0)*2;return v*prob}
function autoPick(ch,star,jitter=0,R=Math.random,lvMap={}){
  const av=ch.moves.map((m,k)=>({k,m,s:moveValue(applyLv(m,lvMap[k]||0))+m.t*.5+R()*jitter})).filter(x=>x.m.t<=star).sort((a,b)=>b.s-a.s);
  let sel=av.slice(0,4);const dmg=sel.filter(x=>x.m.dmg).length;
  if(dmg<3){const extra=av.slice(4).filter(x=>x.m.dmg).slice(0,3-dmg);sel=sel.filter(x=>x.m.dmg).concat(sel.filter(x=>!x.m.dmg).slice(0,4-dmg-extra.length)).concat(extra)}
  return sel.map(x=>x.k).sort((a,b)=>a-b)}

/* ---- バトル ---- */
function mkFighter(id,star,mv,lvMap,hp,elv=0,bonus=0){const ch=byId(id);
  return{ch,star,moves:mv.map(k=>applyLv(ch.moves[k],(lvMap||{})[k]||0)),hp,max:hp,guard:0,pow:0,weak:0,dMod:0,lv:elv,bonus}}
function enemiesFor(f,lap,R=Math.random,avoid=[]){const n=floorCount(f),st=f>TOP?3:floorStar(f),lv=enemyLv(f,lap),out=[],pool=CHARS.map(c=>c.id);
  for(let i=0;i<n;i++){
    if((f===TOP||f===TOP2)&&i===n-1){out.push({id:'takumi',star:3,hp:bossHP(f,lap),lv:f===TOP2?lv+1:0,bonus:f===TOP2?lvBonus(lv):0,boss:true});break}
    let id;let tries=0;do{id=pool[Math.floor(R()*pool.length)];tries++}while(tries<20&&(out.some(e=>e.id===id)||(avoid.includes(id)&&R()<.6)));
    out.push({id,star:st,hp:floorHP(f,lap),lv,bonus:lvBonus(lv)})}
  return out.map(e=>({...e,mv:autoPick(byId(e.id),e.star,1.5,R)}))}
function newBattle(o){/* o:{floor,lap,party:[{id,star,mv,lv}],enemies:[{id,star,mv,hp}]} */
  const S={floor:o.floor,lap:o.lap||1,rule:(FLOORS[o.floor-1]||{}).rule,turn:0,over:-1,ev:[],
    sides:[{team:o.party.map(p=>mkFighter(p.id,p.star,p.mv,p.lv,PLAYER_HP)),idx:0,dice:[],used:new Set(),first:true},
           {team:o.enemies.map(e=>mkFighter(e.id,e.star,e.mv,null,e.hp,e.lv||0,e.bonus||0)),idx:0,dice:[],used:new Set(),first:false}]};
  return S}
const act=(S,i)=>S.sides[i].team[S.sides[i].idx];
const rk=S=>S.rule&&S.rule.k;
function snap(S){return S.sides.map(sd=>({idx:sd.idx,team:sd.team.map(f=>({hp:f.hp,max:f.max,guard:f.guard,pow:f.pow,weak:f.weak,dMod:f.dMod})),dice:sd.dice.map(d=>({v:d.v,used:d.used})),used:[...sd.used]}))}
function E(S,t,msg,x){S.ev.push(Object.assign({t,msg,snap:snap(S)},x||{}))}
const take=S=>{const e=S.ev;S.ev=[];return e};
const r6=R=>1+Math.floor(R()*6);

/* 体力0の処理。手番の人がたおれたらtrueを返す */
function checkKO(S){let selfDown=false;
  for(const i of [S.turn,1-S.turn]){const sd=S.sides[i],f=act(S,i);if(f.hp>0||S.over>=0)continue;
    E(S,'ko',L(`${f.ch.name}は たおれた！`,`${f.ch.name} 倒下了！`),{side:i});
    const nx=sd.team.findIndex((x,k)=>k>sd.idx&&x.hp>0);
    if(nx<0){S.over=1-i;E(S,'over','',{winner:1-i});return true}
    sd.idx=nx;const n=act(S,i);
    if(i===S.turn){selfDown=true;sd.dice.forEach(d=>d.used=true)}
    E(S,'switch',i===1?L(`${n.ch.name}が 現れた！「${n.ch.lines[0]}」`,`${n.ch.name} 出现了！「${n.ch.lines[0]}」`):L(`${n.ch.name}、たのんだ！`,`${n.ch.name}，拜托了！`),{side:i})}
  return selfDown}

function startTurn(S,i,R=Math.random){if(S.over>=0)return take(S);
  S.turn=i;const sd=S.sides[i],f=act(S,i),pk=f.ch.passive.k;f.guard=0;sd.used=new Set();sd.dice=[];
  E(S,'turn',i===0?L('あなたのターン！','你的回合！'):L('相手のターン！','对方的回合！'),{side:i});
  if(i===0)S.round=(S.round||0)+1;
  if(S.round>=FATIGUE){const d=S.round-FATIGUE+1;f.hp=Math.max(0,f.hp-d);E(S,'hit',L(`長期戦の疲れ！ ${f.ch.name}に ${d} ダメージ`,`持久战的疲劳！ ${f.ch.name} 受到 ${d} 点伤害`),{side:i,amt:d,src:-1})}
  if(rk(S)==='storm'){f.hp=Math.max(0,f.hp-1);E(S,'hit',L(`嵐で ${f.ch.name}に 1ダメージ`,`风暴使 ${f.ch.name} 受到1点伤害`),{side:i,amt:1,src:-1})}
  if(pk==='gamble'&&f.hp>0){f.hp=Math.max(0,f.hp-1);E(S,'hit',L(`ロックンロール！ ${f.ch.name}は 1ダメージ`,`摇滚！ ${f.ch.name} 受到1点伤害`),{side:i,amt:1,src:-1})}
  checkKO(S);if(S.over>=0)return take(S);
  const g=act(S,i),gk=g.ch.passive.k;
  let n=DICE+g.dMod+(rk(S)==='dice'?1:0)+(gk==='gamble'?1:0)-(sd.first?1:0);n=Math.max(1,Math.min(MAXD,n));g.dMod=0;
  const firstNote=sd.first?L('（最初のターンは1個少ない）','（第一回合少1个）'):'';sd.first=false;
  sd.dice=Array.from({length:n},()=>({v:r6(R),used:false}));
  E(S,'roll',L(`サイコロ${n}個 → `,`骰子${n}个 → `)+`${sd.dice.map(d=>d.v).join(L('・','·'))}${firstNote}`,{side:i});
  if(gk==='reroll1'&&sd.dice.some(d=>d.v===1)){sd.dice.forEach(d=>{if(d.v===1)d.v=r6(R)});E(S,'roll',L('器用な手先！ 1を振り直し → ','灵巧双手！ 重掷1 → ')+sd.dice.map(d=>d.v).join(L('・','·')),{side:i})}
  if(gk==='guardStart'){const gg=gain(S,g,2);E(S,'guard',L(`ふかふか羽毛で ガード${gg}`,`蓬松羽毛：护盾${gg}`),{side:i,amt:gg})}
  if(gk==='pairPow'){const vs=sd.dice.map(d=>d.v);if(vs.some((v,k)=>vs.indexOf(v)!==k)){g.pow+=3;E(S,'buff',L('星降る夜！ ゾロ目で 次の攻撃+3','星降之夜！ 掷出对子，下次攻击+3'),{side:i})}}
  return take(S)}
function gain(S,f,g){if(rk(S)==='guardHalf')g=Math.floor(g/2);if(f.ch.passive.k==='master')g+=1;f.guard+=g;return g}

/* 使えるサイコロ（index配列）を返す */
function diceFor(S,i,mi,prefer){const sd=S.sides[i],f=act(S,i),m=f.moves[mi];if(sd.used.has(mi))return null;
  const free=sd.dice.map((d,k)=>({v:d.v,used:d.used,k})).filter(d=>!d.used);
  if(m.c.t==='pair'){const gr={};free.forEach(d=>(gr[d.v]=gr[d.v]||[]).push(d.k));
    if(prefer!=null&&sd.dice[prefer]&&!sd.dice[prefer].used){const g=gr[sd.dice[prefer].v];if(g&&g.length>=2)return[prefer,g.find(k=>k!==prefer)]}
    const vs=Object.keys(gr).filter(v=>gr[v].length>=2).map(Number).sort((a,b)=>b-a);return vs.length?gr[vs[0]].slice(0,2):null}
  if(prefer!=null&&sd.dice[prefer]&&!sd.dice[prefer].used&&condOk(m.c,sd.dice[prefer].v))return[prefer];
  const ok=free.filter(d=>condOk(m.c,d.v));if(!ok.length)return null;
  const useHigh=(m.dmg&&m.dmg.m)||rk(S)==='six'||f.ch.passive.k==='six';
  ok.sort((a,b)=>useHigh?b.v-a.v:a.v-b.v);
  if(rk(S)==='odd'||rk(S)==='even'){const want=rk(S)==='odd'?1:0;const pr=ok.find(d=>d.v%2===want);if(m.dmg&&pr&&!(m.dmg.m))return[pr.k]}
  return[ok[0].k]}

/* 攻撃ダメージ（ガード前） */
function calcDmg(S,i,m,v){const f=act(S,i),o=act(S,1-i),pk=f.ch.passive.k,notes=[];
  let d=(m.dmg.b||0)+(m.dmg.m||0)*v;
  const add=(n,why)=>{if(n){d+=n;notes.push(`${why}${n>0?'+':''}${n}`)}};
  if(rk(S)==='odd'&&v%2===1&&m.c.t!=='pair')add(2,FLOORS[S.floor-1].n);
  if(rk(S)==='even'&&v%2===0&&m.c.t!=='pair')add(2,FLOORS[S.floor-1].n);
  if(rk(S)==='pair'&&m.c.t==='pair')add(4,FLOORS[S.floor-1].n);
  if(rk(S)==='six'&&v===6)add(3,FLOORS[S.floor-1].n);
  if(rk(S)==='boss'&&i===1)add(1,FLOORS[S.floor-1].n);
  if(pk==='rage'&&f.hp<=f.max/2)add(2,f.ch.passive.n);
  if(pk==='six'&&v===6)add(3,f.ch.passive.n);
  if(pk==='smallHit'&&d<=5)add(2,f.ch.passive.n);
  if(pk==='master')add(1,f.ch.passive.n);
  if(f.bonus)add(f.bonus,'Lv'+f.lv);
  if(f.pow)add(f.pow,L('溜め','蓄力'));
  if(f.weak)add(-f.weak,L('弱体','削弱'));
  if(o.ch.passive.k==='armor')add(-1,o.ch.passive.n);
  return{d:Math.max(0,d),notes}}

function useMove(S,i,mi,ks){const sd=S.sides[i],f=act(S,i),o=act(S,1-i),m=f.moves[mi],v=sd.dice[ks[0]].v;
  ks.forEach(k=>sd.dice[k].used=true);sd.used.add(mi);
  E(S,'cast',L(`${f.ch.name}の ${m.n}！（出目 `,`${f.ch.name} 使出 ${m.n}！（点数 `)+`${ks.map(k=>sd.dice[k].v).join(L('・','·'))}）`,{side:i,mi,vals:ks.map(k=>sd.dice[k].v)});
  const fx=m.fx||{};
  if(m.dmg){const r=calcDmg(S,i,m,v);let d=r.d;f.pow=0;f.weak=0;
    if(o.guard&&d>0){const g=Math.min(o.guard,d);o.guard-=g;d-=g;r.notes.push(L(`ガード−${g}`,`护盾−${g}`))}
    o.hp=Math.max(0,o.hp-d);E(S,'hit',L(`${o.ch.name}に ${d} のダメージ！`,`${o.ch.name} 受到 ${d} 点伤害！`)+(r.notes.length?'（'+r.notes.join('、')+'）':''),{side:1-i,amt:d,src:i})}
  if(fx.guard){const g=gain(S,f,fx.guard);E(S,'guard',L(`${f.ch.name}は ガード${g}を得た！`,`${f.ch.name} 获得护盾${g}！`),{side:i,amt:g})}
  if(fx.pow){const p=fx.pow+(f.ch.passive.k==='powBonus'?1:0);f.pow+=p;E(S,'buff',L(`${f.ch.name}の 次の攻撃が +${p}！`,`${f.ch.name} 的下次攻击 +${p}！`),{side:i})}
  if(fx.weak){o.weak+=fx.weak;E(S,'debuff',L(`${o.ch.name}の 次の攻撃が −${fx.weak}！`,`${o.ch.name} 的下次攻击 −${fx.weak}！`),{side:1-i})}
  if(fx.heal){const h=Math.min(f.max-f.hp,fx.heal*(rk(S)==='heal'?2:1));f.hp+=h;E(S,'heal',h?L(`${f.ch.name}は 体力を ${h} 回復した！`,`${f.ch.name} 恢复了 ${h} 点体力！`):L('しかし 体力は満タンだ！','但体力已经是满的！'),{side:i,amt:h})}
  if(fx.dUp){f.dMod+=fx.dUp;E(S,'buff',L(`${f.ch.name}の 次のターンのサイコロが +${fx.dUp}！`,`${f.ch.name} 的下回合骰子 +${fx.dUp}！`),{side:i})}
  if(fx.dDown){o.dMod-=fx.dDown;E(S,'debuff',L(`${o.ch.name}の 次のターンのサイコロが −${fx.dDown}！`,`${o.ch.name} 的下回合骰子 −${fx.dDown}！`),{side:1-i})}
  if(fx.reroll){const nv=r6(Math.random);sd.dice.push({v:nv,used:false});E(S,'roll',L('サイコロを振り直した → ','重掷了骰子 → ')+nv,{side:i})}
  checkKO(S);return take(S)}

function endTurn(S,i){if(S.over>=0)return take(S);const f=act(S,i);
  if(f.ch.passive.k==='regen'&&f.hp<f.max){const h=Math.min(2,f.max-f.hp);f.hp+=h;E(S,'heal',L(`自己修復で 体力${h}回復`,`自我修复：恢复体力${h}`),{side:i,amt:h})}
  return take(S)}

/* CPUの1手（なければnull） */
function cpuChoose(S,i,R=Math.random){const sd=S.sides[i],f=act(S,i),o=act(S,1-i);let best=null,bs=0;
  f.moves.forEach((m,mi)=>{const ks=diceFor(S,i,mi);if(!ks)return;const v=sd.dice[ks[0]].v,fx=m.fx||{};let s=0;
    if(m.dmg){const d=Math.max(0,calcDmg(S,i,m,v).d-o.guard);s+=d;if(d>=o.hp)s+=100}
    if(fx.guard)s+=fx.guard*.7;
    if(fx.pow)s+=fx.pow*(f.moves.some((x,k)=>x.dmg&&!sd.used.has(k)&&k!==mi)?1.1:.5)+2;
    if(fx.weak)s+=fx.weak*.7;if(fx.heal)s+=Math.min(f.max-f.hp,fx.heal)*.9;if(fx.dUp)s+=4;if(fx.dDown)s+=4;if(fx.reroll)s+=2.5;
    if(!(m.dmg&&m.dmg.m))s-=ks.length*.25*v;s+=R()*.8;
    if(s>bs){bs=s;best={mi,ks}}});
  return best}

/* 完全自動（シミュレーション用） */
function simulate(o,R=Math.random){const S=newBattle(o);let i=0,guard=0;
  while(S.over<0&&guard++<200){startTurn(S,i,R);let c;while(S.over<0&&S.turn===i&&(c=cpuChoose(S,i,R)))useMove(S,i,c.mi,c.ks);endTurn(S,i);take(S);i=1-i}
  return S.over}

const API={L,setLang,getLang,FATIGUE,DICE,MAXD,PLAYER_HP,TOP,TOP2,enemyLv,lvBonus,CHARS,HIDDEN,ALL,byId,FLOORS,floorStar,floorCount,floorHP,bossHP,floorCoins,
  condLabel,condOk,dmgLabel,fxLabel,applyLv,moveValue,autoPick,enemiesFor,newBattle,act,startTurn,diceFor,useMove,endTurn,cpuChoose,simulate,calcDmg};
G.ENGINE=API;if(typeof module!=='undefined')module.exports=API;
})(typeof window!=='undefined'?window:globalThis);

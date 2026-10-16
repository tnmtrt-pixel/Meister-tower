/* オリキャラ対戦：データとバトルの仕組み（画面に依存しない） */
(function(G){
const DICE=3,MAXD=6,PLAYER_HP=40,TOP=10,TOP2=20,FATIGUE=9;

/* 条件 c:{t,n} / ダメージ dmg:{b:固定,m:出目倍率} / 効果 fx / t:必要な★ */
const CHARS=[
 {id:'dodo',name:'ドド先輩',img:'img/dodo.webp',color:'#7F98BC',role:'守り型・のんびり回復',
  passive:{k:'guardStart',n:'ふかふか羽毛',d:'自分のターン開始時にガード4を得る'},
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
  {n:'鬼の睨み',c:{t:'min',n:4},dmg:{b:3},fx:{weak:4}},
  {n:'呪符',c:{t:'max',n:2},fx:{dDown:1},t:2},
  {n:'式神召喚',c:{t:'min',n:4},dmg:{b:3},fx:{guard:2},t:2},
  {n:'陰陽転生',c:{t:'pair'},dmg:{b:12},fx:{heal:3},t:3}]},
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
  passive:{k:'smallHit',n:'ちょこちょこ',d:'ダメージ5以下の攻撃は+1'},
  lines:['チュー！ロボと一緒にがんばるぞ！','やったチュー！','ロボ、修理しなきゃ…'],moves:[
  {n:'かじる',c:{t:'any'},dmg:{b:3}},
  {n:'スパナパンチ',c:{t:'even'},dmg:{b:4}},
  {n:'ロボ発進',c:{t:'min',n:4},dmg:{b:1,m:1}},
  {n:'ロボ修理',c:{t:'odd'},fx:{heal:4}},
  {n:'ちょこまか',c:{t:'max',n:3},dmg:{b:1},fx:{reroll:1},t:2},
  {n:'ロボビーム',c:{t:'min',n:5},dmg:{b:9},t:2},
  {n:'ロボ合体',c:{t:'pair'},dmg:{b:16},fx:{guard:5},t:3}]},
 {id:'owl',name:'ホー博士',img:'img/owl.webp',color:'#8A6A45',role:'強化型・計算して一撃',
  passive:{k:'powBonus',n:'博識',d:'「次の攻撃+」の効果がさらに+1'},
  lines:['計算はすでに終わっておる','ホッホッ、理論どおりじゃ','計算に誤差があったか…'],moves:[
  {n:'設計図',c:{t:'max',n:3},fx:{pow:4}},
  {n:'理論武装',c:{t:'even'},fx:{guard:5}},
  {n:'ホーホー',c:{t:'odd'},dmg:{b:2},fx:{weak:3}},
  {n:'博士の一撃',c:{t:'min',n:5},dmg:{b:3,m:1}},
  {n:'夜目',c:{t:'max',n:2},fx:{dUp:1,reroll:1},t:2},
  {n:'精密計算',c:{t:'even'},dmg:{b:4,m:1},t:2},
  {n:'完璧な設計',c:{t:'pair'},dmg:{b:15},fx:{pow:3},t:3}]},
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
  passive:{k:'regen',n:'自己修復',d:'自分のターン終了時に体力4回復'},
  lines:['戦闘モード、起動シマス','ミッション、完了','システム…ダウン…'],moves:[
  {n:'ロボパンチ',c:{t:'any'},dmg:{b:3}},
  {n:'センサー照準',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'アーマーモード',c:{t:'min',n:3},fx:{guard:5}},
  {n:'修理プログラム',c:{t:'odd'},fx:{heal:4}},
  {n:'ブースター',c:{t:'max',n:2},fx:{dUp:1},t:2},
  {n:'ロケットパンチ',c:{t:'min',n:5},dmg:{b:10},t:2},
  {n:'フルバースト',c:{t:'pair'},dmg:{b:14},fx:{guard:3},t:3}]},
 {id:'rocker',name:'セブンティーン',img:'img/rocker.webp',color:'#A82828',role:'一発逆転型・ギャンブラー',
  passive:{k:'gamble',n:'ロックンロール',d:'毎ターン サイコロ+1個。ただしターン開始時に2ダメージ'},
  lines:['俺のギターで、黙らせてやるよ','アンコールはいらねぇ','……今日は弦が切れただけだ'],moves:[
  {n:'ギターソロ',c:{t:'any'},dmg:{m:1}},
  {n:'シャウト',c:{t:'odd'},dmg:{b:2},fx:{weak:3}},
  {n:'ギタースマッシュ',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'アンコール',c:{t:'max',n:2},fx:{dUp:1,reroll:1}},
  {n:'パワーコード',c:{t:'min',n:5},dmg:{b:8},t:2},
  {n:'スピーカー爆音',c:{t:'even'},dmg:{b:3},fx:{weak:2},t:2},
  {n:'ジュウナナ',c:{t:'pair'},dmg:{b:14},t:3}]},
 /* ===== vol.2（No.13〜22） ===== */
 {id:'nero',vol:2,no:13,name:'ネロ',img:'img/nero.webp',color:'#4A3550',role:'妨害型・甘いワナ',
  passive:{k:'chainW',n:'鎖の誓い',d:'「相手の次の攻撃−」の効果がさらに−2'},
  lines:['甘いのは飴だけ。あたしはちがうよ','ごちそうさま♪','……飴、落としちゃった'],moves:[
  {n:'キャンディ投げ',c:{t:'any'},dmg:{b:2,m:1}},
  {n:'チェーンウィップ',c:{t:'odd'},dmg:{b:3,m:1}},
  {n:'鎖しばり',c:{t:'max',n:3},dmg:{b:2},fx:{weak:3}},
  {n:'ペロッ',c:{t:'even'},fx:{heal:4}},
  {n:'タトゥーの呪い',c:{t:'min',n:4},dmg:{b:3},fx:{dDown:1},t:2},
  {n:'シルバーリング',c:{t:'min',n:4},dmg:{b:2,m:1},t:2},
  {n:'ブラックロリポップ',c:{t:'pair'},dmg:{b:15},fx:{weak:3},t:3}]},
 {id:'okajun',vol:2,no:14,name:'オカジュン',img:'img/okajun.webp',color:'#B8902E',role:'反撃型・やられたらやり返す',
  passive:{k:'revenge',n:'工業魂',d:'5ダメージ以上の攻撃を受けると、次の攻撃+2'},
  lines:['工業なめんなよ','整備完了ってな','……今日はエンジンかからねぇ'],moves:[
  {n:'鉄拳',c:{t:'any'},dmg:{b:1,m:1}},
  {n:'スパナ一閃',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'メンチ切り',c:{t:'odd'},dmg:{b:1},fx:{weak:3}},
  {n:'油差し',c:{t:'max',n:3},fx:{heal:4}},
  {n:'ボルト締め',c:{t:'min',n:4},fx:{guard:4,dUp:1},t:2},
  {n:'フルスイング',c:{t:'min',n:5},dmg:{b:9},t:2},
  {n:'工業なめんな',c:{t:'pair'},dmg:{b:16},t:3}]},
 {id:'hayate',vol:2,no:15,name:'ハヤテ',img:'img/hayate.webp',color:'#7E8A9C',role:'速攻型・最初の一撃',
  passive:{k:'first',n:'安全確認よし',d:'毎ターン、最初の攻撃ダメージ+2'},
  lines:['安全第一、でも全力で！','実習どおりです！','次は…手順を見直します'],moves:[
  {n:'正拳突き',c:{t:'any'},dmg:{b:1,m:1}},
  {n:'ジャブ',c:{t:'odd'},dmg:{b:1},fx:{reroll:1}},
  {n:'安全メガネ',c:{t:'even'},fx:{guard:5}},
  {n:'指差し確認',c:{t:'max',n:2},fx:{pow:3,reroll:1}},
  {n:'軍手パンチ',c:{t:'even'},dmg:{b:1,m:1},t:2},
  {n:'グラインダー',c:{t:'min',n:5},dmg:{b:8},t:2},
  {n:'実習の成果',c:{t:'pair'},dmg:{b:15},t:3}]},
 {id:'kurogane',vol:2,no:16,name:'クロガネ',img:'img/kurogane.webp',color:'#3D4A63',role:'粘り型・しぶとい',
  passive:{k:'nine',n:'九つの命',d:'1回だけ、たおれる攻撃を受けても体力5で耐える'},
  lines:['にゃっ！整備はまかせて！','ピース！にゃはは！','……しっぽ、ふまれた…'],moves:[
  {n:'ねこパンチ',c:{t:'any'},dmg:{b:1,m:1}},
  {n:'スパナひっかき',c:{t:'even'},dmg:{b:1,m:1}},
  {n:'しっぽバランス',c:{t:'odd'},fx:{guard:4}},
  {n:'ドライバー投げ',c:{t:'min',n:4},dmg:{b:7}},
  {n:'にゃんこ整備',c:{t:'max',n:2},fx:{guard:3,heal:2},t:2},
  {n:'ピース',c:{t:'max',n:3},fx:{pow:3},t:2},
  {n:'黒猫クラッシュ',c:{t:'pair'},dmg:{b:18},t:3}]},
 {id:'lionex',vol:2,no:17,name:'ライオネクス',img:'img/lionex.webp',color:'#D9A632',role:'攻撃型・雷の大技',
  passive:{k:'thunder',n:'雷鳴',d:'ゾロ目の攻撃は相手のガードを無視する'},
  lines:['……雷鳴を聞け','天の裁きだ','雷が…止んだか'],moves:[
  {n:'雷爪',c:{t:'any'},dmg:{b:2,m:1}},
  {n:'たてがみの稲光',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'咆哮',c:{t:'max',n:3},fx:{weak:4}},
  {n:'帯電',c:{t:'max',n:2},fx:{pow:4}},
  {n:'落雷',c:{t:'min',n:5},dmg:{b:10},t:2},
  {n:'雷光ステップ',c:{t:'odd'},dmg:{b:3},fx:{dUp:1},t:2},
  {n:'天雷',c:{t:'pair'},dmg:{b:18},t:3}]},
 {id:'seraph',vol:2,no:18,name:'セラフ',img:'img/seraph.webp',color:'#C9B27A',role:'回復型・祝福',
  passive:{k:'bless',n:'祝福',d:'回復する技の回復量+2'},
  lines:['おいで。迷っているんだろう？','よくがんばったね','……光が、少し翳ったかな'],moves:[
  {n:'光の手',c:{t:'any'},dmg:{b:2,m:1}},
  {n:'鳩の使い',c:{t:'odd'},dmg:{b:2},fx:{reroll:1}},
  {n:'祝福の光',c:{t:'max',n:3},fx:{heal:5}},
  {n:'聖なる輪',c:{t:'even'},fx:{guard:5}},
  {n:'月桂冠',c:{t:'max',n:2},fx:{heal:2,pow:3},t:2},
  {n:'光輪',c:{t:'min',n:4},dmg:{b:3,m:1},t:2},
  {n:'ヘイロー',c:{t:'pair'},dmg:{b:13},fx:{heal:5},t:3}]},
 {id:'hakurou',vol:2,no:19,name:'ハクロウ',img:'img/hakurou.webp',color:'#BFA066',role:'守り型・神獣',
  passive:{k:'veil',n:'天衣',d:'ガードがターン開始時に消えず持ち越せる（最大8）。攻撃をガードで受けきると、防いだ分だけ体力回復'},
  lines:['……風が、そなたを試している','天に還るがよい','……この衣、まだ汚れるか'],moves:[
  {n:'白牙',c:{t:'any'},dmg:{b:2,m:1}},
  {n:'羽衣の舞',c:{t:'even'},fx:{guard:6}},
  {n:'金の房',c:{t:'max',n:2},dmg:{b:2},fx:{dDown:1}},
  {n:'遠吠え',c:{t:'max',n:3},fx:{pow:4}},
  {n:'天衣無縫',c:{t:'min',n:4},fx:{guard:4,dUp:1},t:2},
  {n:'白銀の爪',c:{t:'min',n:5},dmg:{b:9},t:2},
  {n:'神狼降臨',c:{t:'pair'},dmg:{b:14},fx:{gdmg:1},t:3}]},
 {id:'guardian',vol:2,no:20,name:'ガーディアン',img:'img/guardian.webp',color:'#2E5AA8',role:'守り型・トゲの反撃',
  passive:{k:'thorn',n:'七色のトゲ',d:'攻撃を受けるたび（ガードで防いでも）相手に2ダメージ'},
  lines:['我が盾の前に、ひざまずくがいい','騎士道、ここにあり','……我が誇りに、傷が'],moves:[
  {n:'しっぽ払い',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'大あご',c:{t:'min',n:4},dmg:{b:6}},
  {n:'腕組み',c:{t:'min',n:3},fx:{guard:5}},
  {n:'騎士の誓い',c:{t:'odd'},dmg:{b:1},fx:{weak:2}},
  {n:'マント翻し',c:{t:'even'},dmg:{b:3},fx:{guard:3},t:2},
  {n:'ワニのひと噛み',c:{t:'min',n:5},dmg:{b:8},t:2},
  {n:'レインボースパイク',c:{t:'pair'},dmg:{b:15},t:3}]},
 {id:'libra',vol:2,no:21,name:'リブラ',img:'img/libra.webp',color:'#3B3F6E',role:'調整型・白と黒',
  passive:{k:'balance',n:'天秤',d:'ターン開始時、偶数と奇数のサイコロが両方あれば次の攻撃+3'},
  lines:['運命もひとつの選択……','判決、あなたの負け','……天秤が、傾いた'],moves:[
  {n:'白のサイコロ',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'黒のサイコロ',c:{t:'odd'},dmg:{b:2,m:1}},
  {n:'均衡',c:{t:'any'},fx:{reroll:1}},
  {n:'判決',c:{t:'min',n:4},dmg:{b:2},fx:{weak:3}},
  {n:'天秤の傾き',c:{t:'max',n:2},dmg:{b:1},fx:{dDown:1},t:2},
  {n:'公正な裁き',c:{t:'min',n:5},dmg:{b:8},t:2},
  {n:'最終審判',c:{t:'pair'},dmg:{b:16},t:3}]},
 {id:'spino',vol:2,no:22,name:'スピノボーン',img:'img/spino.webp',color:'#9C8A6A',role:'一発型・化石の体',
  passive:{k:'fossil',n:'化石の体',d:'4ダメージ以下の攻撃は効かない'},
  lines:['カタカタ…一億年ぶりの獲物だ','化石になって出直しな','……骨が、バラバラに…'],moves:[
  {n:'骨かみ',c:{t:'any'},dmg:{b:2,m:1}},
  {n:'帆びれガード',c:{t:'even'},fx:{guard:5}},
  {n:'化石の眠り',c:{t:'odd'},fx:{heal:6}},
  {n:'古代の咆哮',c:{t:'max',n:3},fx:{weak:3}},
  {n:'ボーンクロー',c:{t:'min',n:5},dmg:{b:10},t:2},
  {n:'背骨ムチ',c:{t:'even'},dmg:{b:3,m:1},t:2},
  {n:'白亜紀バイト',c:{t:'pair'},dmg:{b:18},t:3}]},
];
const HIDDEN={id:'takumi',reward:'meister10',name:'匠',img:'img/takumi.webp',crest:'匠',color:'#A87A12',role:'隠しキャラ・塔の主',hidden:true,
  passive:{k:'master',n:'マイスターの技',d:'攻撃ダメージ+1、得るガード+1'},
  lines:['夜に磨く、未来を創る力を見せてよ！','まだまだ磨きが足りないね。また挑戦してよ！','すごい！ きみこそ本物のマイスターだよ！'],moves:[
  {n:'匠の一打',c:{t:'any'},dmg:{m:1}},
  {n:'研ぎ澄ます',c:{t:'max',n:2},fx:{pow:4}},
  {n:'段取り八分',c:{t:'even'},fx:{guard:4,dUp:1}},
  {n:'仕上げ',c:{t:'min',n:4},dmg:{b:6}},
  {n:'精密加工',c:{t:'odd'},dmg:{b:3,m:1},t:2},
  {n:'検査',c:{t:'eq',n:1},fx:{dDown:1,weak:3},t:2},
  {n:'奥義・千本鍛え',c:{t:'pair'},dmg:{b:18},t:3}]};
/* 乱入キャラ：匠空（ガチャには出ない。乱入バトルで勝つと仲間になる） */
const SORA={id:'sora',name:'匠空',img:'img/sora.webp',color:'#2C78C8',role:'20Fの真・塔の主・ドローン操縦士',reward:'meister20',
  passive:{k:'sky',n:'上空からの視点',d:'攻撃が相手のガードを2つ貫通する'},
  lines:['空の上から見てたよ。きみの腕、試させて！','空からは全部お見通し！','まいった！ 仲間にしてよ！'],moves:[
  {n:'ドローン偵察',c:{t:'any'},dmg:{b:1,m:1}},
  {n:'空撮',c:{t:'even'},dmg:{b:2},fx:{pow:3}},
  {n:'プロペラカッター',c:{t:'min',n:4},dmg:{b:7}},
  {n:'ホバリング',c:{t:'odd'},fx:{guard:5}},
  {n:'自動追尾',c:{t:'max',n:3},dmg:{b:1,m:2},t:2},
  {n:'電波妨害',c:{t:'min',n:5},dmg:{b:6},fx:{dDown:1},t:2},
  {n:'空爆ドローン',c:{t:'pair'},dmg:{b:18},fx:{guard:3},t:3}]};
/* 審判の塔のボス（ガチャには出ない。倒すと仲間になる） */
const VERDICT={id:'verdict',no:23,name:'ヴェルディクト',img:'img/verdict.webp',color:'#6B4A9E',role:'審判の塔10Fの主・白黒の鳥',reward:'judge10',
  passive:{k:'wb',n:'白黒の羽',d:'自分のターンごとに白と黒が入れ替わる。黒の間は攻撃+2、白の間は受けるダメージ−1'},
  lines:['……その魂、白か黒か。量らせてもらう','黒、と出たな','……白の羽が、勝ったか'],moves:[
  {n:'黒羽の刃',c:{t:'odd'},dmg:{b:2,m:1}},
  {n:'白羽の盾',c:{t:'even'},fx:{guard:5}},
  {n:'審きの眼',c:{t:'min',n:4},dmg:{b:3},fx:{dDown:1}},
  {n:'双翼',c:{t:'any'},dmg:{b:1,m:1}},
  {n:'白黒の爪',c:{t:'min',n:5},dmg:{b:10},t:2},
  {n:'月の宝珠',c:{t:'max',n:2},fx:{pow:4,heal:3},t:2},
  {n:'白黒裁断',c:{t:'pair'},dmg:{b:16},t:3}]};
const ECLIPSE={id:'eclipse',no:24,name:'エクリプス',img:'img/eclipse.webp',color:'#B0904A',role:'審判の塔20Fの主・白黒の獣',reward:'judge20',
  passive:{k:'decree',n:'審判の宣告',d:'自分のターン開始時に「偶数」か「奇数」を宣告。宣告された出目の攻撃+3、反対の出目の攻撃−3（お互い。ゾロ目技は対象外）'},
  lines:['陰と陽、すべてを裁く。来るがいい','判決は下った','……見事。お前の光は本物だ'],moves:[
  {n:'陰の爪',c:{t:'odd'},dmg:{b:2,m:1}},
  {n:'陽の牙',c:{t:'even'},dmg:{b:2,m:1}},
  {n:'太極の環',c:{t:'any'},fx:{guard:4}},
  {n:'審判の咆哮',c:{t:'max',n:3},fx:{weak:4}},
  {n:'黒炎',c:{t:'min',n:5},dmg:{b:12},t:2},
  {n:'白光',c:{t:'min',n:4},fx:{heal:5,dUp:1},t:2},
  {n:'陰陽審判',c:{t:'pair'},dmg:{b:22},t:3}]};
CHARS.forEach(c=>c.vol=c.vol||1);
const ALL=[...CHARS,HIDDEN,SORA,VERDICT,ECLIPSE];
ALL.forEach(c=>c.moves.forEach(m=>m.t=m.t||1));
const byId=id=>ALL.find(c=>c.id===id);

/* ---- 言語（ja / zh＝簡体字中国語） ---- */
let LANG='ja';
const L=(ja,zh)=>LANG==='zh'?zh:ja;
const ZH={
 chars:{
  dodo:{name:'多多前辈',role:'防守型·悠闲回复',pn:'蓬松羽毛',pd:'自己的回合开始时获得护盾4',lines:['慢慢来嘛～不过我可不会输哦？','呼，这就是前辈的骨气','好像……午觉睡太久了']},
  fox:{name:'齿轮狐',role:'技巧型·擅长重掷',pn:'灵巧双手',pd:'回合开始时，点数为1的骰子全部重掷',lines:['把你的结构全部拆开！','和设计的一样！','可恶，少了一颗螺丝……']},
  wolf:{name:'沃夫',role:'攻击型·越危险越燃',pn:'热血',pd:'体力在一半以下时，攻击伤害+2',lines:['在国家资格考试之前，先打倒你！','好耶，过关了！','下次……一定要考过！']},
  onmyo:{name:'阴阳',role:'干扰型·束缚对手',pn:'鬼面',pd:'受到的攻击伤害总是减少1',lines:['……阴与阳，会倒向哪一边','命中注定','……有意思']},
  tsukiyo:{name:'月夜',role:'技巧型·靠对子发光',pn:'星降之夜',pd:'回合开始时若掷出对子，下次攻击+3',lines:['星星告诉我，你会输','正如星象所示','今晚是阴天吗……']},
  mouse:{name:'啾太',role:'小技型·与机器人配合',pn:'碎步',pd:'伤害5以下的攻击+1',lines:['啾！和机器人一起加油！','赢啦啾！','机器人，得修一修了……']},
  owl:{name:'呼博士',role:'强化型·计算后一击',pn:'博学',pd:'「下次攻击+」的效果再+1',lines:['计算早已完成','呼呼，正如理论所示','计算有误差吗……']},
  gorilla:{name:'伏特猩猩',role:'攻击型·电击力量',pn:'全力输出',pd:'用点数6发动的攻击伤害+3',lines:['全力上了，吼！','百万伏特的胜利！','电……没电了……']},
  robot:{name:'机甲罗博',role:'防守型·稳定作战',pn:'自我修复',pd:'自己的回合结束时恢复4点体力',lines:['战斗模式，启动','任务，完成','系统……关闭……']},
  rocker:{name:'十七',role:'一发逆转型·赌徒',pn:'摇滚',pd:'每回合骰子+1个，但回合开始时受到2点伤害',lines:['用我的吉他让你闭嘴','不需要安可','……今天只是琴弦断了']},
  sora:{name:'匠空',role:'20F真·塔之主·无人机操作员',pn:'空中视角',pd:'攻击可穿透对方2点护盾',lines:['我在天上都看到了。让我试试你的本事！','从天上看得一清二楚！','服了！让我加入你们吧！']},
  takumi:{name:'匠',role:'隐藏角色·塔之主',pn:'大师之技',pd:'攻击伤害+1，获得的护盾+1',lines:['让我看看你夜里磨练、开创未来的力量吧！','磨练得还不够哦，再来挑战吧！','好厉害！你才是真正的大师！']},
  nero:{name:'尼禄',role:'干扰型·甜蜜陷阱',pn:'锁链之誓',pd:'「对方下次攻击−」的效果再−2',lines:['甜的只有糖果。我可不一样哦','多谢款待♪','……糖果，掉了']},
  okajun:{name:'冈纯',role:'反击型·以牙还牙',pn:'工业魂',pd:'受到5点以上伤害的攻击时，下次攻击+2',lines:['别小看工业啊','整备完毕','……今天引擎发动不起来']},
  hayate:{name:'疾风',role:'速攻型·第一击',pn:'安全确认完毕',pd:'每回合第一次攻击伤害+2',lines:['安全第一，但也要全力以赴！','和实习时一样！','下次……我会重新检查步骤']},
  kurogane:{name:'黑铁',role:'顽强型·打不倒',pn:'九条命',pd:'仅限1次，受到致命攻击时以体力5撑住',lines:['喵！整备就交给我吧！','耶！喵哈哈！','……尾巴，被踩到了…']},
  lionex:{name:'雷狮王',role:'攻击型·雷之大招',pn:'雷鸣',pd:'对子攻击无视对方护盾',lines:['……聆听雷鸣吧','这是上天的裁决','雷……停了吗']},
  seraph:{name:'炽天使',role:'回复型·祝福',pn:'祝福',pd:'回复技能的回复量+2',lines:['过来吧。你在迷茫吧？','你很努力了呢','……光芒，稍微暗淡了些吗']},
  hakurou:{name:'白狼',role:'防守型·神兽',pn:'天衣',pd:'护盾在回合开始时不会消失，可以保留（最多8）。用护盾完全挡住攻击时，回复挡下的体力',lines:['……风正在考验你','回归天上吧','……这件衣裳，还会被弄脏吗']},
  guardian:{name:'守护者',role:'防守型·尖刺反击',pn:'七色之刺',pd:'每次受到攻击（即使被护盾挡住）都对对方造成2点伤害',lines:['在我的盾牌前跪下吧','骑士道，就在于此','……我的荣耀，竟有了伤痕']},
  libra:{name:'天秤',role:'调整型·黑与白',pn:'天秤',pd:'回合开始时，若同时有偶数和奇数骰子，下次攻击+3',lines:['命运也是一种选择……','判决，你输了','……天秤，倾斜了']},
  spino:{name:'棘骨龙',role:'一击型·化石之躯',pn:'化石之躯',pd:'4点以下伤害的攻击无效',lines:['咔嗒咔嗒…一亿年来的第一个猎物','变成化石再来吧','……骨头，散架了…']},
  verdict:{name:'裁决',role:'审判之塔10F之主·黑白之鸟',pn:'黑白之羽',pd:'每到自己的回合黑白交替。黑色时攻击+2，白色时受到的伤害−1',lines:['……你的灵魂是白是黑，让我来衡量','结果是，黑','……白之羽，赢了吗']},
  eclipse:{name:'日蚀',role:'审判之塔20F之主·黑白之兽',pn:'审判宣告',pd:'自己回合开始时宣告「偶数」或「奇数」。用宣告点数的攻击+3，相反点数的攻击−3（双方适用，对子技能除外）',lines:['阴与阳，皆由我裁决。来吧','判决已下','……漂亮。你的光是真的']},
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
  'ドローン偵察':'无人机侦察','空撮':'航拍','プロペラカッター':'螺旋桨切割','ホバリング':'悬停','自動追尾':'自动追踪','電波妨害':'电波干扰','空爆ドローン':'空袭无人机',
  '匠の一打':'匠之一击','研ぎ澄ます':'磨砺','段取り八分':'准备八分','仕上げ':'收尾','精密加工':'精密加工','検査':'检验','奥義・千本鍛え':'奥义·千锤百炼',
  'キャンディ投げ':'投掷糖果','チェーンウィップ':'锁链鞭','鎖しばり':'锁链束缚','ペロッ':'舔一口','タトゥーの呪い':'刺青诅咒','シルバーリング':'银戒指','ブラックロリポップ':'黑色棒棒糖',
  '鉄拳':'铁拳','スパナ一閃':'扳手一闪','メンチ切り':'瞪眼威吓','油差し':'加油润滑','ボルト締め':'拧紧螺栓','フルスイング':'全力挥击','工業なめんな':'别小看工业',
  '正拳突き':'正拳突击','ジャブ':'刺拳','安全メガネ':'安全眼镜','指差し確認':'指认确认','軍手パンチ':'劳保手套拳','グラインダー':'砂轮机','実習の成果':'实习成果',
  'ねこパンチ':'猫猫拳','スパナひっかき':'扳手抓挠','しっぽバランス':'尾巴平衡','ドライバー投げ':'投掷螺丝刀','にゃんこ整備':'喵喵整备','ピース':'比耶','黒猫クラッシュ':'黑猫冲撞',
  '雷爪':'雷爪','たてがみの稲光':'鬃毛闪电','咆哮':'咆哮','帯電':'带电','落雷':'落雷','雷光ステップ':'雷光步','天雷':'天雷',
  '光の手':'光之手','鳩の使い':'鸽之使者','祝福の光':'祝福之光','聖なる輪':'神圣之环','月桂冠':'月桂冠','光輪':'光轮','ヘイロー':'光环',
  '白牙':'白牙','羽衣の舞':'羽衣之舞','金の房':'金之穗','遠吠え':'远嚎','天衣無縫':'天衣无缝','白銀の爪':'白银之爪','神狼降臨':'神狼降临',
  'しっぽ払い':'甩尾扫击','大あご':'大颚','腕組み':'抱臂','騎士の誓い':'骑士之誓','マント翻し':'披风翻舞','ワニのひと噛み':'鳄鱼一咬','レインボースパイク':'彩虹尖刺',
  '白のサイコロ':'白之骰','黒のサイコロ':'黑之骰','均衡':'均衡','判決':'判决','天秤の傾き':'天秤倾斜','公正な裁き':'公正审判','最終審判':'最终审判',
  '骨かみ':'骨咬','帆びれガード':'背帆防御','化石の眠り':'化石之眠','古代の咆哮':'古代咆哮','ボーンクロー':'骨爪','背骨ムチ':'脊骨鞭','白亜紀バイト':'白垩纪咬击',
  '黒羽の刃':'黑羽之刃','白羽の盾':'白羽之盾','審きの眼':'审判之眼','双翼':'双翼','白黒の爪':'黑白之爪','月の宝珠':'月之宝珠','白黒裁断':'黑白裁断',
  '陰の爪':'阴之爪','陽の牙':'阳之牙','太極の環':'太极之环','審判の咆哮':'审判咆哮','黒炎':'黑炎','白光':'白光','陰陽審判':'阴阳审判',
 },
 floors:['见习之间','车床室','制图室','焊接工房','电气实习室','化学室','机械工厂','信息处理室','风暴屋顶','塔主之间','试作室','锻造场','控制室','研究所','精密测量室','发电站','设计局','风暴展望台','观星回廊','天空工房'],
 floorsJ:['开庭之间','白之证言台','黑之证言台','天秤之间','镜之法庭','证据保管库','沉默之间','表里之间','法槌之间','判决栖木','陪审员席','辩论之间','镜之回廊','六法书库','封印之间','判例之间','双子证人','雷鸣大法庭','最终辩论','日蚀王座'],
 rules:{scale:'体力比例高于对方时，攻击伤害−2',mirror:'攻击方也会受到所造成伤害的1/4',silence:'恢复量减半',flip:'奇数回合奇数点数、偶数回合偶数点数的攻击+2',gavel:'回合开始时，点数为1的骰子消失',odd:'用奇数点数发动的攻击伤害+2',dice:'双方骰子+1个',even:'用偶数点数发动的攻击伤害+2',pair:'对子技能伤害+4',heal:'恢复量变为2倍',guardHalf:'获得的护盾减半',six:'用点数6发动的攻击伤害+3',storm:'回合开始时，当前行动方受到1点伤害',boss:'对方队伍攻击伤害+1'},
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
/* 審判の塔（vol.2）：裁判がテーマ。★は審判の塔だけのルール */
const FLOORS_J=[
 {n:'開廷の間',rule:null},
 {n:'白の証言台',rule:{k:'even',d:'偶数の出目で使った攻撃ダメージ+2'}},
 {n:'黒の証言台',rule:{k:'odd',d:'奇数の出目で使った攻撃ダメージ+2'}},
 {n:'天秤の間',rule:{k:'scale',d:'体力の割合が相手より多いと、攻撃ダメージ−2'}},
 {n:'鏡の法廷',rule:{k:'mirror',d:'攻撃した側も、与えたダメージの1/4を受ける'}},
 {n:'証拠保管庫',rule:{k:'dice',d:'お互いサイコロ+1個'}},
 {n:'黙秘の間',rule:{k:'silence',d:'回復量が半分'}},
 {n:'表裏の間',rule:{k:'flip',d:'奇数ラウンドは奇数、偶数ラウンドは偶数の出目の攻撃+2'}},
 {n:'木槌の間',rule:{k:'gavel',d:'ターン開始時、出目1のサイコロが消える'}},
 {n:'判決の止まり木',rule:{k:'boss',d:'相手チームの攻撃ダメージ+1'}},
 {n:'陪審員席',rule:{k:'scale',d:'体力の割合が相手より多いと、攻撃ダメージ−2'}},
 {n:'弁論の間',rule:{k:'dice',d:'お互いサイコロ+1個'}},
 {n:'鏡の回廊',rule:{k:'mirror',d:'攻撃した側も、与えたダメージの1/4を受ける'}},
 {n:'六法の書庫',rule:{k:'six',d:'出目6を使った攻撃ダメージ+3'}},
 {n:'封印の間',rule:{k:'silence',d:'回復量が半分'}},
 {n:'判例の間',rule:{k:'flip',d:'奇数ラウンドは奇数、偶数ラウンドは偶数の出目の攻撃+2'}},
 {n:'双子の証人',rule:{k:'pair',d:'ゾロ目技のダメージ+4'}},
 {n:'雷鳴の大法廷',rule:{k:'storm',d:'ターン開始時、そのターンの人が1ダメージ'}},
 {n:'最終弁論',rule:{k:'gavel',d:'ターン開始時、出目1のサイコロが消える'}},
 {n:'日蝕の玉座',rule:{k:'boss',d:'相手チームの攻撃ダメージ+1'}},
];
/* 塔ごとの設定：出てくる敵（vol）と10F・20Fのボス。hp20 は20Fボスの体力の上乗せ */
const TOWER={meister:{floors:FLOORS,vol:1,b10:'takumi',b20:'sora',hp20:0},judge:{floors:FLOORS_J,vol:2,b10:'verdict',b20:'eclipse',hp20:8}};
const towerOf=t=>TOWER[t]||TOWER.meister;
const BK={chars:{},floors:FLOORS.map(f=>({n:f.n,d:f.rule&&f.rule.d})),floorsJ:FLOORS_J.map(f=>({n:f.n,d:f.rule&&f.rule.d}))};
ALL.forEach(c=>BK.chars[c.id]={name:c.name,role:c.role,pn:c.passive.n,pd:c.passive.d,lines:[...c.lines],moves:c.moves.map(m=>m.n)});
function setLang(l){LANG=l==='zh'?'zh':'ja';const zh=LANG==='zh';
  ALL.forEach(c=>{const b=BK.chars[c.id],z=ZH.chars[c.id]||{};c.name=zh&&z.name||b.name;c.role=zh&&z.role||b.role;c.passive.n=zh&&z.pn||b.pn;c.passive.d=zh&&z.pd||b.pd;
    c.lines=zh&&z.lines||[...b.lines];c.moves.forEach((m,k)=>m.n=zh&&ZH.moves[b.moves[k]]||b.moves[k])});
  FLOORS.forEach((f,i)=>{f.n=zh&&ZH.floors[i]||BK.floors[i].n;if(f.rule)f.rule.d=zh&&ZH.rules[f.rule.k]||BK.floors[i].d});
  FLOORS_J.forEach((f,i)=>{f.n=zh&&ZH.floorsJ[i]||BK.floorsJ[i].n;if(f.rule)f.rule.d=zh&&ZH.rules[f.rule.k]||BK.floorsJ[i].d});
  return LANG}
const getLang=()=>LANG;
const floorStar=f=>f<=3?1:f<=6?2:3;
/* 上層の敵レベル：11-12F=Lv1、13-14F=Lv2 … 19-20F=Lv5（周回ごとに+2） */
const enemyLv=(f,lap=1)=>f>TOP?Math.ceil((f-TOP)/2)+(lap-1)*2:0;
const lvBonus=lv=>Math.floor(lv/2);
const floorCount=f=>f>TOP?(f%2===0?4:3):f<=3?1:f<=7?2:3;
const floorHP=(f,lap)=>f>TOP?Math.round((30+enemyLv(f,lap)*2)*(f%2===0?.8:1)):(f<=7?24+f*2:20+f*2);
const bossHP=(f,lap,tw)=>f===TOP2?50+towerOf(tw).hp20+(lap-1)*10:40;
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
  const fx=c.fx||{};
  if(c.dmg)c.dmg.b=(c.dmg.b||0)+((fx.dDown||fx.dUp)?1:2)*lv;
  else{c.fx=fx;const k=['guard','heal','pow','weak'].find(k=>fx[k]);if(k)fx[k]+=(k==='pow'||k==='weak'?1:2)*lv;else fx.guard=(fx.guard||0)+2*lv}
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
function mkFighter(id,star,mv,lvMap,hp,elv=0,bonus=0,raid=false){const ch=byId(id);
  return{ch,star,moves:mv.map(k=>applyLv(ch.moves[k],(lvMap||{})[k]||0)),hp,max:hp,guard:0,pow:0,weak:0,dMod:0,lv:elv,bonus,raid}}
function enemiesFor(f,lap,R=Math.random,avoid=[],tw='meister'){const T=towerOf(tw),n=floorCount(f),st=f>TOP?3:floorStar(f),lv=enemyLv(f,lap),out=[],pool=CHARS.filter(c=>c.vol===T.vol).map(c=>c.id);
  for(let i=0;i<n;i++){
    if((f===TOP||f===TOP2)&&i===n-1){out.push({id:f===TOP?T.b10:T.b20,star:3,hp:bossHP(f,lap,tw),lv:f===TOP2?lv+1:0,bonus:f===TOP2?lvBonus(lv):0,boss:true});break}
    let id;let tries=0;do{id=pool[Math.floor(R()*pool.length)];tries++}while(tries<20&&(out.some(e=>e.id===id)||(avoid.includes(id)&&R()<.6)));
    out.push({id,star:st,hp:floorHP(f,lap),lv,bonus:lvBonus(lv)})}
  return out.map(e=>({...e,mv:autoPick(byId(e.id),e.star,1.5,R)}))}
/* 無限の塔：負けるまで登る。数字はシミュレーションで調整済み（今の最強で中央値40F前後、100Fは届かない） */
const INF={lvEvery:12,hp0:18,hpPer:.35,boss0:30,bossPer:6,revive:.5};
function infEnemies(f,R=Math.random,avoid=[]){const boss=f%10===0,m=f%10,lv=Math.floor(f/INF.lvEvery),bonus=lvBonus(lv),st=Math.min(3,1+Math.floor((f-1)/10));
  const n=boss?2:(m<=3?1:2),hp=Math.round(INF.hp0+f*INF.hpPer),pool=CHARS.map(c=>c.id),out=[];
  for(let i=0;i<n;i++){let id,t=0;do{id=pool[Math.floor(R()*pool.length)];t++}while(t<20&&(out.some(e=>e.id===id)||(avoid.includes(id)&&R()<.6)));out.push({id,star:st,hp,lv,bonus})}
  if(boss){const k=f/10;out.push({id:['takumi','verdict','sora','eclipse'][(k-1)%4],star:3,hp:Math.round(INF.boss0+k*INF.bossPer),lv:lv+1,bonus,boss:true})}
  return out.map(e=>({...e,mv:autoPick(byId(e.id),e.star,1.5,R)}))}
/* 乱入バトルの敵：チート性能の匠空 */
function raidEnemy(){const c=SORA;return{id:'sora',star:3,hp:78,lv:99,bonus:2,raid:true,mv:[2,4,5,6]}}
/* 通信対戦：同じシードの乱数で、両方の端末が同じ結果を計算する（自分は常に side 0） */
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function newPvP(o){/* o:{me:[{id,star,mv,lv}],opp:[...],seed,firstSide} */
  const fs=o.firstSide?1:0;
  const S={floor:0,lap:1,rule:null,turn:0,over:-1,ev:[],pvp:true,maxRound:o.maxRound||12,firstSide:fs,R:rng(o.seed),
    sides:[{team:o.me.map(p=>mkFighter(p.id,p.star,p.mv,p.lv,PLAYER_HP)),idx:0,dice:[],used:new Set(),first:fs===0},
           {team:o.opp.map(p=>mkFighter(p.id,p.star,p.mv,p.lv,PLAYER_HP)),idx:0,dice:[],used:new Set(),first:fs===1}]};
  return S}
function newBattle(o){/* o:{floor,lap,party:[{id,star,mv,lv}],enemies:[{id,star,mv,hp}]} */
  const fl=towerOf(o.tower).floors[o.floor-1]||{n:'',rule:null};
  const S={floor:o.floor,lap:o.lap||1,tower:o.tower||'meister',fl,rule:fl.rule,turn:0,over:-1,ev:[],
    sides:[{team:o.party.map(p=>mkFighter(p.id,p.star,p.mv,p.lv,p.hp||PLAYER_HP)),idx:0,dice:[],used:new Set(),first:true},
           {team:o.enemies.map(e=>mkFighter(e.id,e.star,e.mv,null,e.hp,e.lv||0,e.bonus||0,!!e.raid)),idx:0,dice:[],used:new Set(),first:false}]};
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

function startTurn(S,i,R=S.R||Math.random){if(S.over>=0)return take(S);
  S.turn=i;const sd=S.sides[i],f=act(S,i),pk=f.ch.passive.k;f.guard=pk==='veil'?Math.min(8,f.guard):0;f.firstHit=true;sd.used=new Set();sd.dice=[];
  E(S,'turn',i===0?L('あなたのターン！','你的回合！'):L('相手のターン！','对方的回合！'),{side:i});
  if(i===(S.firstSide||0))S.round=(S.round||0)+1;
  /* 通信対戦：決められたラウンドを超えたら、残り体力の割合で判定（両方の端末で同じ結果になる） */
  if(S.maxRound&&S.round>S.maxRound){const rate=k=>{const t=S.sides[k].team;return t.reduce((a,f)=>a+Math.max(0,f.hp),0)/t.reduce((a,f)=>a+f.max,0)};
    const hp=k=>S.sides[k].team.reduce((a,f)=>a+Math.max(0,f.hp),0);const a=rate(0),b=rate(1);
    const w=a!==b?(a>b?0:1):hp(0)!==hp(1)?(hp(0)>hp(1)?0:1):1-(S.firstSide||0);
    E(S,'judge',L(`${S.maxRound}ラウンド終了！ 残り体力 ${Math.round(a*100)}% 対 ${Math.round(b*100)}% で判定`,`${S.maxRound}回合结束！剩余体力 ${Math.round(a*100)}% 对 ${Math.round(b*100)}%，进行判定`),{side:w});
    S.over=w;E(S,'over','',{winner:w});return take(S)}
  if(S.round>=FATIGUE){const d=S.round-FATIGUE+1;f.hp=Math.max(0,f.hp-d);E(S,'hit',L(`長期戦の疲れ！ ${f.ch.name}に ${d} ダメージ`,`持久战的疲劳！ ${f.ch.name} 受到 ${d} 点伤害`),{side:i,amt:d,src:-1})}
  if(rk(S)==='storm'){f.hp=Math.max(0,f.hp-1);E(S,'hit',L(`嵐で ${f.ch.name}に 1ダメージ`,`风暴使 ${f.ch.name} 受到1点伤害`),{side:i,amt:1,src:-1})}
  if(pk==='gamble'&&f.hp>0){f.hp=Math.max(0,f.hp-2);E(S,'hit',L(`ロックンロール！ ${f.ch.name}は 2ダメージ`,`摇滚！ ${f.ch.name} 受到2点伤害`),{side:i,amt:2,src:-1})}
  checkKO(S);if(S.over>=0)return take(S);
  const g=act(S,i),gk=g.ch.passive.k;
  let n=DICE+g.dMod+(rk(S)==='dice'?1:0)+(gk==='gamble'?1:0)+(g.raid?2:0)-(sd.first?1:0);n=Math.max(1,Math.min(MAXD,n));g.dMod=0;
  const firstNote=sd.first?L('（最初のターンは1個少ない）','（第一回合少1个）'):'';sd.first=false;
  sd.dice=Array.from({length:n},()=>({v:r6(R),used:false}));
  E(S,'roll',L(`サイコロ${n}個 → `,`骰子${n}个 → `)+`${sd.dice.map(d=>d.v).join(L('・','·'))}${firstNote}`,{side:i});
  if(gk==='reroll1'&&sd.dice.some(d=>d.v===1)){sd.dice.forEach(d=>{if(d.v===1)d.v=r6(R)});E(S,'roll',L('器用な手先！ 1を振り直し → ','灵巧双手！ 重掷1 → ')+sd.dice.map(d=>d.v).join(L('・','·')),{side:i})}
  if(rk(S)==='gavel'&&sd.dice.some(d=>d.v===1)&&sd.dice.length>1){const k=sd.dice.filter(d=>d.v!==1);sd.dice=k.length?k:[sd.dice[0]];E(S,'roll',L('木槌！ 出目1のサイコロが消えた → ','法槌！ 点数为1的骰子消失了 → ')+sd.dice.map(d=>d.v).join(L('・','·')),{side:i})}
  if(gk==='wb'){g.white=!g.white;E(S,'buff',g.white?L(`${g.ch.name}は 白の羽に。受けるダメージ−1`,`${g.ch.name} 变为白之羽，受到的伤害−1`):L(`${g.ch.name}は 黒の羽に。攻撃+2`,`${g.ch.name} 变为黑之羽，攻击+2`),{side:i})}
  if(gk==='decree'){S.decree=R()<.5?1:0;E(S,'buff',S.decree?L('審判の宣告：「奇数」！ 奇数の出目の攻撃+3、偶数は−3','审判宣告：「奇数」！奇数点数的攻击+3，偶数−3'):L('審判の宣告：「偶数」！ 偶数の出目の攻撃+3、奇数は−3','审判宣告：「偶数」！偶数点数的攻击+3，奇数−3'),{side:i})}
  if(gk==='balance'){const vs=sd.dice.map(d=>d.v);if(vs.some(v=>v%2)&&vs.some(v=>v%2===0)){g.pow+=3;E(S,'buff',L('天秤！ 偶数と奇数がそろって 次の攻撃+3','天秤！ 偶数与奇数齐备，下次攻击+3'),{side:i})}}
  if(gk==='guardStart'){const gg=gain(S,g,4);E(S,'guard',L(`ふかふか羽毛で ガード${gg}`,`蓬松羽毛：护盾${gg}`),{side:i,amt:gg})}
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
  let d=(m.dmg.b||0)+(m.dmg.m||0)*v;if(m.fx&&m.fx.gdmg&&f.guard)d+=f.guard;
  const add=(n,why)=>{if(n){d+=n;notes.push(`${why}${n>0?'+':''}${n}`)}};
  if(rk(S)==='odd'&&v%2===1&&m.c.t!=='pair')add(2,S.fl.n);
  if(rk(S)==='even'&&v%2===0&&m.c.t!=='pair')add(2,S.fl.n);
  if(rk(S)==='pair'&&m.c.t==='pair')add(4,S.fl.n);
  if(rk(S)==='six'&&v===6)add(3,S.fl.n);
  if(rk(S)==='boss'&&i===1)add(1,S.fl.n);
  if(pk==='rage'&&f.hp<=f.max/2)add(2,f.ch.passive.n);
  if(pk==='six'&&v===6)add(3,f.ch.passive.n);
  if(pk==='smallHit'&&d<=5)add(1,f.ch.passive.n);
  if(pk==='first'&&f.firstHit)add(2,f.ch.passive.n);
  if(pk==='wb'&&!f.white)add(2,L('黒の羽','黑之羽'));
  if(pk==='master')add(1,f.ch.passive.n);
  if(f.bonus)add(f.bonus,'Lv'+f.lv);
  if(f.pow)add(f.pow,L('溜め','蓄力'));
  if(f.weak)add(-f.weak,L('弱体','削弱'));
  if(o.ch.passive.k==='armor')add(-1,o.ch.passive.n);
  if(o.ch.passive.k==='wb'&&o.white)add(-1,L('白の羽','白之羽'));
  if(S.decree!=null&&m.c.t!=='pair'&&(f.ch.passive.k==='decree'||o.ch.passive.k==='decree'))add(v%2===S.decree?3:-3,L('宣告','宣告'));
  if(rk(S)==='scale'&&f.hp/f.max>o.hp/o.max)add(-2,S.fl.n);
  if(rk(S)==='flip'&&m.c.t!=='pair'&&(v%2===1)===((S.round||1)%2===1))add(2,S.fl.n);
  if(o.ch.passive.k==='fossil'&&d>0&&d<=4)add(-d,o.ch.passive.n);
  return{d:Math.max(0,d),notes}}

function useMove(S,i,mi,ks){const sd=S.sides[i],f=act(S,i),o=act(S,1-i),m=f.moves[mi],v=sd.dice[ks[0]].v;
  ks.forEach(k=>sd.dice[k].used=true);sd.used.add(mi);
  E(S,'cast',L(`${f.ch.name}の ${m.n}！（出目 `,`${f.ch.name} 使出 ${m.n}！（点数 `)+`${ks.map(k=>sd.dice[k].v).join(L('・','·'))}）`,{side:i,mi,vals:ks.map(k=>sd.dice[k].v)});
  const fx=m.fx||{};
  if(m.dmg){const r=calcDmg(S,i,m,v);let d=r.d;f.pow=0;f.weak=0;
    f.firstHit=false;const pierce=f.raid?99:(f.ch.passive.k==='sky'?2:0)+(f.ch.passive.k==='thunder'&&m.c.t==='pair'?99:0);
    if(o.guard&&d>0){const eff=Math.max(0,o.guard-pierce),g=Math.min(eff,d);if(g){o.guard-=g;d-=g;r.notes.push(L(`ガード−${g}`,`护盾−${g}`))}else r.notes.push(L('ガード貫通','穿透护盾'))}
    const blocked=r.d-d,ok=o.ch.passive.k;let saved=false;
    if(ok==='nine'&&!o.nineUsed&&d>=o.hp&&o.hp>0){o.nineUsed=true;saved=true;d=Math.max(0,o.hp-5)}
    o.hp=Math.max(0,o.hp-d);if(saved&&o.hp<5)o.hp=5;
    E(S,'hit',L(`${o.ch.name}に ${d} のダメージ！`,`${o.ch.name} 受到 ${d} 点伤害！`)+(r.notes.length?'（'+r.notes.join('、')+'）':''),{side:1-i,amt:d,src:i});
    if(saved)E(S,'heal',L(`九つの命！ ${o.ch.name}は 体力5で耐えた！`,`九条命！ ${o.ch.name} 以体力5撑住了！`),{side:1-i,amt:0});
    if(ok==='veil'&&blocked>0&&d===0&&o.hp>0&&o.hp<o.max){const h=Math.min(o.max-o.hp,blocked);o.hp+=h;E(S,'heal',L(`天衣！ 防いだ分 ${o.ch.name}は 体力${h}回復`,`天衣！ ${o.ch.name} 回复挡下的体力${h}`),{side:1-i,amt:h})}
    if(ok==='revenge'&&d>=5&&o.hp>0){o.pow+=2;E(S,'buff',L(`工業魂！ ${o.ch.name}の 次の攻撃+2`,`工业魂！ ${o.ch.name} 的下次攻击+2`),{side:1-i})}
    if(ok==='thorn'&&r.d>0&&f.hp>0){f.hp=Math.max(0,f.hp-2);E(S,'hit',L(`七色のトゲ！ ${f.ch.name}に 2ダメージ`,`七色之刺！ ${f.ch.name} 受到2点伤害`),{side:i,amt:2,src:1-i})}
    if(rk(S)==='mirror'&&d>=4&&f.hp>0){const b=Math.floor(d/4);f.hp=Math.max(0,f.hp-b);E(S,'hit',L(`鏡の反射！ ${f.ch.name}に ${b}ダメージ`,`镜面反射！ ${f.ch.name} 受到${b}点伤害`),{side:i,amt:b,src:-1})}}
  if(fx.guard){const g=gain(S,f,fx.guard);E(S,'guard',L(`${f.ch.name}は ガード${g}を得た！`,`${f.ch.name} 获得护盾${g}！`),{side:i,amt:g})}
  if(fx.pow){const p=fx.pow+(f.ch.passive.k==='powBonus'?1:0);f.pow+=p;E(S,'buff',L(`${f.ch.name}の 次の攻撃が +${p}！`,`${f.ch.name} 的下次攻击 +${p}！`),{side:i})}
  if(fx.weak){const w=fx.weak+(f.ch.passive.k==='chainW'?2:0);o.weak+=w;E(S,'debuff',L(`${o.ch.name}の 次の攻撃が −${w}！`,`${o.ch.name} 的下次攻击 −${w}！`),{side:1-i})}
  if(fx.heal){const base=fx.heal+(f.ch.passive.k==='bless'?2:0),h=Math.min(f.max-f.hp,rk(S)==='heal'?base*2:rk(S)==='silence'?Math.floor(base/2):base);f.hp+=h;E(S,'heal',h?L(`${f.ch.name}は 体力を ${h} 回復した！`,`${f.ch.name} 恢复了 ${h} 点体力！`):L('しかし 体力は満タンだ！','但体力已经是满的！'),{side:i,amt:h})}
  if(fx.dUp){f.dMod+=fx.dUp;E(S,'buff',L(`${f.ch.name}の 次のターンのサイコロが +${fx.dUp}！`,`${f.ch.name} 的下回合骰子 +${fx.dUp}！`),{side:i})}
  if(fx.dDown){o.dMod-=fx.dDown;E(S,'debuff',L(`${o.ch.name}の 次のターンのサイコロが −${fx.dDown}！`,`${o.ch.name} 的下回合骰子 −${fx.dDown}！`),{side:1-i})}
  if(fx.reroll){const nv=r6(S.R||Math.random);sd.dice.push({v:nv,used:false});E(S,'roll',L('サイコロを振り直した → ','重掷了骰子 → ')+nv,{side:i})}
  checkKO(S);return take(S)}

function endTurn(S,i){if(S.over>=0)return take(S);const f=act(S,i);
  if(f.ch.passive.k==='regen'&&f.hp<f.max){const h=Math.min(4,f.max-f.hp);f.hp+=h;E(S,'heal',L(`自己修復で 体力${h}回復`,`自我修复：恢复体力${h}`),{side:i,amt:h})}
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

/* プロフィール名の単語（前・中・後）。番号はサーバーに保存されるので、並びは変えずに後ろへ足すこと。3つ目は解放条件 */
const WORDS=[[
  ['夜明けの','黎明的','L:5'],['真夜中の','午夜的','L:7'],['燃える','燃烧的'],['凍てつく','冰封的','M:45'],['無敵の','无敌的','M:70'],['静かなる','沉静的'],
  ['熱血','热血'],['気まぐれ','随性的'],['疾風の','疾风的','M:10'],['鋼の','钢铁的','M:15'],['黄金の','黄金的','M:55'],['青き','蔚蓝的'],
  ['眠れる','沉睡的','L:30'],['光る','闪耀的'],['さすらいの','流浪的','L:20'],['不屈の','不屈的','M:25'],['陽気な','开朗的'],['迷える','迷途的','M:3'],
  ['天才','天才','M:90'],['雷鳴の','雷鸣的','M:35'],['星降る','星落的','L:14'],['月夜の','月夜的','L:10'],['朝練の','晨练的','L:2'],['放課後の','放学后的','L:3'],
  ['腹ぺこ','饿肚子的'],['全力','全力'],['寡黙な','沉默的','M:5'],['秘密の','秘密的','M:20'],['噂の','传闻中的','M:8'],['はじまりの','起点的'],
  ['挑む','挑战的',1],['伝説の','传说的',2],['真・','真·',3],['博識の','博学的',4],['星屑の','星屑的',5],['皆勤の','全勤的',6],
  ['百戦錬磨の','身经百战的',7],['最強の','最强的',8],['天空の','天空的',9],['白星の','白星的','cupwin'],['ふかふかの','毛茸茸的','c:dodo'],['吠える','咆哮的','c:wolf'],
  ['電撃の','电击的','c:gorilla'],['{c}の','{c}的','u:dodo:1'],['おおらかな','大度的','u:dodo:20'],['のんびり','悠哉的','u:dodo:50'],['{c}の','{c}的','u:fox:1'],['器用な','灵巧的','u:fox:50'],
  ['{c}の','{c}的','u:wolf:1'],['牙をむく','露出獠牙的','u:wolf:20'],['月に吠える','对月长嚎的','u:wolf:100'],['{c}の','{c}的','u:onmyo:1'],['百鬼夜行の','百鬼夜行的','u:onmyo:100'],['{c}の','{c}的','u:tsukiyo:1'],
  ['天の川の','银河的','u:tsukiyo:100'],['{c}の','{c}的','u:mouse:1'],['ちょこまか','蹦蹦跳跳的','u:mouse:50'],['{c}の','{c}的','u:owl:1'],['{c}の','{c}的','u:gorilla:1'],['力持ちの','力大无穷的','u:gorilla:20'],
  ['{c}の','{c}的','u:robot:1'],['全自動','全自动','u:robot:20'],['{c}の','{c}的','u:rocker:1'],['一か八かの','孤注一掷的','u:rocker:20'],['ロックな','摇滚的','u:rocker:50'],['{c}の','{c}的','u:takumi:1'],
  ['{c}の','{c}的','u:sora:1'],['空飛ぶ','飞翔的','u:sora:50'],
  ['10階の','10层的','I:10'],['20階の','20层的','I:20'],['30階の','30层的','I:30'],['40階の','40层的','I:40'],['50階の','50层的','I:50'],['60階の','60层的','I:60'],['70階の','70层的','I:70'],['80階の','80层的','I:80'],['90階の','90层的','I:90'],['100階の','100层的','I:100'],
  /* vol.2 */
  ['甘い','甜蜜的','c:nero'],['{c}の','{c}的','u:nero:1'],['工業の','工业的','c:okajun'],['{c}の','{c}的','u:okajun:1'],['安全第一の','安全第一的','c:hayate'],['{c}の','{c}的','u:hayate:1'],['黒猫の','黑猫的','c:kurogane'],['{c}の','{c}的','u:kurogane:1'],['雷光の','雷光的','c:lionex'],['{c}の','{c}的','u:lionex:1'],['聖なる','神圣的','c:seraph'],['{c}の','{c}的','u:seraph:1'],['神獣の','神兽的','c:hakurou'],['{c}の','{c}的','u:hakurou:1'],['虹色の','彩虹色的','c:guardian'],['{c}の','{c}的','u:guardian:1'],['公正な','公正的','c:libra'],['{c}の','{c}的','u:libra:1'],['太古の','太古的','c:spino'],['{c}の','{c}的','u:spino:1'],['{c}の','{c}的','u:verdict:1'],['{c}の','{c}的','u:eclipse:1']],
[
  ['旋盤','车床','S:3'],['フライス','铣床','G:200'],['溶接','焊接','S:7'],['歯車','齿轮'],['ドライバー','螺丝刀'],['スパナ','扳手'],
  ['ハンマー','锤子'],['ヤスリ','锉刀','G:20'],['ネジ','螺丝'],['ボルト','螺栓'],['ナット','螺母'],['ノギス','卡尺','G:30'],
  ['万力','虎钳','G:40'],['ドリル','钻头','G:10'],['はんだ','焊锡','G:50'],['回路','电路','G:70'],['モーター','马达','N:3'],['ロボット','机器人','N:5'],
  ['鉄骨','钢梁','N:6'],['設計図','设计图','N:7'],['定規','直尺'],['電池','电池'],['ペンチ','钳子'],['金型','模具','G:120'],
  ['エンジン','引擎','N:8'],['ドローン','无人机','N:10'],['チェーン','链条','N:4'],['砥石','磨刀石','G:90'],['鋳物','铸件','G:150'],['プログラム','程序','N:9'],
  ['塔','塔',2],['匠','匠',3],['星','星',5],['雷','雷',8],['空','空',9],['ゼッケン','号码布','cup1'],
  ['トロフィー','奖杯','cupfin'],['ゴーグル','护目镜','c:fox'],['お札','符咒','c:onmyo'],['装甲','装甲','c:robot'],['ギター','吉他','c:rocker'],['プロペラ','螺旋桨','c:sora'],
  ['しっぽ','尾巴','u:fox:20'],['鬼面','鬼面','u:onmyo:20'],['流れ星','流星','u:tsukiyo:20'],['満月','满月','u:tsukiyo:50'],['チーズ','奶酪','u:mouse:20'],['フラスコ','烧瓶','u:owl:20'],
  ['方程式','方程式','u:owl:50'],['稲妻','闪电','u:gorilla:50'],['超合金','超合金','u:robot:100'],['のみ','凿子','u:takumi:20'],['かんな','刨子','u:takumi:50'],['レーダー','雷达','u:sora:20'],
  /* vol.2 */
  ['キャンディ','糖果','u:nero:20'],['つなぎ','连体工作服','u:okajun:20'],['軍手','劳保手套','u:hayate:20'],['肉球','肉垫','u:kurogane:20'],['たてがみ','鬃毛','u:lionex:20'],['光輪','光轮','u:seraph:20'],['羽衣','羽衣','u:hakurou:20'],['マント','披风','u:guardian:20'],['天秤','天秤','u:libra:20'],['化石','化石','u:spino:20'],['白黒','黑白','c:verdict'],['日蝕','日蚀','c:eclipse']],
[
  ['職人','工匠'],['マイスター','大师','W:300'],['見習い','学徒'],['使い','使者'],['名人','名人','F:12'],['番人','守卫','F:3'],
  ['博士','博士','F:9'],['隊長','队长','F:5'],['王','王','F:18'],['騎士','骑士','W:50'],['魔術師','魔术师','W:100'],['探検家','探险家'],
  ['守護者','守护者','F:7'],['旅人','旅人'],['研究者','研究员'],['選手','选手'],['先輩','前辈'],['仙人','仙人','F:15'],
  ['忍者','忍者','W:20'],['達人','达人','W:200'],['挑戦者','挑战者',1],['塔の主','塔之主',3],['収集家','收藏家',4],['皆勤賞','全勤奖',6],
  ['指揮官','指挥官',7],['覇者','霸者',8],['パイロット','飞行员',9],['チャンピオン','冠军','cupchamp'],['名匠','名匠','meister'],['星読み','占星师','c:tsukiyo'],
  ['相棒','搭档','c:mouse'],['教授','教授','c:owl'],['棟梁','栋梁','c:takumi'],['{c}使い','{c}使','u:dodo:5'],['{c}推し','{c}粉','u:dodo:10'],['大先輩','大前辈','u:dodo:100'],
  ['{c}使い','{c}使','u:fox:5'],['{c}推し','{c}粉','u:fox:10'],['からくり師','机关师','u:fox:100'],['{c}使い','{c}使','u:wolf:5'],['{c}推し','{c}粉','u:wolf:10'],['一匹狼','独狼','u:wolf:50'],
  ['{c}使い','{c}使','u:onmyo:5'],['{c}推し','{c}粉','u:onmyo:10'],['陰陽師','阴阳师','u:onmyo:50'],['{c}使い','{c}使','u:tsukiyo:5'],['{c}推し','{c}粉','u:tsukiyo:10'],['{c}使い','{c}使','u:mouse:5'],
  ['{c}推し','{c}粉','u:mouse:10'],['名コンビ','黄金搭档','u:mouse:100'],['{c}使い','{c}使','u:owl:5'],['{c}推し','{c}粉','u:owl:10'],['大賢者','大贤者','u:owl:100'],['{c}使い','{c}使','u:gorilla:5'],
  ['{c}推し','{c}粉','u:gorilla:10'],['雷神','雷神','u:gorilla:100'],['{c}使い','{c}使','u:robot:5'],['{c}推し','{c}粉','u:robot:10'],['アンドロイド','仿生人','u:robot:50'],['{c}使い','{c}使','u:rocker:5'],
  ['{c}推し','{c}粉','u:rocker:10'],['スター','巨星','u:rocker:100'],['{c}使い','{c}使','u:takumi:5'],['{c}推し','{c}粉','u:takumi:10'],['名工','名工','u:takumi:100'],['{c}使い','{c}使','u:sora:5'],
  ['{c}推し','{c}粉','u:sora:10'],['エース','王牌','u:sora:100'],
  /* vol.2 */
  ['{c}使い','{c}使','u:nero:5'],['{c}推し','{c}粉','u:nero:10'],['小悪魔','小恶魔','u:nero:100'],['{c}使い','{c}使','u:okajun:5'],['{c}推し','{c}粉','u:okajun:10'],['番長','老大','u:okajun:100'],['{c}使い','{c}使','u:hayate:5'],['{c}推し','{c}粉','u:hayate:10'],['技能士','技能士','u:hayate:100'],['{c}使い','{c}使','u:kurogane:5'],['{c}推し','{c}粉','u:kurogane:10'],['招き猫','招财猫','u:kurogane:100'],['{c}使い','{c}使','u:lionex:5'],['{c}推し','{c}粉','u:lionex:10'],['百獣の王','百兽之王','u:lionex:100'],['{c}使い','{c}使','u:seraph:5'],['{c}推し','{c}粉','u:seraph:10'],['大天使','大天使','u:seraph:100'],['{c}使い','{c}使','u:hakurou:5'],['{c}推し','{c}粉','u:hakurou:10'],['守り神','守护神','u:hakurou:100'],['{c}使い','{c}使','u:guardian:5'],['{c}推し','{c}粉','u:guardian:10'],['聖騎士','圣骑士','u:guardian:100'],['{c}使い','{c}使','u:libra:5'],['{c}推し','{c}粉','u:libra:10'],['裁判長','审判长','u:libra:100'],['{c}使い','{c}使','u:spino:5'],['{c}推し','{c}粉','u:spino:10'],['恐竜博士','恐龙博士','u:spino:100'],['{c}使い','{c}使','u:verdict:5'],['{c}推し','{c}粉','u:verdict:10'],['審判者','审判者','u:verdict:100'],['{c}使い','{c}使','u:eclipse:5'],['{c}推し','{c}粉','u:eclipse:10'],['裁定者','裁定者','u:eclipse:100']]];

/* 単語の文字。「{c}」はキャラ名に置きかえる */
function wordText(p,i){const w=(WORDS[p]||[])[i];if(!w)return'？';let t=L(w[0],w[1]);
  if(t.includes('{c}')){const c=byId(String(w[2]).split(':')[1]);t=t.replace('{c}',c?c.name:'？')}return t}
const TITLE_NAMES=[['見習い','学徒'],['塔の挑戦者','塔之挑战者'],['塔の主を倒した者','击败塔之主者'],['真・マイスター','真·大师'],['コレクター','收藏家'],['★3コレクター','★3收藏家'],['皆勤職人','全勤工匠'],['ミッション達人','任务达人'],['通信の猛者','联机猛将'],['天空の覇者','天空霸者'],['チャンピオン','冠军'],['マイスター位 2026','大师位 2026'],['無限の挑戦者','无限挑战者'],['無限の覇者','无限霸者']];
const API={TOWER,towerOf,FLOORS_J,VERDICT,ECLIPSE,WORDS,TITLE_NAMES,wordText,INF,infEnemies,rng,newPvP,raidEnemy,SORA,L,setLang,getLang,FATIGUE,DICE,MAXD,PLAYER_HP,TOP,TOP2,enemyLv,lvBonus,CHARS,HIDDEN,ALL,byId,FLOORS,floorStar,floorCount,floorHP,bossHP,floorCoins,
  condLabel,condOk,dmgLabel,fxLabel,applyLv,moveValue,autoPick,enemiesFor,newBattle,act,startTurn,diceFor,useMove,endTurn,cpuChoose,simulate,calcDmg};
G.ENGINE=API;if(typeof module!=='undefined')module.exports=API;
})(typeof window!=='undefined'?window:globalThis);

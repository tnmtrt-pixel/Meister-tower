/* オリキャラ対戦：データとバトルの仕組み（画面に依存しない） */
(function(G){
const DICE=3,MAXD=6,PLAYER_HP=40,TOP=10,FATIGUE=9;

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
];
const floorStar=f=>f<=3?1:f<=6?2:3;
const floorCount=f=>f<=3?1:f<=7?2:3;
const floorHP=(f,lap)=>(f<=7?24+f*2:20+f*2)+(lap-1)*5;
const bossHP=lap=>40+(lap-1)*8;
const floorCoins=f=>2+Math.ceil(f/2)+(f===TOP?10:0);

/* ---- 表示用ラベル ---- */
function condLabel(c){return{any:'なんでも',even:'偶数',odd:'奇数',pair:'ゾロ目'}[c.t]||(c.t==='min'?c.n+'以上':c.t==='max'?c.n+'以下':c.n+'のみ')}
function condOk(c,v){return c.t==='any'||c.t==='pair'||(c.t==='even'&&v%2===0)||(c.t==='odd'&&v%2===1)||(c.t==='min'&&v>=c.n)||(c.t==='max'&&v<=c.n)||(c.t==='eq'&&v===c.n)}
function dmgLabel(d){if(!d)return'';const m=d.m?(d.m>1?'出目×'+d.m:'出目'):'';return m&&d.b?m+'+'+d.b:m||String(d.b)}
function fxLabel(f){if(!f)return[];const o=[];
  if(f.guard)o.push(`ガード${f.guard}`);if(f.pow)o.push(`次の攻撃+${f.pow}`);if(f.weak)o.push(`相手の次の攻撃−${f.weak}`);
  if(f.heal)o.push(`体力${f.heal}回復`);if(f.dUp)o.push(`次のターン サイコロ+${f.dUp}`);if(f.dDown)o.push(`相手の次のターン サイコロ−${f.dDown}`);if(f.reroll)o.push('サイコロ1個を振り直して戻す');return o}

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
function mkFighter(id,star,mv,lvMap,hp){const ch=byId(id);
  return{ch,star,moves:mv.map(k=>applyLv(ch.moves[k],(lvMap||{})[k]||0)),hp,max:hp,guard:0,pow:0,weak:0,dMod:0}}
function enemiesFor(f,lap,R=Math.random,avoid=[]){const n=floorCount(f),st=Math.min(3,floorStar(f)+(lap>2?1:0)),out=[],pool=CHARS.map(c=>c.id);
  for(let i=0;i<n;i++){if(f===TOP&&i===n-1){out.push({id:'takumi',star:3,hp:bossHP(lap)});break}
    let id;let tries=0;do{id=pool[Math.floor(R()*pool.length)];tries++}while(tries<20&&(out.some(e=>e.id===id)||(avoid.includes(id)&&R()<.6)));
    out.push({id,star:st,hp:floorHP(f,lap)})}
  return out.map(e=>({...e,mv:autoPick(byId(e.id),e.star,1.5,R)}))}
function newBattle(o){/* o:{floor,lap,party:[{id,star,mv,lv}],enemies:[{id,star,mv,hp}]} */
  const S={floor:o.floor,lap:o.lap||1,rule:(FLOORS[o.floor-1]||{}).rule,turn:0,over:-1,ev:[],
    sides:[{team:o.party.map(p=>mkFighter(p.id,p.star,p.mv,p.lv,PLAYER_HP)),idx:0,dice:[],used:new Set(),first:true},
           {team:o.enemies.map(e=>mkFighter(e.id,e.star,e.mv,null,e.hp)),idx:0,dice:[],used:new Set(),first:false}]};
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
    E(S,'ko',`${f.ch.name}は たおれた！`,{side:i});
    const nx=sd.team.findIndex((x,k)=>k>sd.idx&&x.hp>0);
    if(nx<0){S.over=1-i;E(S,'over','',{winner:1-i});return true}
    sd.idx=nx;const n=act(S,i);
    if(i===S.turn){selfDown=true;sd.dice.forEach(d=>d.used=true)}
    E(S,'switch',i===1?`${n.ch.name}が 現れた！「${n.ch.lines[0]}」`:`${n.ch.name}、たのんだ！`,{side:i})}
  return selfDown}

function startTurn(S,i,R=Math.random){if(S.over>=0)return take(S);
  S.turn=i;const sd=S.sides[i],f=act(S,i),pk=f.ch.passive.k;f.guard=0;sd.used=new Set();sd.dice=[];
  E(S,'turn',i===0?'あなたのターン！':'相手のターン！',{side:i});
  if(i===0)S.round=(S.round||0)+1;
  if(S.round>=FATIGUE){const d=S.round-FATIGUE+1;f.hp=Math.max(0,f.hp-d);E(S,'hit',`長期戦の疲れ！ ${f.ch.name}に ${d} ダメージ`,{side:i,amt:d,src:-1})}
  if(rk(S)==='storm'){f.hp=Math.max(0,f.hp-1);E(S,'hit',`嵐で ${f.ch.name}に 1ダメージ`,{side:i,amt:1,src:-1})}
  if(pk==='gamble'&&f.hp>0){f.hp=Math.max(0,f.hp-1);E(S,'hit',`ロックンロール！ ${f.ch.name}は 1ダメージ`,{side:i,amt:1,src:-1})}
  checkKO(S);if(S.over>=0)return take(S);
  const g=act(S,i),gk=g.ch.passive.k;
  let n=DICE+g.dMod+(rk(S)==='dice'?1:0)+(gk==='gamble'?1:0)-(sd.first?1:0);n=Math.max(1,Math.min(MAXD,n));g.dMod=0;
  const firstNote=sd.first?'（最初のターンは1個少ない）':'';sd.first=false;
  sd.dice=Array.from({length:n},()=>({v:r6(R),used:false}));
  E(S,'roll',`サイコロ${n}個 → ${sd.dice.map(d=>d.v).join('・')}${firstNote}`,{side:i});
  if(gk==='reroll1'&&sd.dice.some(d=>d.v===1)){sd.dice.forEach(d=>{if(d.v===1)d.v=r6(R)});E(S,'roll',`器用な手先！ 1を振り直し → ${sd.dice.map(d=>d.v).join('・')}`,{side:i})}
  if(gk==='guardStart'){const gg=gain(S,g,2);E(S,'guard',`ふかふか羽毛で ガード${gg}`,{side:i,amt:gg})}
  if(gk==='pairPow'){const vs=sd.dice.map(d=>d.v);if(vs.some((v,k)=>vs.indexOf(v)!==k)){g.pow+=3;E(S,'buff','星降る夜！ ゾロ目で 次の攻撃+3',{side:i})}}
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
  if(rk(S)==='odd'&&v%2===1&&m.c.t!=='pair')add(2,'旋盤室');
  if(rk(S)==='even'&&v%2===0&&m.c.t!=='pair')add(2,'溶接工房');
  if(rk(S)==='pair'&&m.c.t==='pair')add(4,'電気実習室');
  if(rk(S)==='six'&&v===6)add(3,'情報処理室');
  if(rk(S)==='boss'&&i===1)add(1,'塔の主の間');
  if(pk==='rage'&&f.hp<=f.max/2)add(2,'熱血');
  if(pk==='six'&&v===6)add(3,'パワー全開');
  if(pk==='smallHit'&&d<=5)add(2,'ちょこちょこ');
  if(pk==='master')add(1,'マイスター');
  if(f.pow)add(f.pow,'溜め');
  if(f.weak)add(-f.weak,'弱体');
  if(o.ch.passive.k==='armor')add(-1,'鬼面');
  return{d:Math.max(0,d),notes}}

function useMove(S,i,mi,ks){const sd=S.sides[i],f=act(S,i),o=act(S,1-i),m=f.moves[mi],v=sd.dice[ks[0]].v;
  ks.forEach(k=>sd.dice[k].used=true);sd.used.add(mi);
  E(S,'cast',`${f.ch.name}の ${m.n}！（出目 ${ks.map(k=>sd.dice[k].v).join('・')}）`,{side:i,mi,vals:ks.map(k=>sd.dice[k].v)});
  const fx=m.fx||{};
  if(m.dmg){const r=calcDmg(S,i,m,v);let d=r.d;f.pow=0;f.weak=0;
    if(o.guard&&d>0){const g=Math.min(o.guard,d);o.guard-=g;d-=g;r.notes.push(`ガード−${g}`)}
    o.hp=Math.max(0,o.hp-d);E(S,'hit',`${o.ch.name}に ${d} のダメージ！${r.notes.length?'（'+r.notes.join('、')+'）':''}`,{side:1-i,amt:d,src:i})}
  if(fx.guard){const g=gain(S,f,fx.guard);E(S,'guard',`${f.ch.name}は ガード${g}を得た！`,{side:i,amt:g})}
  if(fx.pow){const p=fx.pow+(f.ch.passive.k==='powBonus'?1:0);f.pow+=p;E(S,'buff',`${f.ch.name}の 次の攻撃が +${p}！`,{side:i})}
  if(fx.weak){o.weak+=fx.weak;E(S,'debuff',`${o.ch.name}の 次の攻撃が −${fx.weak}！`,{side:1-i})}
  if(fx.heal){const h=Math.min(f.max-f.hp,fx.heal*(rk(S)==='heal'?2:1));f.hp+=h;E(S,'heal',h?`${f.ch.name}は 体力を ${h} 回復した！`:'しかし 体力は満タンだ！',{side:i,amt:h})}
  if(fx.dUp){f.dMod+=fx.dUp;E(S,'buff',`${f.ch.name}の 次のターンのサイコロが +${fx.dUp}！`,{side:i})}
  if(fx.dDown){o.dMod-=fx.dDown;E(S,'debuff',`${o.ch.name}の 次のターンのサイコロが −${fx.dDown}！`,{side:1-i})}
  if(fx.reroll){const nv=r6(Math.random);sd.dice.push({v:nv,used:false});E(S,'roll',`サイコロを振り直した → ${nv}`,{side:i})}
  checkKO(S);return take(S)}

function endTurn(S,i){if(S.over>=0)return take(S);const f=act(S,i);
  if(f.ch.passive.k==='regen'&&f.hp<f.max){const h=Math.min(2,f.max-f.hp);f.hp+=h;E(S,'heal',`自己修復で 体力${h}回復`,{side:i,amt:h})}
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

const API={FATIGUE,DICE,MAXD,PLAYER_HP,TOP,CHARS,HIDDEN,ALL,byId,FLOORS,floorStar,floorCount,floorHP,bossHP,floorCoins,
  condLabel,condOk,dmgLabel,fxLabel,applyLv,moveValue,autoPick,enemiesFor,newBattle,act,startTurn,diceFor,useMove,endTurn,cpuChoose,simulate,calcDmg};
G.ENGINE=API;if(typeof module!=='undefined')module.exports=API;
})(typeof window!=='undefined'?window:globalThis);

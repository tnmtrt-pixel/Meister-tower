/*
 * マイスター杯（Ver 2.3 からオンライン・自動進行）
 *
 *  流れ：運営が大会を作る → 参加者がエントリー → 開始15分前から受付（ボタンだけ・パーティ固定）
 *        → 開始時刻に自動でスイスドロー（既定3回戦）→ 上位2人で決勝 → 自動で終了・報酬と殿堂
 *  対戦はサーバーが計算して勝ち負けを決める（報告はいらない）。
 *  1回戦の制限時間：開始から12分たっても来ない人は負け（2人とも来なければ両者負け）。
 *  運営ページのボタンでも、今までどおり進められる（勝ちの付け替え・やり直し・強制終了など）。
 *
 *  参加者用  POST /api/cup/me       {id, sec}                 今の大会と自分の状況
 *            POST /api/cup/entry    {id, sec, tid, on}        エントリー／取り消し
 *            POST /api/cup/checkin  {id, sec, tid, code, party}
 *            POST /api/cup/report   {id, sec, tid, r, win}    対戦結果（両方の端末から届く）
 *            POST /api/cup/claim    {id, sec}                 報酬のコインを受け取る
 *  運営用    POST /api/cup/admin    {key, op, ...}            ADMIN_KEY が必要
 */

import { cleanParty, hexId, ENGINE_V } from './ladder.js';

const PARTICIPATION_COINS = 30;
const ROUND_MS = 12 * 60 * 1000; /* 来ない人を負けにするまで */
const HARD_MS = 30 * 60 * 1000; /* 2人とも来ているのに決着しないとき、両者負けにするまで */
const CHECKIN_BEFORE = 15 * 60 * 1000;
const NEXT_GAP = 20 * 1000; /* 全卓の結果がそろってから次の回戦までの間 */
/* 大会の開始時刻（日本時間の "2026-10-23T19:00"） */
export const cupStart = (T) => { const t = Date.parse(String(T.date || '') + ':00+09:00'); return Number.isFinite(t) ? t : 0; };
const isOnline = (T) => T.online !== false;

const rid = (n, abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789') => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => abc[x % abc.length]).join('');
};
const txt = (v, n = 60) => {
  if (v && typeof v === 'object') return { ja: String(v.ja || '').slice(0, n), zh: String(v.zh || v.ja || '').slice(0, n) };
  const s = String(v || '').slice(0, n);
  return { ja: s, zh: s };
};
/* ---------- 成績の計算 ---------- */
export function standings(T) {
  const P = {};
  for (const pid of T.order) if (T.ents[pid] && T.ents[pid].chk) P[pid] = { pid, w: 0, l: 0, bye: 0, opp: [], drop: !!T.ents[pid].drop };
  T.rounds.forEach((R) => {
    if (R.final) return;
    for (const m of R.ms) {
      if (!m.b) { if (P[m.a]) { P[m.a].w++; P[m.a].bye++; } continue; }
      if (P[m.a]) P[m.a].opp.push(m.b);
      if (P[m.b]) P[m.b].opp.push(m.a);
      if (!m.win) continue;
      if (m.win === '-') { if (P[m.a]) P[m.a].l++; if (P[m.b]) P[m.b].l++; continue; } /* 両者負け */
      const lo = m.win === m.a ? m.b : m.a;
      if (P[m.win]) P[m.win].w++;
      if (P[lo]) P[lo].l++;
    }
  });
  const list = Object.values(P);
  for (const p of list) p.bh = p.opp.reduce((s, o) => s + (P[o] ? P[o].w : 0), 0);
  const tie = (pid) => { let h = 0; for (const c of T.id + pid) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  list.sort((a, b) => b.w - a.w || b.bh - a.bh || tie(a.pid) - tie(b.pid));
  const fin = T.rounds.find((R) => R.final);
  if (fin && fin.ms[0] && fin.ms[0].win) {
    const m = fin.ms[0], lo = m.win === m.a ? m.b : m.a;
    const first = list.find((p) => p.pid === m.win), second = list.find((p) => p.pid === lo);
    const rest = list.filter((p) => p !== first && p !== second);
    return [first, second, ...rest].filter(Boolean);
  }
  return list;
}

/* ---------- スイスドローの組み合わせ ---------- */
export function pairRound(T) {
  const st = standings(T).filter((p) => !p.drop);
  let order = st.map((p) => p.pid);
  if (T.rounds.length === 0) {
    const a = new Uint32Array(order.length);
    crypto.getRandomValues(a);
    order = order.map((p, i) => [p, a[i]]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
  }
  const played = (a, b) => st.find((p) => p.pid === a).opp.includes(b);
  let bye = null;
  if (order.length % 2) {
    // 不戦勝は、まだ不戦勝になっていない一番下の人
    for (let i = order.length - 1; i >= 0; i--) {
      const p = st.find((x) => x.pid === order[i]);
      if (!p.bye) { bye = order[i]; break; }
    }
    if (!bye) bye = order[order.length - 1];
    order = order.filter((p) => p !== bye);
  }
  const solve = (rest) => {
    if (!rest.length) return [];
    const [a, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      if (played(a, others[i])) continue;
      const sub = solve(others.filter((_, k) => k !== i));
      if (sub) return [[a, others[i]], ...sub];
    }
    return null;
  };
  let pairs = solve(order);
  if (!pairs) { pairs = []; for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]); }
  const ms = pairs.map(([a, b], i) => ({ t: i + 1, a, b, room: 'K' + rid(6), rep: {}, win: null, flag: false, tk: { [a]: hexId(12), [b]: hexId(12) }, here: {} }));
  if (bye) ms.push({ t: 0, a: bye, b: null, room: '', rep: {}, win: bye, flag: false });
  return ms;
}

export const CupMixin = {
  async cupGet(tid) { return (await this.store.get('cup:' + tid)) || null; },
  async cupPut(T) { await this.store.put('cup:' + T.id, T); },
  async cupList() { return (await this.store.get('cup:list')) || []; },
  async cupUser(pid) { return (await this.store.get('cupu:' + pid)) || { coins: 0, flags: {}, hist: [], champs: 0 }; },
  async cupUserPut(pid, u) { await this.store.put('cupu:' + pid, u); },

  /* 今の大会：終わっていない最新のもの。なければ直近に終わったもの */
  async cupCurrent() {
    const list = await this.cupList();
    let done = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const T = await this.cupGet(list[i]);
      if (!T) continue;
      if (T.status !== 'done') return T;
      if (!done) done = T;
    }
    return done;
  },

  who(pid) {
    const r = this.row(pid);
    return r ? { tag: pid.slice(-4), w: JSON.parse(r.w), icon: r.icon, title: r.title } : { tag: pid.slice(-4), w: [], icon: '', title: 0 };
  },

  pub(T, admin) {
    const st = T.status === 'open' ? [] : standings(T);
    const ent = Object.keys(T.ents).filter((p) => !T.ents[p].out);
    const o = {
      id: T.id, name: T.name, sub: T.sub, date: T.date, place: T.place, cap: T.cap, status: T.status, rnum: T.rnum, online: isOnline(T), startAt: cupStart(T), checkinAt: cupStart(T) ? cupStart(T) - CHECKIN_BEFORE : 0, now: Date.now(), hardMs: HARD_MS,
      entries: ent.length, checked: ent.filter((p) => T.ents[p].chk).length,
      round: T.rounds.length, final: !!T.rounds.find((R) => R.final), start: T.rounds.length ? T.rounds[T.rounds.length - 1].start : 0, roundMs: ROUND_MS,
      stand: st.map((p, i) => ({ n: i + 1, ...this.who(p.pid), wl: [p.w, p.l], bh: p.bh, drop: p.drop })),
      rounds: T.rounds.map((R) => ({ final: !!R.final, ms: R.ms.map((m) => ({
        t: m.t, a: this.who(m.a), b: m.b ? this.who(m.b) : null, win: m.win ? (m.win === '-' ? '-' : m.win === m.a ? 'a' : 'b') : null, flag: m.flag, here: Object.keys(m.here || {}).length,
        rep: Object.keys(m.rep).length, ...(admin ? { pa: m.a, pb: m.b, room: m.room, reps: m.rep } : {}),
      })) })),
    };
    if (admin) { o.code = T.code; o.players = ent.map((p) => ({ pid: p, ...this.who(p), chk: !!T.ents[p].chk, drop: !!T.ents[p].drop })); }
    return o;
  },

  async cupRoute(path, b, json) {
    if (path === '/api/cup/admin') return this.cupAdmin(b, json);
    const a = await this.auth(b);
    if (a.err) return json({ err: a.err }, 403);
    if (!a.r) return json({ err: 'no profile' }, 404);
    const pid = b.id;
    if (path === '/api/cup/me') return this.cupMe(pid, json);
    if (path === '/api/cup/claim') {
      const u = await this.cupUser(pid);
      const c = u.coins || 0;
      u.coins = 0;
      await this.cupUserPut(pid, u);
      return json({ ok: true, coins: c, flags: u.flags });
    }
    const T = await this.cupGet(String(b.tid || ''));
    if (!T) return json({ err: 'no cup' }, 404);
    if (path === '/api/cup/entry') {
      if (!['open', 'checkin'].includes(T.status)) return json({ err: 'closed' }, 400);
      if (b.on === false) {
        if (T.ents[pid] && !T.ents[pid].chk) { delete T.ents[pid]; T.order = T.order.filter((p) => p !== pid); }
      } else if (!T.ents[pid]) {
        if (Object.keys(T.ents).length >= T.cap) return json({ err: 'full' }, 400);
        T.ents[pid] = { at: Date.now() };
        T.order.push(pid);
      }
      await this.cupPut(T);
      return this.cupMe(pid, json);
    }
    if (path === '/api/cup/checkin') {
      if (T.status !== 'checkin') return json({ err: 'not checkin' }, 400);
      if (!isOnline(T) && String(b.code || '') !== T.code) return json({ err: 'code' }, 400);
      const party = cleanParty(b.party);
      if (!party || party.some((x) => x.mv.length !== 4)) return json({ err: 'party' }, 400);
      if (!T.ents[pid]) {
        if (Object.keys(T.ents).length >= T.cap) return json({ err: 'full' }, 400);
        T.ents[pid] = { at: Date.now() };
        T.order.push(pid);
      }
      T.ents[pid].chk = true;
      T.ents[pid].party = party;
      T.ents[pid].snap = this.who(pid);
      await this.cupPut(T);
      const u = await this.cupUser(pid);
      if (!u.flags.entered) { u.flags.entered = true; await this.cupUserPut(pid, u); }
      return this.cupMe(pid, json);
    }
    if (path === '/api/cup/report') {
      if (isOnline(T)) return this.cupMe(pid, json); /* オンライン大会はサーバーが勝ち負けを決める */
      const R = T.rounds[b.r | 0];
      if (!R || T.status !== 'play') return json({ err: 'round' }, 400);
      const m = R.ms.find((x) => x.b && (x.a === pid || x.b === pid));
      if (!m || m.win) return json({ ok: true });
      const opp = m.a === pid ? m.b : m.a;
      m.rep[pid] = b.win ? pid : opp;
      const vals = Object.values(m.rep);
      if (vals.length === 2) {
        if (vals[0] === vals[1]) await this.cupDecide(T, R, m, vals[0]);
        else m.flag = true;
      }
      await this.cupPut(T);
      return this.cupMe(pid, json);
    }
    return json({ err: 'not found' }, 404);
  },

  async cupDecide(T, R, m, win) {
    if (m.win === win) { m.flag = false; return; }
    if (m.win && m.win !== '-') this.sql.exec('UPDATE u SET cupv = MAX(0, cupv - 1) WHERE id = ?', m.win); // 勝者の付け替え
    m.win = win;
    m.flag = false;
    if (win === '-') return;
    this.sql.exec('UPDATE u SET cupv = cupv + 1 WHERE id = ?', win);
    const u = await this.cupUser(win);
    if (!u.flags.win1) { u.flags.win1 = true; await this.cupUserPut(win, u); }
  },

  async cupMe(pid, json) {
    const T = await this.cupCurrent();
    const u = await this.cupUser(pid);
    const out = { cup: T ? this.pub(T) : null, rew: { coins: u.coins || 0, flags: u.flags }, hist: u.hist, hall: (await this.store.get('cuphall')) || [] };
    if (T) {
      const e = T.ents[pid];
      const me = { entered: !!e, checked: !!(e && e.chk), party: e && e.party };
      const R = T.rounds[T.rounds.length - 1];
      if (R && e && e.chk) {
        const m = R.ms.find((x) => x.a === pid || x.b === pid);
        if (m) {
          const opp = m.a === pid ? m.b : m.a;
          me.match = {
            r: T.rounds.length - 1, final: !!R.final, t: m.t, seat: m.a === pid ? 'A' : 'B', bye: !m.b,
            opp: opp ? this.who(opp) : null, oppParty: opp && T.ents[opp] ? T.ents[opp].party : null,
            room: m.win ? '' : m.room, cf: m.room ? m.room.slice(1, 5) : '', win: m.win ? (m.win === '-' ? 'none' : m.win === pid ? 'me' : 'opp') : null, flag: m.flag, rep: m.rep[pid] ? 1 : 0,
            ticket: m.win || !m.tk ? '' : m.tk[pid] || '', oppHere: !!(opp && m.here && m.here[opp]), start: R.start, deadline: R.start + ROUND_MS,
          };
        }
      }
      const st = standings(T);
      const i = st.findIndex((p) => p.pid === pid);
      if (i >= 0) me.rec = { n: i + 1, w: st[i].w, l: st[i].l };
      out.me = me;
    }
    return json(out);
  },

  /* 回戦を進める（運営のボタン・自動進行の両方から）。うまくいかない理由を文字で返す */
  async cupAdvance(T, manual) {
    const R = T.rounds[T.rounds.length - 1];
    if (T.status === 'checkin' || T.status === 'open') {
      const n = Object.values(T.ents).filter((e) => e.chk).length;
      if (n < 2) return 'need 2';
      T.status = 'play';
    } else if (T.status !== 'play') return 'status';
    if (R) {
      // 片方だけ報告がある卓はその報告で確定（教室の大会）。報告なし・食い違いは止める
      for (const m of R.ms) {
        if (m.win || !m.b) continue;
        const v = Object.values(m.rep);
        if (v.length === 1) await this.cupDecide(T, R, m, v[0]);
      }
      const left = R.ms.filter((m) => !m.win);
      if (left.length) return 'undecided:' + left.map((m) => m.t).join(',');
      if (R.final) return manual ? 'final done' : this.cupFinish(T, false);
    }
    const swissDone = T.rounds.filter((x) => !x.final).length >= T.rnum;
    if (!swissDone) {
      const NR = { start: Date.now(), ms: pairRound(T) };
      T.rounds.push(NR);
      await this.cupRooms(T, NR, T.rounds.length - 1);
    } else {
      const top = standings(T).filter((p) => !p.drop).slice(0, 2);
      if (top.length < 2) return 'need 2';
      const a = top[0].pid, b = top[1].pid;
      const NR = { final: true, start: Date.now(), ms: [{ t: 1, a, b, room: 'K' + rid(6), rep: {}, win: null, flag: false, tk: { [a]: hexId(12), [b]: hexId(12) }, here: {} }] };
      T.rounds.push(NR);
      await this.cupRooms(T, NR, T.rounds.length - 1);
      for (const p of top) { const u = await this.cupUser(p.pid); u.flags.final = true; await this.cupUserPut(p.pid, u); }
    }
    return '';
  },

  /* 対戦部屋に「だれが入るか」を登録する（サーバーが勝ち負けを計算する部屋） */
  async cupRooms(T, R, r) {
    if (!isOnline(T) || !this.env || !this.env.ROOM) return;
    for (const m of R.ms) {
      if (!m.b || m.win) continue;
      if (!m.tk) m.tk = { [m.a]: hexId(12), [m.b]: hexId(12) };
      const slot = (pid) => ({ ticket: m.tk[pid], id: pid, party: T.ents[pid].party, who: this.who(pid), lad: null });
      try {
        const stub = this.env.ROOM.get(this.env.ROOM.idFromName(m.room));
        await stub.fetch('https://int/setup', { method: 'POST', body: JSON.stringify({ kind: 'cup', tid: T.id, r, mt: m.t, slots: [slot(m.a), slot(m.b)] }) });
      } catch (e) { /* 部屋が作れなくても、運営ページから勝ちを付けられる */ }
    }
  },

  async cupFinish(T, force) {
    if (T.status === 'done') return 'done';
    const fin = T.rounds.find((x) => x.final);
    if (fin && !fin.ms[0].win) { const v = Object.values(fin.ms[0].rep); if (v.length === 1) await this.cupDecide(T, fin, fin.ms[0], v[0]); } // 決勝の報告が片方だけならそれで確定
    const champ = !!(fin && fin.ms[0].win && fin.ms[0].win !== '-');
    if (T.status === 'play' && (!fin || !fin.ms[0].win)) {
      if (!force) return 'final undecided';
    }
    const st = standings(T);
    const n = st.length;
    for (let i = 0; i < n; i++) {
      const p = st[i], u = await this.cupUser(p.pid);
      u.coins = (u.coins || 0) + PARTICIPATION_COINS;
      u.flags.entered = true;
      if (i === 0 && champ) { u.flags.champ = true; u.champs = (u.champs || 0) + 1; this.sql.exec('UPDATE u SET cupv = cupv + 1000 WHERE id = ?', p.pid); }
      u.hist = [{ tid: T.id, name: T.name, sub: T.sub, date: T.date, w: p.w, l: p.l, n: i + 1, of: n, champ: i === 0 && champ }, ...(u.hist || [])].slice(0, 20);
      await this.cupUserPut(p.pid, u);
    }
    {
      /* 大会の記録：1位・2位の構築（キャラ・★・4技・強化）。優勝が決まっていなくても残す */
      const hall = ((await this.store.get('cuphall')) || []).filter((x) => x.tid !== T.id);
      const snap = (p, i) => ({ ...(T.ents[p.pid].snap || this.who(p.pid)), ...this.who(p.pid), party: T.ents[p.pid].party, wl: [p.w, p.l], n: i + 1 });
      hall.unshift({ tid: T.id, name: T.name, sub: T.sub, date: T.date, n, champ, ev: ENGINE_V, top: st.slice(0, 2).map(snap) });
      await this.store.put('cuphall', hall.slice(0, 50));
    }
    T.status = 'done';
    return '';
  },

  /* 対戦部屋から：勝ち負けが決まった／プレイヤーが入った */
  async cupResult(b) {
    const T = await this.cupGet(String(b.tid || ''));
    if (!T || T.status !== 'play') return;
    const R = T.rounds[b.r | 0], m = R && R.ms.find((x) => x.t === (b.mt | 0));
    if (!m || m.win || ![m.a, m.b].includes(b.win)) return;
    await this.cupDecide(T, R, m, b.win);
    await this.cupPut(T);
    await this.store.setAlarm(Date.now() + 1000);
  },
  async cupPresent(b) {
    const T = await this.cupGet(String(b.tid || ''));
    if (!T) return;
    const R = T.rounds[b.r | 0], m = R && R.ms.find((x) => x.t === (b.mt | 0));
    if (!m || ![m.a, m.b].includes(b.id)) return;
    m.here = { ...(m.here || {}), [b.id]: Date.now() };
    await this.cupPut(T);
  },

  /* 自動進行（alarm から10秒ごと）。まだ進行中の大会があれば true */
  async cupTick(now = Date.now()) {
    let live = false;
    for (const tid of await this.cupList()) {
      const T = await this.cupGet(tid);
      if (!T || T.status === 'done' || !isOnline(T)) continue;
      const st = cupStart(T);
      live = true;
      let ch = false;
      if (T.status === 'open' && st && now >= st - CHECKIN_BEFORE) { T.status = 'checkin'; ch = true; }
      if (T.status === 'checkin' && st && now >= st) {
        const e = await this.cupAdvance(T, false);
        if (!e) ch = true;
      } else if (T.status === 'play') {
        const R = T.rounds[T.rounds.length - 1];
        if (R) {
          for (const m of R.ms) {
            if (m.win || !m.b) continue;
            const here = Object.keys(m.here || {});
            if (here.length < 2 && now >= R.start + ROUND_MS) { await this.cupDecide(T, R, m, here.length === 1 ? here[0] : '-'); ch = true; }
            else if (here.length === 2 && now >= R.start + HARD_MS) { await this.cupDecide(T, R, m, '-'); ch = true; }
          }
          if (R.ms.every((m) => m.win)) {
            if (!R.next) { R.next = now + NEXT_GAP; ch = true; }
            else if (now >= R.next) { const e = await this.cupAdvance(T, false); if (!e) ch = true; }
          }
        }
      }
      if (ch) await this.cupPut(T);
      if (T.status === 'done') live = live || false;
    }
    return live;
  },

  async cupAdmin(b, json) {
    const ng = await this.adminGate(b); if (ng) return json(ng.body, ng.status);
    const op = b.op;
    if (op === 'list') {
      const ids = await this.cupList();
      const out = [];
      for (const id of ids) { const T = await this.cupGet(id); if (T) out.push({ id, name: T.name, sub: T.sub, date: T.date, status: T.status }); }
      return json({ list: out, hall: (await this.store.get('cuphall')) || [] });
    }
    if (op === 'create') {
      const T = {
        id: 'c' + Date.now().toString(36), name: txt(b.name), sub: txt(b.sub), date: String(b.date || '').slice(0, 20), place: String(b.place || '').slice(0, 30),
        cap: Math.min(64, Math.max(2, b.cap | 0 || 16)), rnum: Math.min(6, Math.max(1, b.rnum | 0 || 3)), status: 'open', code: '', ents: {}, order: [], rounds: [],
        online: b.online !== false,
      };
      await this.store.setAlarm(Date.now() + 5000);
      const list = await this.cupList();
      list.push(T.id);
      await this.store.put('cup:list', list);
      await this.cupPut(T);
      return json({ ok: true, cup: this.pub(T, true) });
    }
    const T = await this.cupGet(String(b.tid || ''));
    if (!T) return json({ err: 'no cup' }, 404);
    const fail = (m) => json({ err: m, cup: this.pub(T, true) }, 400);
    const R = T.rounds[T.rounds.length - 1];
    switch (op) {
      case 'state': return json({ cup: this.pub(T, true) });
      case 'edit':
        for (const k of ['name', 'sub']) if (b[k] != null) T[k] = txt(b[k]);
        if (b.date != null) T.date = String(b.date).slice(0, 20);
        if (b.place != null) T.place = String(b.place).slice(0, 30);
        if (b.cap) T.cap = Math.min(64, Math.max(2, b.cap | 0));
        if (b.rnum) T.rnum = Math.min(6, Math.max(1, b.rnum | 0));
        break;
      case 'checkin':
        if (T.status !== 'open' && T.status !== 'checkin') return fail('status');
        T.status = 'checkin';
        T.code = String(1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000));
        break;
      case 'start': {
        const e = await this.cupAdvance(T, true);
        if (e) return fail(e);
        break;
      }
      case 'win': {
        const RR = T.rounds[b.r == null ? T.rounds.length - 1 : b.r | 0];
        const m = RR && RR.ms.find((x) => x.t === (b.t | 0));
        if (!m || !m.b) return fail('match');
        await this.cupDecide(T, RR, m, b.w === 'b' ? m.b : m.a);
        break;
      }
      case 'redo': {
        const m = R && R.ms.find((x) => x.t === (b.t | 0));
        if (!m || !m.b) return fail('match');
        if (m.win && m.win !== '-') this.sql.exec('UPDATE u SET cupv = MAX(0, cupv - 1) WHERE id = ?', m.win);
        m.win = null; m.rep = {}; m.flag = false; m.room = 'K' + rid(6); m.tk = { [m.a]: hexId(12), [m.b]: hexId(12) }; m.here = {};
        R.start = Date.now(); R.next = 0;
        await this.cupRooms(T, { ms: [m], final: R.final }, T.rounds.indexOf(R));
        break;
      }
      case 'online':
        T.online = b.on !== false;
        break;
      case 'drop':
        if (T.ents[b.pid]) T.ents[b.pid].drop = b.on !== false;
        break;
      case 'finish': {
        const e = await this.cupFinish(T, !!b.force);
        if (e) return fail(e);
        break;
      }
      case 'delete': {
        const list = (await this.cupList()).filter((x) => x !== T.id);
        await this.store.put('cup:list', list);
        await this.store.delete('cup:' + T.id);
        return json({ ok: true });
      }
      default: return fail('op');
    }
    await this.cupPut(T);
    return json({ ok: true, cup: this.pub(T, true) });
  },
};

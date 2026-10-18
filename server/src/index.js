import { CupMixin } from './cup.js';
/*
 * マイスターの塔 通信対戦サーバー（Cloudflare Workers + Durable Objects）
 *
 * しくみ：対戦の計算は両方の端末が同じ乱数（シード）で行う。
 * サーバーは「部屋」を作り、2人をつなぎ、シードと先攻を決めて、
 * お互いの行動（どの技をどの出目で使ったか／ターン終了）を中継するだけ。
 *
 * 接続先： wss://<このWorkerのURL>/ws?room=合言葉
 */

const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('meister-tower-online ok', { headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' } });
    }
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocketで接続してください', { status: 426 });
      const room = (url.searchParams.get('room') || '').toUpperCase();
      if (!ROOM_RE.test(room)) return new Response('合言葉が正しくありません', { status: 400 });
      const stub = env.ROOM.get(env.ROOM.idFromName(room));
      return stub.fetch(request);
    }
    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const stub = env.RANK.get(env.RANK.idFromName('global'));
      return stub.fetch(request);
    }
    return new Response('not found', { status: 404 });
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.players = []; // {ws, hello}
    this.started = false;
  }

  async fetch(request) {
    // 3人目以降・対戦中の部屋には入れない
    if (this.players.length >= 2 || this.started) {
      const pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({ t: 'full' }));
      pair[1].close(1000, 'full');
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    const pair = new WebSocketPair();
    const ws = pair[1];
    ws.accept();
    const me = { ws, hello: null };
    this.players.push(me);

    ws.addEventListener('message', (ev) => this.onMessage(me, ev.data));
    const bye = () => this.onClose(me);
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);

    ws.send(JSON.stringify({ t: 'joined', count: this.players.length }));
    if (this.players.length === 2) this.other(me)?.ws.send(JSON.stringify({ t: 'opponent-joined' }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  other(me) {
    return this.players.find((p) => p !== me);
  }

  send(p, obj) {
    try { p.ws.send(JSON.stringify(obj)); } catch (e) { /* 切断済み */ }
  }

  onMessage(me, raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'hello' && !this.started) {
      // パーティの中身は最低限の形だけ確認する（キャラID・★・技4つ・強化）
      if (!Array.isArray(m.party) || m.party.length < 1 || m.party.length > 3) return;
      const party = m.party.map((x) => ({
        id: String(x.id).slice(0, 20),
        star: Math.min(3, Math.max(1, x.star | 0)),
        mv: (Array.isArray(x.mv) ? x.mv : []).slice(0, 4).map((n) => n | 0),
        lv: Object.fromEntries(Object.entries(x.lv || {}).slice(0, 8).map(([k, v]) => [k | 0, Math.min(2, Math.max(0, v | 0))])),
      }));
      me.hello = { party, name: String(m.name || '').slice(0, 16) };
      const op = this.other(me);
      if (op && op.hello) this.start();
      return;
    }

    // 対戦中の行動は相手にそのまま中継する
    if (this.started && (m.t === 'act' || m.t === 'end' || m.t === 'surrender' || m.t === 'emote')) {
      const op = this.other(me);
      if (op) this.send(op, m.t === 'act' ? { t: 'act', mi: m.mi | 0, ks: (m.ks || []).slice(0, 2).map((n) => n | 0) } : { t: m.t, e: m.e });
    }
  }

  start() {
    this.started = true;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const first = crypto.getRandomValues(new Uint8Array(1))[0] % 2; // 0か1の人が先攻
    this.players.forEach((p, i) => {
      const op = this.players[1 - i];
      this.send(p, { t: 'start', seed, youFirst: first === i, me: p.hello.party, opp: op.hello.party, oppName: op.hello.name });
    });
  }

  onClose(me) {
    const i = this.players.indexOf(me);
    if (i < 0) return;
    this.players.splice(i, 1);
    const op = this.players[0];
    if (op) this.send(op, { t: 'left' });
    if (this.players.length === 0) this.started = false;
  }
}

/*
 * ランキング（Durable Object 1つ・SQLite）
 *  ニックネームは「単語番号3つ」で保存する。文字は保存しないので、悪い言葉は作れない。
 *  表示はゲーム側が単語リストから組み立てる（言語切替にも対応）。
 *
 *  POST /api/profile {id, sec, w:[a,b,c], icon, title, on}
 *  POST /api/score   {id, sec, now, floor, wins, pvp, dex}   now=今の到達階(1-20) floor=総踏破
 *  GET  /api/rank?type=inf|infw|infd&id=   inf=無限の塔トータル infw=ウィークリー infd=デイリー
 *  POST /api/score   {…, run}   run=無限の塔でクリアした階（デイリー・ウィークリー用）
 *  POST /api/rank/claim {id, sec}  デイリー・ウィークリー上位の報酬コインを受け取る
 *  POST /api/admin   {key, id, hide}   ※ Cloudflareの環境変数 ADMIN_KEY を設定したときだけ使える
 */
const ID_RE = /^[0-9a-f]{16,32}$/;
const SEC_RE = /^[0-9a-f]{32}$/;
const TYPES = { inf: 'inf', infw: 'winf', infd: 'dinf', now: 'now', floor: 'floor', cup: 'cupv', week: 'wkv', pvp: 'pvp', dex: 'dex' };
/* 期間ランキング（無限の塔）：デイリーは毎日15:00、ウィークリーは毎週月曜15:00に切り替え（日本時間） */
const PER = { infd: { col: 'dinf', key: 'dkey', last: 'dlast', fn: (t) => dayKey(t) }, infw: { col: 'winf', key: 'wkey', last: 'wlast', fn: (t) => weekKey(t) } };
const REW = { infd: [10, 6, 3], infw: [50, 30, 15] };
export const dayKey = (now = Date.now()) => Math.floor((now + (9 - 15) * 3600e3) / 86400e3);
export const weekKey = (now = Date.now()) => Math.floor((dayKey(now) + 3) / 7);
const nextReset = (type, now = Date.now()) => { const d = dayKey(now) + 1; const day = type === 'infw' ? (weekKey(now) + 1) * 7 - 3 : d; return day * 86400e3 - (9 - 15) * 3600e3; };
/* 同点のときの並び（到達階が同じなら総踏破が多い人が上） */
const SUB = { now: 'floor' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });
const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+v || 0)));
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/* 日本時間・月曜はじまりの週番号（朝5時切り替え） */
export function weekNo(now = Date.now()) {
  const day = Math.floor((now + (9 - 5) * 3600e3) / 86400e3);
  return Math.floor((day + 3) / 7);
}

export class Rank {
  constructor(state, env) {
    this.env = env;
    this.sql = state.storage.sql;
    this.store = state.storage;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS u (
      id TEXT PRIMARY KEY, sec TEXT NOT NULL, w TEXT NOT NULL DEFAULT '[]', icon TEXT NOT NULL DEFAULT '', title INTEGER NOT NULL DEFAULT 0,
      ison INTEGER NOT NULL DEFAULT 1, hidden INTEGER NOT NULL DEFAULT 0,
      floor INTEGER NOT NULL DEFAULT 0, pvp INTEGER NOT NULL DEFAULT 0, dex INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0, wk INTEGER NOT NULL DEFAULT 0, wkv INTEGER NOT NULL DEFAULT 0,
      upd INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL DEFAULT 0)`);
    try { this.sql.exec('ALTER TABLE u ADD COLUMN now INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* 追加済み */ }
    /* 大会記録：優勝回数×1000＋大会での勝利数 */
    try { this.sql.exec('ALTER TABLE u ADD COLUMN cupv INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* 追加済み */ }
    /* 無限の塔の最高到達階 */
    try { this.sql.exec('ALTER TABLE u ADD COLUMN inf INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* 追加済み */ }
    /* 無限の塔のデイリー・ウィークリー（期間の番号・その期間の最高階・その階に着いた時刻） */
    for (const c of ['dinf', 'dkey', 'dlast', 'winf', 'wkey', 'wlast']) { try { this.sql.exec(`ALTER TABLE u ADD COLUMN ${c} INTEGER NOT NULL DEFAULT 0`); } catch (e) { /* 追加済み */ } }
    /* 上位の報酬（受け取るまで残る） */
    this.sql.exec(`CREATE TABLE IF NOT EXISTS rw (id TEXT NOT NULL, kind TEXT NOT NULL, pkey INTEGER NOT NULL, rank INTEGER NOT NULL, coins INTEGER NOT NULL, got INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, kind, pkey))`);
  }

  row(id) {
    const r = this.sql.exec('SELECT * FROM u WHERE id = ?', id).toArray();
    return r[0] || null;
  }

  async auth(b) {
    if (!ID_RE.test(b.id || '') || !SEC_RE.test(b.sec || '')) return { err: 'bad id' };
    const h = await sha('mt:' + b.sec), r = this.row(b.id);
    if (r && r.sec !== h) return { err: 'auth' };
    return { r, h };
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/api/rank') { await this.settle(); return this.rank(url); }
      if (request.method === 'GET' && url.pathname === '/api/cup/pub') { const T = await this.cupCurrent(); return json({ cup: T ? this.pub(T) : null, hall: (await this.store.get('cuphall')) || [] }); }
      if (request.method !== 'POST') return json({ err: 'method' }, 405);
      const b = await request.json().catch(() => ({}));
      if (url.pathname === '/api/profile') return this.profile(b);
      if (url.pathname === '/api/score') return this.score(b);
      if (url.pathname === '/api/rank/claim') return this.claim(b);
      if (url.pathname.startsWith('/api/cup/')) return this.cupRoute(url.pathname, b, json);
      if (url.pathname === '/api/admin') return this.admin(b);
      return json({ err: 'not found' }, 404);
    } catch (e) {
      return json({ err: 'server' }, 500);
    }
  }

  async profile(b) {
    const a = await this.auth(b);
    if (a.err) return json({ err: a.err }, 403);
    const w = (Array.isArray(b.w) ? b.w : []).slice(0, 3).map((n) => int(n, 0, 999));
    if (w.length !== 3) return json({ err: 'name' }, 400);
    const icon = String(b.icon || '').replace(/[^a-z0-9]/g, '').slice(0, 16);
    const title = int(b.title, 0, 99), on = b.on === false ? 0 : 1, now = Date.now();
    if (a.r) this.sql.exec('UPDATE u SET w=?, icon=?, title=?, ison=?, upd=? WHERE id=?', JSON.stringify(w), icon, title, on, now, b.id);
    else this.sql.exec('INSERT INTO u (id, sec, w, icon, title, ison, upd, wk) VALUES (?,?,?,?,?,?,?,?)', b.id, a.h, JSON.stringify(w), icon, title, on, now, weekNo(now));
    return json({ ok: true });
  }

  async score(b) {
    const a = await this.auth(b);
    if (a.err) return json({ err: a.err }, 403);
    if (!a.r) return json({ err: 'no profile' }, 404);
    const r = a.r, now = Date.now();
    await this.settle(now);
    const run = int(b.run, 0, 9999);
    if (now - r.last < 1500 && !run) return json({ ok: true, skip: true });
    /* ありえない数字は切り捨てる */
    const nowF = Math.max(r.now || 0, int(b.now, 0, 20));
    const inf = Math.min(Math.max(r.inf || 0, int(b.inf, 0, 9999)), (r.inf || 0) + 60); /* 1回で伸ばせるのは60階まで */
    const floor = b.floor == null ? r.floor : Math.min(int(b.floor, 0, 100000), r.floor + 25); /* 総踏破は最新の値（数え方の修正で下がることがある） */
    const dex = Math.min(Math.max(r.dex, int(b.dex, 0, 99)), r.dex + 5);
    const pvp = Math.min(Math.max(r.pvp, int(b.pvp, 0, 100000)), r.pvp + 50);
    const wins = int(b.wins, 0, 1000000);
    const gain = r.last ? Math.min(Math.max(0, wins - r.wins), 300) : 0; /* 初回送信は今週分に数えない */
    const wk = weekNo(now), wkv = (r.wk === wk ? r.wkv : 0) + gain;
    this.sql.exec('UPDATE u SET inf=?, now=?, floor=?, dex=?, pvp=?, wins=?, wk=?, wkv=?, last=? WHERE id=?', inf, nowF, floor, dex, pvp, wins, wk, wkv, now, b.id);
    /* デイリー・ウィークリー：この期間にクリアした最高階（トータルの最高階より上にはならない） */
    if (run > 0) {
      const f = Math.min(run, inf);
      for (const p of Object.values(PER)) {
        const k = p.fn(now), cur = r[p.key] === k ? r[p.col] : 0;
        if (r[p.key] !== k || f > cur) this.sql.exec(`UPDATE u SET ${p.col}=?, ${p.key}=?, ${p.last}=? WHERE id=?`, Math.max(cur, f), k, f > cur ? now : r[p.last], b.id);
      }
    }
    return json({ ok: true });
  }

  rank(url) {
    const type = TYPES[url.searchParams.get('type')] ? url.searchParams.get('type') : 'floor';
    const col = TYPES[type], sub = SUB[type], wk = weekNo(), P = PER[type], tl = P ? P.last : 'last';
    const where = `ison=1 AND hidden=0 AND ${col} > 0` + (type === 'week' ? ` AND wk=${wk}` : '') + (P ? ` AND ${P.key}=${P.fn(Date.now())}` : '');
    const top = this.sql.exec(`SELECT id, w, icon, title, ${col} AS v${sub ? `, ${sub} AS s` : ''} FROM u WHERE ${where} ORDER BY ${col} DESC${sub ? `, ${sub} DESC` : ''}, ${tl} ASC LIMIT 50`).toArray()
      .map((r, i) => ({ n: i + 1, id: r.id.slice(-4), w: JSON.parse(r.w), icon: r.icon, title: r.title, v: r.v, s: r.s }));
    let me = null;
    const id = url.searchParams.get('id') || '';
    if (ID_RE.test(id)) {
      const r = this.row(id);
      if (r) {
        const v = (type === 'week' && r.wk !== wk) || (P && r[P.key] !== P.fn(Date.now())) ? 0 : r[col];
        const ok = r.ison && !r.hidden && v > 0;
        const n = !ok ? 0 : sub
          ? this.sql.exec(`SELECT COUNT(*) AS c FROM u WHERE ${where} AND (${col} > ? OR (${col} = ? AND (${sub} > ? OR (${sub} = ? AND last < ?))))`, v, v, r[sub], r[sub], r.last).toArray()[0].c + 1
          : this.sql.exec(`SELECT COUNT(*) AS c FROM u WHERE ${where} AND (${col} > ? OR (${col} = ? AND ${tl} < ?))`, v, v, r[tl]).toArray()[0].c + 1;
        me = { n, v, s: sub ? r[sub] : undefined, hidden: !!r.hidden };
      }
    }
    const total = this.sql.exec(`SELECT COUNT(*) AS c FROM u WHERE ${where}`).toArray()[0].c;
    return json({ type, top, me, total, wk, reset: P ? nextReset(type) : 0, rew: REW[type] || null });
  }

  /* 期間が切り替わったら、前の期間の1〜3位に報酬を記録する（だれかがアクセスしたときに行う） */
  async settle(now = Date.now()) {
    for (const [type, p] of Object.entries(PER)) {
      const K = p.fn(now), sk = 'set_' + type, done = await this.store.get(sk);
      if (done === undefined) { await this.store.put(sk, K); continue; }
      if (done >= K) continue;
      const prev = this.sql.exec(`SELECT MAX(${p.key}) AS k FROM u WHERE ${p.key} < ? AND ${p.col} > 0`, K).toArray()[0].k;
      if (prev != null && prev >= done) {
        const top = this.sql.exec(`SELECT id FROM u WHERE ison=1 AND hidden=0 AND ${p.key}=? AND ${p.col} > 0 ORDER BY ${p.col} DESC, ${p.last} ASC LIMIT 3`, prev).toArray();
        top.forEach((x, i) => this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', x.id, type, prev, i + 1, REW[type][i]));
      }
      await this.store.put(sk, K);
    }
  }

  async claim(b) {
    const a = await this.auth(b);
    if (a.err) return json({ err: a.err }, 403);
    if (!a.r) return json({ coins: 0, items: [] });
    await this.settle();
    const items = this.sql.exec('SELECT kind, pkey, rank, coins FROM rw WHERE id=? AND got=0 ORDER BY pkey', b.id).toArray();
    if (items.length) this.sql.exec('UPDATE rw SET got=1 WHERE id=? AND got=0', b.id);
    return json({ coins: items.reduce((t, x) => t + x.coins, 0), items });
  }

  async admin(b) {
    const key = this.env && this.env.ADMIN_KEY;
    if (!key || b.key !== key) return json({ err: 'auth' }, 403);
    if (b.list) return json({ users: this.sql.exec('SELECT id, w, icon, floor, pvp, dex, wkv, hidden FROM u ORDER BY upd DESC LIMIT 200').toArray() });
    if (!ID_RE.test(b.id || '') && !/^[0-9a-f]{4}$/.test(b.id || '')) return json({ err: 'id' }, 400);
    const hide = b.hide === false ? 0 : 1;
    const n = b.id.length === 4
      ? this.sql.exec('UPDATE u SET hidden=? WHERE substr(id, -4) = ?', hide, b.id).rowsWritten
      : this.sql.exec('UPDATE u SET hidden=? WHERE id=?', hide, b.id).rowsWritten;
    return json({ ok: true, n });
  }
}

Object.assign(Rank.prototype, CupMixin);

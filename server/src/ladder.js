/*
 * ランクバトル（Ver 2.3）
 *
 *  ランク1〜10 → マスター（ランク11として保存）。シーズンは2週間（月曜15:00 切り替え・日本時間）
 *  ・勝つと★+1。3連勝目からは★+2。★が決まった数たまると次のランクへ
 *  ・ランク1〜4は負けても★は減らない。ランク5から負けると★−1（★0で負けるとランクが1つ下がる。ただしランク5・8より下には下がらない）
 *  ・マスターはレート（1500から）。同じくらいの相手で ±16
 *  ・ゴースト戦（相手がいないとき、だれかのパーティをCPUが動かす）：勝ち★+1（連勝ボーナスなし）、負けても★は減らない。マスターは半分
 *  ・新しいシーズンは「前のシーズンのランク−3」から（マスターはランク8から）。最高ランクに応じてコイン
 *
 *  POST /api/lad/me   {id, sec}         自分のランク（シーズンが変わっていれば切り替える）
 *  GET  /api/rank?type=lad&id=          今シーズンの順位
 *  WS   /mm                             マッチング（{t:'q', id, sec, v, party} を送ると、相手が見つかったら {t:'match', room, ticket, ...}）
 */

export const ENGINE_V = 10; /* ゲーム側の hello の v と同じにする（技やルールが変わったら両方上げる） */
export const MASTER = 11;
export const SEASON_MS = 14 * 86400e3;
/* シーズン1の始まり：2026-10-19（月）15:00 日本時間 */
export const SEASON0 = Date.UTC(2026, 9, 19, 6, 0, 0);
export const seasonNo = (now = Date.now()) => Math.max(1, Math.floor((now - SEASON0) / SEASON_MS) + 1);
export const seasonEnd = (s) => SEASON0 + s * SEASON_MS;
export const need = (rank) => (rank <= 3 ? 3 : rank <= 6 ? 4 : 5);
const floorOf = (rank) => (rank >= 8 ? 8 : rank >= 5 ? 5 : 1);
export const seasonCoins = (best) => (best >= MASTER ? 80 : best * 5);
/* マッチングの近さ（ランク×10＋★。マスターはレートで） */
export const score = (r) => (r.rank >= MASTER ? 110 + Math.round((r.rate - 1500) / 10) : r.rank * 10 + r.stars);
/* マスターでない相手のレートの見積もり */
const estRate = (r) => (r.rank >= MASTER ? r.rate : 1250 + r.rank * 20 + r.stars * 4);

/* 1試合の結果を当てはめる。r は {rank, stars, streak, rate, best, games, wins} */
export function applyResult(r0, win, opp, ghost) {
  const r = { ...r0 };
  r.games = (r.games || 0) + 1;
  if (win) r.wins = (r.wins || 0) + 1;
  if (r.rank >= MASTER) {
    const ex = 1 / (1 + Math.pow(10, (estRate(opp || { rank: MASTER, rate: 1500 }) - r.rate) / 400));
    let d = Math.round(32 * ((win ? 1 : 0) - ex));
    if (ghost) d = Math.round(d / 2);
    r.rate = Math.max(1000, r.rate + d);
    r.streak = win ? (r.streak || 0) + 1 : 0;
    r.delta = d;
    return r;
  }
  if (win) {
    if (!ghost) r.streak = (r.streak || 0) + 1;
    const gain = !ghost && r.streak >= 3 ? 2 : 1;
    r.stars += gain;
    r.gain = gain;
    while (r.rank < MASTER && r.stars >= need(r.rank)) {
      r.stars -= need(r.rank);
      r.rank++;
      r.up = true;
    }
    if (r.rank >= MASTER) { r.rank = MASTER; r.stars = 0; r.rate = 1500; }
  } else {
    r.streak = 0;
    r.gain = 0;
    if (!ghost && r.rank >= 5) {
      if (r.stars > 0) { r.stars--; r.gain = -1; }
      else if (r.rank > floorOf(r.rank)) { r.rank--; r.stars = need(r.rank) - 1; r.gain = -1; r.down = true; }
    }
  }
  r.best = Math.max(r.best || 1, r.rank);
  return r;
}

/* シーズンが変わったときの新しいランク */
export const nextSeasonRank = (rank) => (rank >= MASTER ? 8 : Math.max(1, rank - 3));

const rid = (n, abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789') => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => abc[x % abc.length]).join('');
};
export const hexId = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');
export { rid };

/* パーティの形を整える（キャラID・★・技4つ・強化）。強化は技9つ分＋余裕 */
export function cleanParty(p) {
  if (!Array.isArray(p) || p.length < 1 || p.length > 3) return null;
  const E = globalThis.ENGINE;
  const out = p.map((x) => {
    const id = String((x && x.id) || '').replace(/[^a-z0-9]/g, '').slice(0, 16), star = Math.min(3, Math.max(1, (x && x.star) | 0));
    let mv = (Array.isArray(x && x.mv) ? x.mv : []).slice(0, 4).map((n) => n | 0);
    const lv = Object.fromEntries(Object.entries((x && x.lv) || {}).slice(0, 20).map(([k, v]) => [k | 0, Math.min(2, Math.max(0, v | 0))]));
    /* エンジンで確かめる：いないキャラ・ない技・★が足りない技・同じ技の重なりは外す（あとで技4つかを確認） */
    const ch = E && E.byId(id);
    if (E) { if (!ch) return null; mv = mv.filter((k, i) => ch.moves[k] && ch.moves[k].t <= star && mv.indexOf(k) === i); }
    return { id, star, mv, lv };
  });
  return out.some((x) => !x) ? null : out;
}

const GHOST_MS = 30000; /* この時間だれとも当たらなければゴースト戦 */

export const LadderMixin = {
  ladInit() {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS lad (
      id TEXT PRIMARY KEY, season INTEGER NOT NULL, rank INTEGER NOT NULL DEFAULT 1, stars INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0, rate INTEGER NOT NULL DEFAULT 1500, best INTEGER NOT NULL DEFAULT 1,
      games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, gparty TEXT NOT NULL DEFAULT '', last INTEGER NOT NULL DEFAULT 0)`);
    this.queue = [];
    this.mmTimer = null;
  },

  /* 自分のランク。シーズンが変わっていたら、報酬を記録して新しいシーズンへ */
  ladRow(id, now = Date.now()) {
    const s = seasonNo(now);
    let r = this.sql.exec('SELECT * FROM lad WHERE id = ?', id).toArray()[0];
    if (!r) {
      this.sql.exec('INSERT INTO lad (id, season) VALUES (?, ?)', id, s);
      return this.sql.exec('SELECT * FROM lad WHERE id = ?', id).toArray()[0];
    }
    if (r.season < s) {
      if (r.games > 0) this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', id, 'lad', r.season, r.best, seasonCoins(r.best));
      const nr = r.season === s - 1 ? nextSeasonRank(r.rank) : 1;
      this.sql.exec('UPDATE lad SET season=?, rank=?, stars=0, streak=0, rate=1500, best=?, games=0, wins=0 WHERE id=?', s, nr, nr, id);
      r = this.sql.exec('SELECT * FROM lad WHERE id = ?', id).toArray()[0];
    }
    return r;
  },
  ladPub(r) {
    return { season: r.season, end: seasonEnd(r.season), rank: r.rank, stars: r.stars, need: r.rank >= MASTER ? 0 : need(r.rank), streak: r.streak, rate: r.rate, best: r.best, games: r.games, wins: r.wins };
  },
  async ladMe(b, json) {
    const a = await this.auth(b);
    if (a.err) return json({ err: a.err }, 403);
    if (!a.r) return json({ err: 'no profile' }, 404);
    return json({ ok: true, me: this.ladPub(this.ladRow(b.id)), v: ENGINE_V });
  },
  ladRank(url, json) {
    const s = seasonNo();
    const ord = 'l.rank DESC, CASE WHEN l.rank >= 11 THEN l.rate ELSE l.stars END DESC, l.last ASC';
    const where = 'l.season = ? AND l.games > 0 AND u.ison = 1 AND u.hidden = 0';
    const top = this.sql.exec(`SELECT l.id, l.rank, l.stars, l.rate, u.w, u.icon, u.title FROM lad l JOIN u ON u.id = l.id WHERE ${where} ORDER BY ${ord} LIMIT 50`, s).toArray()
      .map((r, i) => ({ n: i + 1, id: r.id.slice(-4), w: JSON.parse(r.w), icon: r.icon, title: r.title, rank: r.rank, stars: r.stars, rate: r.rate }));
    let me = null;
    const id = url.searchParams.get('id') || '';
    if (/^[0-9a-f]{16,32}$/.test(id)) {
      const r = this.sql.exec('SELECT l.*, u.ison, u.hidden FROM lad l JOIN u ON u.id = l.id WHERE l.id = ?', id).toArray()[0];
      if (r && r.season === s && r.games > 0 && r.ison && !r.hidden) {
        const v = score(r);
        const n = this.sql.exec(`SELECT COUNT(*) AS c FROM lad l JOIN u ON u.id = l.id WHERE ${where} AND (l.rank > ? OR (l.rank = ? AND (CASE WHEN l.rank >= 11 THEN l.rate ELSE l.stars END > ? OR (CASE WHEN l.rank >= 11 THEN l.rate ELSE l.stars END = ? AND l.last < ?))))`,
          s, r.rank, r.rank, r.rank >= MASTER ? r.rate : r.stars, r.rank >= MASTER ? r.rate : r.stars, r.last).toArray()[0].c + 1;
        me = { n, rank: r.rank, stars: r.stars, rate: r.rate, v };
      }
    }
    const total = this.sql.exec(`SELECT COUNT(*) AS c FROM lad l JOIN u ON u.id = l.id WHERE ${where}`, s).toArray()[0].c;
    return json({ type: 'lad', season: s, end: seasonEnd(s), top, me, total });
  },

  /* ---------- マッチング（WebSocket） ---------- */
  mmAccept() {
    const pair = new WebSocketPair();
    const ws = pair[1];
    ws.accept();
    const ent = { ws, id: null };
    ws.addEventListener('message', (ev) => this.mmMsg(ent, ev.data).catch(() => {}));
    const bye = () => { this.queue = this.queue.filter((x) => x !== ent); };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: pair[0] });
  },
  mmSend(ent, o) { try { ent.ws.send(JSON.stringify(o)); } catch (e) { /* 切断済み */ } },
  async mmMsg(ent, raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || m.t !== 'q' || ent.id) return;
    if ((m.v | 0) !== ENGINE_V) { this.mmSend(ent, { t: 'ver' }); try { ent.ws.close(1000, 'ver'); } catch (e) { /* */ } return; }
    const a = await this.auth(m);
    if (a.err || !a.r) { this.mmSend(ent, { t: 'err', e: 'auth' }); try { ent.ws.close(1000, 'auth'); } catch (e) { /* */ } return; }
    const party = cleanParty(m.party);
    if (!party || party.some((x) => x.mv.length !== 4)) { this.mmSend(ent, { t: 'err', e: 'party' }); return; }
    const r = this.ladRow(m.id);
    this.sql.exec('UPDATE lad SET gparty = ? WHERE id = ?', JSON.stringify({ v: ENGINE_V, p: party }), m.id);
    /* 同じ人が2つの画面から並んだら、古い方を外す */
    for (const x of this.queue.filter((x) => x.id === m.id)) { this.mmSend(x, { t: 'dup' }); try { x.ws.close(1000, 'dup'); } catch (e) { /* */ } }
    this.queue = this.queue.filter((x) => x.id !== m.id);
    Object.assign(ent, { id: m.id, party, sc: score(r), lad: r, t0: Date.now(), who: this.who(m.id) });
    this.queue.push(ent);
    this.mmSend(ent, { t: 'wait', ghostMs: GHOST_MS });
    this.mmKick();
  },
  mmKick() {
    if (this.mmTimer) return;
    this.mmTimer = setInterval(() => {
      if (!this.queue.length) { clearInterval(this.mmTimer); this.mmTimer = null; return; }
      this.mmStep().catch(() => {});
    }, 1000);
    this.mmStep().catch(() => {});
  },
  async mmStep() {
    if (this.mmBusy) return;
    this.mmBusy = true;
    try {
      const now = Date.now();
      const win = (e) => 12 + 10 * Math.floor((now - e.t0) / 5000);
      const q = this.queue.slice().sort((x, y) => x.t0 - y.t0);
      const used = new Set();
      for (const a of q) {
        if (used.has(a)) continue;
        let best = null, bd = 1e9;
        for (const b of q) {
          if (b === a || used.has(b) || b.id === a.id) continue;
          const d = Math.abs(a.sc - b.sc);
          if (d <= Math.max(win(a), win(b)) && d < bd) { best = b; bd = d; }
        }
        if (best) {
          used.add(a); used.add(best);
          this.queue = this.queue.filter((x) => x !== a && x !== best);
          await this.mmMake(a, best);
        } else if (now - a.t0 >= GHOST_MS) {
          used.add(a);
          this.queue = this.queue.filter((x) => x !== a);
          await this.mmMake(a, null);
        }
      }
    } finally { this.mmBusy = false; }
  },
  /* ゴーストの相手：近いランクの人の、最後に使ったパーティ。いなければCPUのパーティ */
  ghostFor(a) {
    const s = seasonNo();
    const rows = this.sql.exec("SELECT l.id, l.rank, l.stars, l.rate, l.gparty FROM lad l JOIN u ON u.id = l.id WHERE l.season = ? AND l.id != ? AND l.gparty != '' AND u.hidden = 0 ORDER BY ABS((CASE WHEN l.rank >= 11 THEN 110 + (l.rate - 1500) / 10 ELSE l.rank * 10 + l.stars END) - ?) LIMIT 8", s, a.id, a.sc).toArray();
    /* 今のバージョンで記録されたパーティだけ使う（技の番号が変わるため） */
    const ok = rows.map((r) => { try { const g = JSON.parse(r.gparty); return g && g.v === ENGINE_V && Array.isArray(g.p) ? { party: g.p, who: this.who(r.id), lad: r } : null; } catch (e) { return null; } }).filter(Boolean);
    if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
    const E = globalThis.ENGINE, pool = E.CHARS.map((c) => c.id), out = [];
    const lv = Math.min(2, Math.floor(a.lad.rank / 4)), st = Math.min(3, 1 + Math.floor(a.lad.rank / 3));
    while (out.length < 3) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      if (out.some((x) => x.id === id)) continue;
      const ch = E.byId(id), lvm = {};
      ch.moves.forEach((m, k) => { lvm[k] = lv; });
      out.push({ id, star: st, mv: E.autoPick(ch, st, 0, Math.random, lvm), lv: lvm });
    }
    return { party: out, who: { tag: 'CPU', w: [], icon: out[0].id, title: 0, cpu: true }, lad: { rank: a.lad.rank, stars: 0, rate: 1500 } };
  },
  async mmMake(a, b) {
    const code = 'B' + rid(7);
    const ghost = !b ? this.ghostFor(a) : null;
    const slots = [
      { ticket: hexId(12), id: a.id, party: a.party, who: a.who, lad: { rank: a.lad.rank, stars: a.lad.stars, rate: a.lad.rate } },
      b ? { ticket: hexId(12), id: b.id, party: b.party, who: b.who, lad: { rank: b.lad.rank, stars: b.lad.stars, rate: b.lad.rate } }
        : { bot: true, id: null, party: ghost.party, who: ghost.who, lad: { rank: ghost.lad.rank, stars: ghost.lad.stars, rate: ghost.lad.rate } },
    ];
    const stub = this.env.ROOM.get(this.env.ROOM.idFromName(code));
    const r = await stub.fetch('https://int/setup', { method: 'POST', body: JSON.stringify({ kind: 'rank', ghost: !b, slots }) });
    if (!r.ok) { for (const e of [a, b]) if (e) this.mmSend(e, { t: 'err', e: 'room' }); return; }
    const tell = (e, me, op) => this.mmSend(e, { t: 'match', room: code, ticket: me.ticket, ghost: !b, opp: op.who, oppParty: op.party, oppLad: op.lad });
    tell(a, slots[0], slots[1]);
    if (b) tell(b, slots[1], slots[0]);
  },

  /* Room から届く試合結果（外からは呼べない） */
  async ladResult(b) {
    const out = {};
    const rows = {};
    for (const id of b.ids) if (id) rows[id] = this.ladRow(id);
    for (const id of b.ids) {
      if (!id) continue;
      const opId = b.ids.find((x) => x !== id);
      const opp = opId ? rows[opId] : (b.ghostLad || { rank: rows[id].rank, stars: 0, rate: 1500 });
      const nr = applyResult(rows[id], b.win === id, opp, !!b.ghost);
      this.sql.exec('UPDATE lad SET rank=?, stars=?, streak=?, rate=?, best=?, games=?, wins=?, last=? WHERE id=?', nr.rank, nr.stars, nr.streak, nr.rate, nr.best, nr.games, nr.wins, Date.now(), id);
      out[id] = { before: this.ladPub(rows[id]), after: this.ladPub(nr), gain: nr.gain || 0, delta: nr.delta || 0, up: !!nr.up, down: !!nr.down };
    }
    return out;
  },
};

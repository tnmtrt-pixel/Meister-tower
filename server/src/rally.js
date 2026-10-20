/*
 * 集合タイム（ランクバトルに人が集まる時間）
 *  運営ページで時間を決める（予告つき）。集合タイム中は、人との対戦で報酬が出る。ゴースト戦までの待ち時間は 20秒 → 40秒。
 *  報酬（人との対戦のみ・負けてももらえる）：1戦ごとに3コインと「選べるかけら」2個、勝ったらさらに+5コイン。
 *  1回の集合タイムで報酬が出るのは10戦まで。同じ相手は2戦まで（談合よけ）。
 *  上位ボーナス：報酬の出た対戦で 勝ち3点・負け1点。3戦以上した人のうち上位3人に、終わったあとボーナス（同点は勝ち数→先に達した人）。
 *  受け取り：ランキングの報酬と同じ /api/rank/claim（kind 'rally' はコイン、'rshard' は選べるかけらの数）
 *
 *  GET  /api/rally                         今と次の集合タイム、マッチング待ちの人数
 *  POST /api/admin {key, rally:'add', start, min, label} / {key, rally:'del', id} / {key, rally:'list'} / {key, rally:'daily', hours:[8,12,16,20], min, label}
 */
export const RALLY = { per: 3, win: 5, shards: 2, max: 10, sameOpp: 2, pW: 3, pL: 1, minG: 3, top: [{ c: 50, s: 10 }, { c: 30, s: 6 }, { c: 20, s: 4 }] };
export const GHOST_MS = 20000, GHOST_RALLY_MS = 40000;
/* 毎日の集合タイム（日本時間）。運営ページで変えられる（storage 'rallyDaily'）。1回だけ休むときは運営ページで消す（'rallySkip' に記録して作り直さない） */
export const DAILY0 = { hours: [8, 12, 16, 20], min: 30, label: '' };
const H9 = 9 * 3600e3, DAY = 86400e3;

export const RallyMixin = {
  rallyInit() {
    this.sql.exec('CREATE TABLE IF NOT EXISTS rally_u (rid TEXT NOT NULL, id TEXT NOT NULL, games INTEGER NOT NULL DEFAULT 0, opp TEXT NOT NULL DEFAULT \'{}\', pts INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, upd INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (rid, id))');
  },
  async rallyLoad() {
    if (!this.rallies) this.rallies = (await this.store.get('rallies')) || [];
    await this.rallyGen();
    await this.rallySettle();
    return this.rallies;
  },
  async rallyDaily() {
    if (!this.rDaily) this.rDaily = (await this.store.get('rallyDaily')) || DAILY0;
    return this.rDaily;
  },
  /* 今日と明日の「毎日の集合タイム」を用意する */
  async rallyGen(now = Date.now()) {
    const D = await this.rallyDaily();
    if (!this.rSkip) this.rSkip = (await this.store.get('rallySkip')) || [];
    const day0 = Math.floor((now + H9) / DAY) * DAY - H9;
    let ch = false;
    for (let d = 0; d < 2; d++) for (const h of D.hours || []) {
      const start = day0 + d * DAY + h * 3600e3, id = 'd' + start.toString(36);
      if (start + D.min * 60000 <= now || this.rSkip.includes(id) || this.rallies.some((r) => r.id === id)) continue;
      this.rallies.push({ id, start, min: D.min, label: D.label || '', daily: 1 });
      ch = true;
    }
    if (ch) await this.rallySave();
  },
  /* 集合タイムの順位（3戦以上・見えない人は除く） */
  rallyBoard(rid, n = 5) {
    return this.sql.exec(`SELECT r.id, r.pts, r.wins, r.games, u.w, u.icon, u.title FROM rally_u r JOIN u ON u.id = r.id WHERE r.rid = ? AND r.games >= ? AND u.hidden = 0 ORDER BY r.pts DESC, r.wins DESC, r.upd ASC LIMIT ?`, rid, RALLY.minG, n).toArray()
      .map((r, i) => ({ n: i + 1, id: r.id, w: JSON.parse(r.w || '[]'), icon: r.icon, title: r.title, pts: r.pts, wins: r.wins, games: r.games }));
  },
  rallyMine(rid, id) {
    if (!id) return null;
    const r = this.sql.exec('SELECT pts, wins, games FROM rally_u WHERE rid = ? AND id = ?', rid, id).toArray()[0];
    return r || null;
  },
  /* 終わった集合タイムの上位ボーナスを1回だけ記録 */
  async rallySettle() {
    const now = Date.now();
    let ch = false;
    for (const r of this.rallies) {
      if (r.done || now < r.start + r.min * 60000) continue;
      const top = this.rallyBoard(r.id, RALLY.top.length);
      top.forEach((x, i) => {
        const T = RALLY.top[i];
        this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', x.id, 'rtop', r.start, i + 1, T.c);
        this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', x.id, 'rshard', -r.start, i + 1, T.s);
      });
      r.done = 1;
      r.res = top.map((x) => ({ n: x.n, w: x.w, icon: x.icon, title: x.title, pts: x.pts, wins: x.wins, games: x.games }));
      ch = true;
    }
    if (ch) await this.rallySave();
  },
  async rallySave() {
    const now = Date.now();
    this.rallies = this.rallies.filter((r) => r.start + r.min * 60000 > now - 7 * 86400e3).sort((a, b) => a.start - b.start).slice(0, 60);
    await this.store.put('rallies', this.rallies);
  },
  rallyNow(now = Date.now()) {
    return (this.rallies || []).find((r) => now >= r.start && now < r.start + r.min * 60000) || null;
  },
  ghostMs() { return this.rallyNow() ? GHOST_RALLY_MS : GHOST_MS; },
  rallyPub(r) { return r ? { id: r.id, start: r.start, end: r.start + r.min * 60000, label: r.label || '' } : null; },
  async rallyGet(json, url) {
    await this.rallyLoad();
    const now = Date.now();
    const next = this.rallies.filter((r) => r.start > now).slice(0, 3).map((r) => this.rallyPub(r));
    const C = this.rallyNow(now), id = url ? url.searchParams.get('id') || '' : '';
    const hide = (a) => a.map((x) => ({ ...x, id: undefined, me: x.id === id || undefined }));
    const cur = C ? { ...this.rallyPub(C), board: hide(this.rallyBoard(C.id)), mine: /^[0-9a-f]{16,32}$/.test(id) ? this.rallyMine(C.id, id) : null } : null;
    const L = this.rallies.filter((r) => r.done && r.res && r.res.length).pop();
    const last = L && now - (L.start + L.min * 60000) < 86400e3 ? { ...this.rallyPub(L), res: L.res } : null;
    return json({ now, cur, next, last, queue: (this.queue || []).length, rew: RALLY });
  },
  async rallyAdmin(b, json) {
    await this.rallyLoad();
    if (b.rally === 'add') {
      const start = Math.floor(+b.start || 0), min = Math.min(240, Math.max(5, b.min | 0 || 30));
      if (!start) return json({ err: 'start' }, 400);
      this.rallies.push({ id: 'r' + start.toString(36), start, min, label: String(b.label || '').slice(0, 40) });
      await this.rallySave();
    } else if (b.rally === 'del') {
      if (String(b.id).startsWith('d')) { this.rSkip = [...(this.rSkip || []), b.id].slice(-60); await this.store.put('rallySkip', this.rSkip); }
      this.rallies = this.rallies.filter((r) => r.id !== b.id);
      await this.rallySave();
    } else if (b.rally === 'daily') {
      /* 毎日の時間を変える：まだ始まっていない毎日分を消して作り直す */
      const hours = [...new Set((Array.isArray(b.hours) ? b.hours : []).map((x) => Math.floor(+x)).filter((x) => x >= 0 && x <= 23))].sort((x, y) => x - y).slice(0, 8);
      this.rDaily = { hours, min: Math.min(240, Math.max(5, b.min | 0 || 30)), label: String(b.label || '').slice(0, 40) };
      await this.store.put('rallyDaily', this.rDaily);
      const now = Date.now();
      this.rallies = this.rallies.filter((r) => !(r.daily && r.start > now));
      await this.rallyGen();
    }
    return json({ ok: true, daily: await this.rallyDaily(), list: this.rallies.map((r) => ({ ...this.rallyPub(r), daily: r.daily || 0 })) });
  },
  /* ランクバトルの結果ごとに、集合タイムの報酬を記録（人との対戦だけ） */
  rallyReward(ids, win, ghost) {
    const R = this.rallyNow();
    const out = {};
    if (!R || ghost) return out;
    for (const id of ids) {
      if (!id) continue;
      const opp = ids.find((x) => x !== id);
      const row = this.sql.exec('SELECT games, opp FROM rally_u WHERE rid = ? AND id = ?', R.id, id).toArray()[0] || { games: 0, opp: '{}' };
      let om = {};
      try { om = JSON.parse(row.opp) || {}; } catch (e) { om = {}; }
      if (row.games >= RALLY.max || (om[opp] || 0) >= RALLY.sameOpp) { out[id] = { coins: 0, shards: 0, games: row.games, capped: true }; continue; }
      om[opp] = (om[opp] || 0) + 1;
      const games = row.games + 1, won = win === id;
      const coins = RALLY.per + (won ? RALLY.win : 0), shards = RALLY.shards;
      this.sql.exec('INSERT INTO rally_u (rid, id, games, opp, pts, wins, upd) VALUES (?,?,?,?,?,?,?) ON CONFLICT(rid, id) DO UPDATE SET games = excluded.games, opp = excluded.opp, pts = pts + excluded.pts, wins = wins + excluded.wins, upd = excluded.upd',
        R.id, id, games, JSON.stringify(om), won ? RALLY.pW : RALLY.pL, won ? 1 : 0, Date.now());
      const key = Date.now() * 10 + games % 10;
      this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', id, 'rally', key, games, coins);
      if (shards) this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', id, 'rshard', key, games, shards);
      const me = this.rallyMine(R.id, id);
      out[id] = { coins, shards, games, max: RALLY.max, pts: me ? me.pts : 0 };
    }
    return out;
  },
};

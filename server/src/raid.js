/*
 * レイドバトル（Ver 2.6）：伝説のボス「紫翼皇」の体力を、みんなで1日かけて削る
 *  ・1日1体（毎日 朝5時に入れかわる・日本時間）。1人1日3回まで。1回の挑戦はパーティ全員が倒れるまで
 *  ・対戦はランクバトルと同じ「サーバーが計算する部屋」で行う（ボスはサーバーのCPUが動かす）。ダメージはサーバーが決める
 *  ・ボスの体力は、前の日の挑戦回数から自動で決める（人数が少なくても倒せるように）
 *  ・集合タイム中はダメージ +50%
 *  ・ごほうび：挑戦ごとにコイン（ダメージに応じて）／その日が終わるか倒したときに、参加者全員へ「選べるかけら」（削った段階に応じて）
 *    ＋倒したらコイン／ダメージ上位3人にボーナス
 *
 *  GET  /api/raid?id=              今日のレイドの様子
 *  POST /api/raid/start {id, sec, party}   挑戦を始める（部屋とチケットを返す）
 */
import { cleanParty, hexId, rid, ENGINE_V } from './ladder.js';

export const RAID = {
  boss: 'origin', elv: 3, bonus: 3, tries: 3, maxRound: 99,
  avg: 140, k: 0.7, hp0: 2000, hpMin: 1500, hpMax: 60000, /* 体力 = 前の日の挑戦回数 × 1回の平均ダメージ × k */
  rally: 1.5,
  coin: (d) => Math.min(12, 2 + Math.floor(d / 25)), /* 1回の挑戦のコイン */
  feather: 1, killFeather: 2, featherNeed: 10,
  stage: [0.75, 0.5, 0.25], stageShard: 1, killShard: 3, killCoin: 10, top: [30, 20, 10],
};
const DAY = 86400e3;
export const raidDayNo = (now = Date.now()) => Math.floor((now + (9 - 5) * 3600e3) / DAY); /* 日本時間の朝5時で切り替え */
export const raidDayEnd = (d) => (d + 1) * DAY - (9 - 5) * 3600e3;

export const RaidMixin = {
  raidInit() {
    this.sql.exec('CREATE TABLE IF NOT EXISTS raid_d (day INTEGER PRIMARY KEY, max INTEGER NOT NULL, hp INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, killed INTEGER NOT NULL DEFAULT 0, killer TEXT NOT NULL DEFAULT \'\', done INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS raid_u (day INTEGER NOT NULL, id TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, dmg INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, id))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS raid_log (t INTEGER NOT NULL, day INTEGER NOT NULL, id TEXT NOT NULL, dmg INTEGER NOT NULL, kill INTEGER NOT NULL DEFAULT 0)');
  },
  /* 運営：今日の体力を増やす・減らす（{raid:'hp', add:1000}）。倒した後や今日のレイドがないときは変えない */
  raidAdmin(b, json) {
    const r = this.raidToday();
    if (b.raid === 'hp') {
      const add = Math.round(+b.add || 0);
      if (!r.killed && add) {
        const max = Math.max(1, r.max + add), hp = Math.max(1, Math.min(max, r.hp + add));
        this.sql.exec('UPDATE raid_d SET max = ?, hp = ? WHERE day = ?', max, hp, r.day);
      }
    }
    const t = this.raidToday();
    return json({ ok: true, day: t.day, max: t.max, hp: t.hp, killed: t.killed, tries: t.tries });
  },
  /* 今日のレイド。なければ作る。終わった日はここで締める */
  raidToday(now = Date.now()) {
    const d = raidDayNo(now);
    let r = this.sql.exec('SELECT * FROM raid_d WHERE day = ?', d).toArray()[0];
    if (!r) {
      const prev = this.sql.exec('SELECT tries FROM raid_d WHERE day < ? ORDER BY day DESC LIMIT 1', d).toArray()[0];
      const max = prev ? Math.min(RAID.hpMax, Math.max(RAID.hpMin, Math.round(prev.tries * RAID.avg * RAID.k))) : RAID.hp0;
      this.sql.exec('INSERT OR IGNORE INTO raid_d (day, max, hp) VALUES (?,?,?)', d, max, max);
      r = this.sql.exec('SELECT * FROM raid_d WHERE day = ?', d).toArray()[0];
    }
    for (const o of this.sql.exec('SELECT day FROM raid_d WHERE day < ? AND done = 0', d).toArray()) this.raidSettle(o.day);
    return r;
  },
  /* その日のごほうびを1回だけ記録（倒したとき、または日が変わったとき） */
  raidSettle(day) {
    const r = this.sql.exec('SELECT * FROM raid_d WHERE day = ?', day).toArray()[0];
    if (!r || r.done) return;
    this.sql.exec('UPDATE raid_d SET done = 1 WHERE day = ?', day);
    const rate = r.hp / r.max, st = RAID.stage.filter((x) => rate <= x).length + (r.killed ? 1 : 0); /* 0〜4 */
    const shards = Math.min(3, st) * RAID.stageShard + (r.killed ? RAID.killShard : 0), coins = r.killed ? RAID.killCoin : 0;
    const us = this.sql.exec('SELECT id, dmg FROM raid_u WHERE day = ? AND tries > 0 ORDER BY dmg DESC, last ASC', day).toArray();
    us.forEach((u, i) => {
      const top = i < RAID.top.length ? RAID.top[i] : 0;
      if (coins + top > 0 || shards > 0) this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', u.id, 'raidday', day, (st << 4) | (i < RAID.top.length ? i + 1 : 0), coins + top);
      if (shards) this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', u.id, 'rshard', -(day * 10 + 1), st, shards);
      if (r.killed) this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', u.id, 'rfeather', day * 10 + 1, 1, RAID.killFeather);
    });
  },
  raidPub(r, id, n = 5) {
    const top = this.sql.exec('SELECT r.id, r.dmg, r.tries, u.w, u.icon, u.title FROM raid_u r JOIN u ON u.id = r.id WHERE r.day = ? AND r.tries > 0 AND u.hidden = 0 ORDER BY r.dmg DESC, r.last ASC LIMIT ?', r.day, n).toArray()
      .map((x, i) => ({ n: i + 1, w: JSON.parse(x.w || '[]'), icon: x.icon, title: x.title, dmg: x.dmg, me: x.id === id || undefined }));
    const log = this.sql.exec('SELECT l.t, l.dmg, l.kill, u.w FROM raid_log l JOIN u ON u.id = l.id WHERE l.day = ? AND u.hidden = 0 ORDER BY l.t DESC LIMIT 8', r.day).toArray()
      .map((x) => ({ t: x.t, dmg: x.dmg, kill: x.kill || undefined, w: JSON.parse(x.w || '[]') }));
    const me = id ? this.sql.exec('SELECT tries, dmg, best FROM raid_u WHERE day = ? AND id = ?', r.day, id).toArray()[0] || { tries: 0, dmg: 0, best: 0 } : null;
    /* 自分の順位（ダメージが自分より多い人の数＋1） */
    const myRank = me && me.tries > 0 ? this.sql.exec('SELECT COUNT(*) AS n FROM raid_u WHERE day = ? AND tries > 0 AND (dmg > ? OR (dmg = ? AND last < (SELECT last FROM raid_u WHERE day = ? AND id = ?)))', r.day, me.dmg, me.dmg, r.day, id).toArray()[0].n + 1 : 0;
    const people = this.sql.exec('SELECT COUNT(*) AS n FROM raid_u WHERE day = ? AND tries > 0', r.day).toArray()[0].n;
    const killer = r.killer ? this.sql.exec('SELECT w FROM u WHERE id = ?', r.killer).toArray()[0] : null;
    return { day: r.day, boss: RAID.boss, max: r.max, hp: r.hp, tries: r.tries, people, killed: r.killed || 0, killer: killer ? JSON.parse(killer.w || '[]') : null,
      end: raidDayEnd(r.day), triesMax: RAID.tries, me, myRank, top, log, rally: this.rallyNow ? !!this.rallyNow() : false, rallyMul: RAID.rally,
      rew: { feather: RAID.feather, killFeather: RAID.killFeather, featherNeed: RAID.featherNeed, stage: RAID.stage, stageShard: RAID.stageShard, killShard: RAID.killShard, killCoin: RAID.killCoin, top: RAID.top } };
  },
  async raidGet(url, json) {
    if (this.rallyLoad) await this.rallyLoad();
    const id = url.searchParams.get('id') || '';
    const n = Math.min(50, Math.max(5, Number(url.searchParams.get('n')) || 5));
    return json({ now: Date.now(), raid: this.raidPub(this.raidToday(), /^[0-9a-f]{16,32}$/.test(id) ? id : '', n) });
  },
  async raidStart(b, json) {
    const a = await this.auth(b);
    if (a.err) return json({ err: a.err }, 403);
    if (!a.r) return json({ err: 'profile' }, 404);
    if ((b.v | 0) !== ENGINE_V) return json({ err: 'ver' }, 409);
    const party = cleanParty(b.party);
    if (!party || party.some((x) => x.mv.length !== 4)) return json({ err: 'party' }, 400);
    if (this.rallyLoad) await this.rallyLoad();
    const r = this.raidToday();
    if (r.killed) return json({ err: 'killed', raid: this.raidPub(r, b.id) }, 409);
    const u = this.sql.exec('SELECT tries FROM raid_u WHERE day = ? AND id = ?', r.day, b.id).toArray()[0];
    if (u && u.tries >= RAID.tries) return json({ err: 'tries', raid: this.raidPub(r, b.id) }, 409);
    /* 回数は始めたときに数える（途中でやめてもやり直せない） */
    this.sql.exec('INSERT INTO raid_u (day, id, tries, last) VALUES (?,?,1,?) ON CONFLICT(day, id) DO UPDATE SET tries = tries + 1, last = excluded.last', r.day, b.id, Date.now());
    this.sql.exec('UPDATE raid_d SET tries = tries + 1 WHERE day = ?', r.day);
    /* 紫の羽：挑戦した日に1枚（10枚で紫翼皇が仲間になる。仲間になったあとはかけら） */
    if (!u) this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', b.id, 'rfeather', r.day * 10, 0, RAID.feather);
    const E = globalThis.ENGINE, ch = E.byId(RAID.boss);
    const boss = { id: RAID.boss, star: 3, mv: E.autoPick(ch, 3, 0), lv: {}, hp: Math.max(1, r.hp), max: r.max, elv: RAID.elv, bonus: RAID.bonus };
    const mul = this.rallyNow && this.rallyNow() ? RAID.rally : 1;
    const code = 'R' + rid(7), ticket = hexId(12);
    const slots = [
      { ticket, id: b.id, party, who: this.who(b.id), lad: null },
      { bot: true, id: null, party: [boss], who: { tag: 'BOSS', w: [], icon: RAID.boss, title: 0, cpu: true }, lad: null },
    ];
    const stub = this.env.ROOM.get(this.env.ROOM.idFromName(code));
    const res = await stub.fetch('https://int/setup', { method: 'POST', body: JSON.stringify({ kind: 'raid', slots, day: r.day, hp0: boss.hp, mul, first: 0, maxRound: RAID.maxRound }) });
    if (!res.ok) return json({ err: 'room' }, 500);
    return json({ ok: true, room: code, ticket, boss, mul });
  },
  /* Room から届く結果（外からは呼べない） */
  raidResult(b) {
    const raw = Math.max(0, Math.floor(+b.dmg || 0));
    const r = this.sql.exec('SELECT * FROM raid_d WHERE day = ?', b.day).toArray()[0];
    if (!r || !b.id) return { err: 'day' };
    const dmg = Math.round(raw * (+b.mul || 1));
    const hit = r.killed ? 0 : Math.min(r.hp, dmg), hp = r.hp - hit, kill = !r.killed && hp <= 0 && hit > 0;
    this.sql.exec('UPDATE raid_d SET hp = ?, killed = ?, killer = ? WHERE day = ?', hp, kill ? Date.now() : r.killed, kill ? b.id : r.killer, b.day);
    this.sql.exec('UPDATE raid_u SET dmg = dmg + ?, best = MAX(best, ?), last = ? WHERE day = ? AND id = ?', dmg, dmg, Date.now(), b.day, b.id);
    this.sql.exec('INSERT INTO raid_log (t, day, id, dmg, kill) VALUES (?,?,?,?,?)', Date.now(), b.day, b.id, dmg, kill ? 1 : 0);
    this.sql.exec('DELETE FROM raid_log WHERE t < ?', Date.now() - 3 * DAY);
    const coins = RAID.coin(dmg);
    this.sql.exec('INSERT OR IGNORE INTO rw (id, kind, pkey, rank, coins) VALUES (?,?,?,?,?)', b.id, 'raid', Date.now() * 10 + Math.floor(Math.random() * 10), dmg, coins);
    if (kill) this.raidSettle(b.day);
    const me = this.sql.exec('SELECT tries, dmg FROM raid_u WHERE day = ? AND id = ?', b.day, b.id).toArray()[0] || { tries: 0, dmg: 0 };
    return { dmg, raw, mul: +b.mul || 1, coins, hp, max: r.max, kill, killedBefore: !!r.killed, myTotal: me.dmg, tries: me.tries, triesMax: RAID.tries };
  },
};

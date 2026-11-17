/*
 * マイスターの塔2（https://tnmtrt-pixel.github.io/mahoujin-rpg/）用の受け口
 *
 *  POST /api/mt2/profile {id, sec, w:[前,中,後], icon, title, v, inf?} プロフィール（名前・称号・アイコンは塔2だけのもの）
 *                         inf＝無限の塔で1回の挑戦で着いたいちばん高い階。今の記録より高いときだけ書きかえる
 *                         infR＝ゲームが受けとった「記録を0にした回数」。サーバーの回数より少ないと inf は使わない。返事に今の回数 infR
 *                         nm＝名前と称号の文字（運営の画面用）
 *  POST /api/mt2/rank    {id?}                                      無限の塔の攻略階数ランキング（上位50人＋自分の順位）
 *  POST /api/mt2/bug     {id?, name?, kind, text, info}             バグ報告（1つの端末・IDから1分に1件まで）
 *  運営：POST /api/admin {key, mt2:'bugs'}                      報告の一覧（新しい順200件）
 *        POST /api/admin {key, mt2:'done', n, done:true|false}   対応済みの印
 *        POST /api/admin {key, mt2:'users'}                     塔2のプロフィール一覧
 *        POST /api/admin {key, mt2:'hide', id, hidden:true|false} ランキングから外す／もどす
 *        POST /api/admin {key, mt2:'rank'}                      ランキング（非表示の人もふくむ上位200人、IDはそのまま）
 *        POST /api/admin {key, mt2:'reset', id}                 無限の塔の記録を0にする（もとに戻せない）
 *
 * ・識別IDと合言葉はサイコロ版と共通。サイコロ版のプロフィール（u）があるIDは、その合言葉と同じでないと登録できない
 * ・サイコロ版の表（u など）には書きこまない
 */
const ID_RE = /^[0-9a-f]{24}$/;
const SEC_RE = /^[0-9a-f]{32}$/;
const KINDS = ['stop', 'wrong', 'view', 'idea'];
const BUG_MAX = 3000;
const INF_MAX = 9999; /* 無限の塔の階数の上限 */
const RANK_N = 50; /* これより多くなったら、古い「対応済み」から消す */
const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+v || 0)));
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const Mt2Mixin = {
  mt2Init() {
    if (this.mt2Ready) return;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS mt2u (id TEXT PRIMARY KEY, sec TEXT NOT NULL, w TEXT NOT NULL DEFAULT '[]', icon TEXT NOT NULL DEFAULT '',
      title INTEGER NOT NULL DEFAULT 0, inf INTEGER NOT NULL DEFAULT 0, infT INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0,
      v TEXT NOT NULL DEFAULT '', made INTEGER NOT NULL DEFAULT 0, upd INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS mt2bug (n INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, who TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '', info TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0)`);
    /* nm＝名前と称号の文字（運営の画面で見るためだけ。ゲームの表示には使わない） */
    try { this.sql.exec("ALTER TABLE mt2u ADD COLUMN nm TEXT NOT NULL DEFAULT ''"); } catch (e) { /* 追加済み */ }
    /* infR＝運営が記録を0にした回数。ゲームは受けとった回数を覚え、それより古い記録は送っても使わない */
    try { this.sql.exec('ALTER TABLE mt2u ADD COLUMN infR INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* 追加済み */ }
    this.mt2Ready = true;
  },

  async mt2Auth(b) {
    if (!ID_RE.test(b.id || '') || !SEC_RE.test(b.sec || '')) return { err: 'bad id' };
    const h = await sha('mt:' + b.sec); /* サイコロ版と同じ形 */
    const r = this.sql.exec('SELECT * FROM mt2u WHERE id=?', b.id).toArray()[0];
    if (r) return r.sec === h ? { r, h } : { err: 'auth' };
    const d = this.sql.exec('SELECT sec FROM u WHERE id=?', b.id).toArray()[0];
    if (d && d.sec !== h) return { err: 'auth' };
    return { r: null, h };
  },

  async mt2Route(path, request, json) {
    this.mt2Init();
    if (request.method !== 'POST') return json({ err: 'method' }, 405);
    const b = await request.json().catch(() => ({}));
    if (path === '/api/mt2/profile') {
      const a = await this.mt2Auth(b);
      if (a.err) return json({ err: a.err }, 403);
      const w = (Array.isArray(b.w) ? b.w : []).slice(0, 3).map((n) => int(n, 0, 999));
      if (w.length !== 3) return json({ err: 'name' }, 400);
      const icon = str(b.icon, 16).replace(/[^a-z0-9]/g, ''), title = int(b.title, 0, 99), v = str(b.v, 16), now = Date.now();
      const inf = int(b.inf, 0, INF_MAX);
      if (a.r) this.sql.exec('UPDATE mt2u SET w=?, icon=?, title=?, v=?, upd=? WHERE id=?', JSON.stringify(w), icon, title, v, now, b.id);
      else this.sql.exec('INSERT INTO mt2u (id, sec, w, icon, title, v, made, upd) VALUES (?,?,?,?,?,?,?,?)', b.id, a.h, JSON.stringify(w), icon, title, v, now, now);
      const infR = a.r ? a.r.infR | 0 : 0;
      if (inf > 0 && int(b.infR, 0, 1e6) >= infR) this.sql.exec('UPDATE mt2u SET inf=?, infT=? WHERE id=? AND inf<?', inf, now, b.id, inf);
      if (b.nm) this.sql.exec('UPDATE mt2u SET nm=? WHERE id=?', str(b.nm, 40), b.id);
      return json({ ok: true, infR });
    }
    if (path === '/api/mt2/rank') {
      /* 同じ階なら、先にその階に着いた人が上 */
      const rows = this.sql.exec('SELECT id, w, icon, title, inf, infT FROM mt2u WHERE inf > 0 AND hidden = 0 ORDER BY inf DESC, infT ASC LIMIT ?', RANK_N).toArray();
      const total = this.sql.exec('SELECT COUNT(*) AS c FROM mt2u WHERE inf > 0 AND hidden = 0').toArray()[0].c;
      const pub = (r, n) => ({ n, tag: r.id.slice(-4), w: JSON.parse(r.w || '[]'), icon: r.icon, title: r.title, inf: r.inf, me: r.id === b.id || undefined });
      const list = rows.map((r, i) => pub(r, i + 1));
      let me = null;
      if (ID_RE.test(b.id || '')) {
        const r = this.sql.exec('SELECT id, w, icon, title, inf, infT, hidden FROM mt2u WHERE id=?', b.id).toArray()[0];
        if (r && r.inf > 0 && !r.hidden) {
          const n = this.sql.exec('SELECT COUNT(*) AS c FROM mt2u WHERE hidden = 0 AND (inf > ? OR (inf = ? AND infT < ?))', r.inf, r.inf, r.infT).toArray()[0].c + 1;
          me = pub(r, n);
        }
      }
      return json({ list, me, total });
    }
    if (path === '/api/mt2/bug') {
      const text = str(b.text, 800).trim();
      if (text.length < 2) return json({ err: 'text' }, 400);
      const ip = request.headers.get('cf-connecting-ip') || '';
      const who = ID_RE.test(b.id || '') ? b.id : 'ip:' + (await sha('ip|' + ip)).slice(0, 16);
      const now = Date.now();
      /* 連続送信を止める：同じIDか同じ回線から1分に1件。全体でも1分に30件まで */
      this.mt2Last = this.mt2Last || new Map();
      const keyIp = 'ip:' + ip;
      if (now - (this.mt2Last.get(who) || 0) < 60000 || (ip && now - (this.mt2Last.get(keyIp) || 0) < 60000)) return json({ err: 'wait' }, 429);
      const recent = this.sql.exec('SELECT COUNT(*) AS c FROM mt2bug WHERE t > ?', now - 60000).toArray()[0].c;
      if (recent >= 30) return json({ err: 'busy' }, 429);
      this.mt2Last.set(who, now); if (ip) this.mt2Last.set(keyIp, now);
      if (this.mt2Last.size > 2000) this.mt2Last.clear();
      const kind = KINDS.includes(b.kind) ? b.kind : 'idea';
      const info = str(JSON.stringify(b.info && typeof b.info === 'object' ? b.info : {}), 2000);
      this.sql.exec('INSERT INTO mt2bug (t, who, name, kind, text, info) VALUES (?,?,?,?,?,?)', now, who, str(b.name, 40), kind, text, info);
      const all = this.sql.exec('SELECT COUNT(*) AS c FROM mt2bug').toArray()[0].c;
      if (all > BUG_MAX) this.sql.exec('DELETE FROM mt2bug WHERE n IN (SELECT n FROM mt2bug ORDER BY done DESC, n ASC LIMIT ?)', all - BUG_MAX);
      return json({ ok: true });
    }
    return json({ err: 'not found' }, 404);
  },

  mt2Admin(b, json) {
    this.mt2Init();
    if (b.mt2 === 'bugs') {
      const rows = this.sql.exec('SELECT n, t, who, name, kind, text, info, done FROM mt2bug ORDER BY n DESC LIMIT 200').toArray();
      const open = this.sql.exec('SELECT COUNT(*) AS c FROM mt2bug WHERE done = 0').toArray()[0].c;
      return json({ bugs: rows, open });
    }
    if (b.mt2 === 'done') {
      const n = this.sql.exec('UPDATE mt2bug SET done=? WHERE n=?', b.done === false ? 0 : 1, int(b.n, 0, 1e12)).rowsWritten;
      return json({ ok: true, n });
    }
    if (b.mt2 === 'users') {
      return json({ users: this.sql.exec('SELECT id, w, icon, title, inf, hidden, v, made, upd FROM mt2u ORDER BY upd DESC LIMIT 200').toArray() });
    }
    if (b.mt2 === 'rank') {
      const rows = this.sql.exec('SELECT id, w, icon, title, nm, inf, infT, hidden, v, upd FROM mt2u WHERE inf > 0 ORDER BY inf DESC, infT ASC LIMIT 200').toArray();
      const total = this.sql.exec('SELECT COUNT(*) AS c FROM mt2u').toArray()[0].c;
      return json({ list: rows, total });
    }
    if (b.mt2 === 'reset') {
      const n = this.sql.exec('UPDATE mt2u SET inf=0, infT=0, infR=infR+1 WHERE id=?', str(b.id, 24)).rowsWritten;
      return json({ ok: true, n });
    }
    if (b.mt2 === 'hide') {
      const n = this.sql.exec('UPDATE mt2u SET hidden=? WHERE id=?', b.hidden === false ? 0 : 1, str(b.id, 24)).rowsWritten;
      return json({ ok: true, n });
    }
    return json({ err: 'op' }, 400);
  },
};

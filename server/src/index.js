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

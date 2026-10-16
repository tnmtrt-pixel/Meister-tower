# マイスターの塔 通信対戦サーバー

Cloudflare Workers + Durable Objects（SQLite）で動く、対戦部屋の中継サーバーです。

- 対戦の計算は両方の端末が同じ乱数シードで行い、サーバーは部屋づくり・シードと先攻の決定・行動の中継だけを担当します。
- 接続先：`wss://<WorkerのURL>/ws?room=合言葉`
- 動作確認：`https://<WorkerのURL>/health` に「meister-tower-online ok」と出れば稼働中です。

## Cloudflare への取り込み
1. Workers & Pages →「作成」→「リポジトリをインポート」でこのリポジトリを選ぶ
2. プロジェクト名を `meister-tower-online` にする（wrangler.jsonc の name と同じ）
3. ルートディレクトリ（Root directory）を `server` にする
4. デプロイコマンドは既定の `npx wrangler deploy` のまま

## 大会（マイスター杯）の運営用パスワード

運営画面（https://tnmtrt-pixel.github.io/Meister-tower/admin.html）を使うには、
Cloudflare に運営用パスワードを1回だけ登録します。

1. Cloudflare の Workers & Pages → meister-tower-online を開く
2. Settings（設定）→ Variables and Secrets（変数とシークレット）→ Add（追加）
3. Type は Secret、Variable name は `ADMIN_KEY`、Value に好きなパスワードを入れて Deploy

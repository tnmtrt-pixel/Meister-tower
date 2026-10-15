# マイスターの塔

ガチャで仲間を集め、サイコロで技を出し合いながら全10階の塔を登るブラウザゲームです。

## ファイル構成
- `index.html` … 画面・演出・セーブ・音（ゲーム本体）
- `engine.js` … キャラと技のデータ、バトルの仕組み（画面に依存しない）
- `img/` … キャラ画像とタイトル画像

## 遊び方（ローカル）
フォルダごと置いて `index.html` をブラウザで開けば動きます。
GitHub Pages などの静的ホスティングにそのままアップロードしても公開できます。

## 調整のしかた
- キャラ・技の数値：`engine.js` の `CHARS` と `HIDDEN`
- 階の名前と特別ルール：`engine.js` の `FLOORS`
- 塔の難易度：`floorHP` `bossHP` `floorStar` `floorCount`
- 長期戦の疲れが始まるラウンド：`FATIGUE`

`engine.js` は Node.js からも読み込めるので、`ENGINE.simulate()` で CPU 同士の自動対戦ができます。

## 補足
- フォント（Dela Gothic One / M PLUS 1p / Yuji Syuku）は Google Fonts から読み込みます。オフラインでは代わりのフォントで表示されます。
- セーブデータはブラウザの localStorage（キー `okc-save2`）に保存されます。

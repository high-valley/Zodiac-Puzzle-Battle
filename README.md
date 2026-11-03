# アストラクロニクル（ASTRA CHRONICLE）

2×2回転パズルと12星座キャラを組み合わせた、スマホ縦画面向けの戦略型パズルRPG。GitHub Pages の Web アプリとして作り、のちに Capacitor で iOS アプリにする。仕様は [`docs/game-spec.md`](docs/game-spec.md)、仕様を決めた・変えた理由は [`docs/decisions.md`](docs/decisions.md)、画面の参考画像は [`docs/ui-reference/`](docs/ui-reference/)、雰囲気の画像を作るためのプロンプトは [`docs/art-prompts.md`](docs/art-prompts.md)、キャラの外見を決めるための資料は [`docs/character-design.md`](docs/character-design.md)、キャラ絵を確かめるためのプロンプトは [`docs/character-prompts.md`](docs/character-prompts.md)、基本の姿の見本の絵は [`docs/character-art/`](docs/character-art/)。

公開版：https://high-valley.github.io/Zodiac-Puzzle-Battle/

## 構成

- `src/game/` … ゲームエンジン（画面・ブラウザに依存しない純粋な関数）
  - `board.ts` 盤面の生成・2×2回転・落下と補充／`matching.ts` 通常マッチ／`specials.ts` 必殺の形の判定／`party.ts` 編成のルールとレベルによる強さ／`growth.ts` 経験値とレベルアップ／`combat.ts` 1ターンの解決／`rng.ts` seed 付き乱数／`types.ts` 型
- `src/data/` … 数値の設定データ（`balance.ts` 盤面・連鎖・スワイプ閾値、`heroes.ts` 12星座のキャラと仲間になる条件、`growth.ts` レベルと経験値、`enemies.ts` 敵、`stages.ts` ステージと★の条件、`devTools.ts` 開発者画面を入れるか）。仕様書の数値は仮
- `src/input/swipe.ts` … 交点の選び方とスワイプの向きの判定（純粋な関数）
- `src/audio/` … 効果音（`cues.ts` 出来事と音の対応、`sound.ts` Web Audio での合成）
- `src/storage/` … 端末に保存するもの（`settings.ts` 設定、`progress.ts` クリアの記録・途中のバトル・編成・キャラのレベル）
- `src/app.ts`・`src/routes.ts` … 画面の切り替え（URL の # で決める）
- `src/components/`・`src/screens/` … 画面（DOM ＋ Pointer Events）。開発者画面は `#/dev`（メニューからも開ける。すべて解放・レベル・全画面への入口）
- `tests/` … Vitest の単体テスト
- `tools/` … 計測用の自動プレイヤー（`bot.ts`）とバランスの計測（`bench.ts`）

## 開発

```
npm install
npm run dev      # http://localhost:5173/Zodiac-Puzzle-Battle/
npm test         # エンジンと入力判定の単体テスト
npm run build    # 型チェック ＋ dist/ へビルド
npm run bench    # 自動プレイヤーでステージごとの勝率・ターン数・必殺の発生率を計測（npm run bench -- 300 1-5 で戦闘数とステージ、npm run bench -- 200 1-5 leo,cancer,virgo で編成も指定）
```

## 公開（GitHub Pages）

`main` への push で `.github/workflows/deploy-pages.yml` がテスト・ビルドして Pages に公開する。PR ではテストとビルドだけ流す。Settings → Pages → Source は **GitHub Actions**。

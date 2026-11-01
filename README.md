# 星座パズルバトル

2×2回転パズルと12星座キャラを組み合わせた、スマホ縦画面向けの戦略型パズルRPG。GitHub Pages の Web アプリとして作り、のちに Capacitor で iOS アプリにする。仕様は [`docs/game-spec.md`](docs/game-spec.md)、仕様を決めた・変えた理由は [`docs/decisions.md`](docs/decisions.md)。

公開版：https://high-valley.github.io/Zodiac-Puzzle-Battle/

## 構成

- `src/game/` … ゲームエンジン（画面・ブラウザに依存しない純粋な関数）
  - `board.ts` 盤面の生成・2×2回転・落下と補充／`matching.ts` 通常マッチ／`specials.ts` 必殺の形の判定／`combat.ts` 1ターンの解決／`rng.ts` seed 付き乱数／`types.ts` 型
- `src/data/` … 数値の設定データ（`balance.ts` 盤面・連鎖・敵・スワイプ閾値、`heroes.ts` キャラ）。仕様書の数値は仮
- `src/input/swipe.ts` … 交点の選び方とスワイプの向きの判定（純粋な関数）
- `src/audio/` … 効果音（`cues.ts` 出来事と音の対応、`sound.ts` Web Audio での合成）
- `src/storage/settings.ts` … 端末に保存する設定（効果音・遊び方を見たか）
- `src/components/`・`src/screens/` … 画面（DOM ＋ Pointer Events）
- `tests/` … Vitest の単体テスト

## 開発

```
npm install
npm run dev      # http://localhost:5173/Zodiac-Puzzle-Battle/
npm test         # エンジンと入力判定の単体テスト
npm run build    # 型チェック ＋ dist/ へビルド
```

## 公開（GitHub Pages）

`main` への push で `.github/workflows/deploy-pages.yml` がテスト・ビルドして Pages に公開する。PR ではテストとビルドだけ流す。Settings → Pages → Source は **GitHub Actions**。

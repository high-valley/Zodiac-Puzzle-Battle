// 育成（レベル）の設定データ。数値は仮。レベル1でいまの強さ（仕様書 12.4）

/** 最大レベル（2026-11-07 ユーザーの決定で 20 → 40） */
export const MAX_LEVEL = 40;

/** レベルが1上がるごとに増える強さ（レベル1の何%か）。2026-11-07 ユーザーの決定で 5 → 10 */
export const LEVEL_STEP_PERCENT = 10;

/** レベルによる強さ（レベル1を100とした整数）。小数の誤差を出さないよう、丸める計算はこちらを使う */
export function levelPercent(level: number): number {
  return 100 + LEVEL_STEP_PERCENT * (level - 1);
}

/** レベルによる強さの倍率：HP・攻撃・回復・必殺の威力にかける。レベル1で1 */
export function levelMultiplier(level: number): number {
  return levelPercent(level) / 100;
}

/** そのレベルから次のレベルに上がるのに要る経験値 */
export function expToNext(level: number): number {
  return 40 + 20 * (level - 1);
}

/** 負けたときにもらえる経験値の割合（勝ったときの何分の1か） */
export const DEFEAT_EXP_RATIO = 0.25;

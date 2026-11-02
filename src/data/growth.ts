// 育成（レベル）の設定データ。数値は仮。レベル1でいまの強さ（仕様書 12.4）

export const MAX_LEVEL = 20;

/** レベルによる強さの倍率：HP・攻撃・回復・必殺の威力にかける。レベル1で1 */
export function levelMultiplier(level: number): number {
  return 1 + 0.05 * (level - 1);
}

/** そのレベルから次のレベルに上がるのに要る経験値 */
export function expToNext(level: number): number {
  return 40 + 20 * (level - 1);
}

/** 負けたときにもらえる経験値の割合（勝ったときの何分の1か） */
export const DEFEAT_EXP_RATIO = 0.25;

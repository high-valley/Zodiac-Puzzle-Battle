// バランス・閾値の設定データ（仕様書の数値は仮。実測して差し替える）
import type { OrbColor } from '../game/types';

export const BOARD_SIZE = 5;
export const ORB_COLORS: readonly OrbColor[] = ['red', 'blue', 'green', 'pink'];

/** 通常マッチになる最小の連続数 */
export const MIN_MATCH = 3;
/** 連鎖の上限（無限ループ回避の暫定値） */
export const MAX_CHAIN = 8;

/** 連鎖倍率：1 + 0.25 × (連鎖段数 - 1) */
export function chainMultiplier(chain: number): number {
  return 1 + 0.25 * (chain - 1);
}

/** 交点スワイプの判定（CSS px） */
export const SWIPE = {
  /** 水平方向にこれ以上動いたら回転 */
  minDistance: 22,
  /** |dx| > ratio × |dy| を満たすこと */
  horizontalRatio: 1.2,
};

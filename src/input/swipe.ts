// 交点スワイプの判定（純粋な関数。座標は盤面の左上を原点とする CSS px）
import { BOARD_SIZE, SWIPE } from '../data/balance';
import type { Direction, Pos } from '../game/types';

/**
 * 押した位置にいちばん近い交点。交点 (r, c) の中心は ((c + 1) × cell, (r + 1) × cell)。
 * 盤面の端を押しても端の交点を選ぶので、見かけより判定が大きい
 */
export function nearestIntersection(x: number, y: number, cellSize: number): Pos {
  const max = BOARD_SIZE - 2;
  const clamp = (v: number) => Math.min(max, Math.max(0, v));
  return {
    row: clamp(Math.round(y / cellSize) - 1),
    col: clamp(Math.round(x / cellSize) - 1),
  };
}

export type SwipeResult =
  | { kind: 'rotate'; direction: Direction }
  | { kind: 'select' } // 縦も横も閾値未満：選択だけ
  | { kind: 'cancel' }; // 閾値以上動いたが水平ではない：何もしない

/** 右へスワイプ → 時計回り、左へ → 反時計回り */
export function classifySwipe(dx: number, dy: number, rule = SWIPE): SwipeResult {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= rule.minDistance && ax > rule.horizontalRatio * ay) {
    return { kind: 'rotate', direction: dx > 0 ? 'clockwise' : 'counterclockwise' };
  }
  if (ax < rule.minDistance && ay < rule.minDistance) return { kind: 'select' };
  return { kind: 'cancel' };
}

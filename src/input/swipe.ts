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

/**
 * 押した位置で選ぶ交点。今選んでいる交点の近く（縦横とも stickyCells マス以内）なら、それを選んだまま。
 * それ以外は、いちばん近い交点（2026-11-03。選んでいる所でスワイプしようとして、隣を選んでしまわないように）
 */
export function pickIntersection(x: number, y: number, cellSize: number, current: Pos | null, rule = SWIPE): Pos {
  if (current) {
    const cx = (current.col + 1) * cellSize;
    const cy = (current.row + 1) * cellSize;
    if (Math.abs(x - cx) < rule.stickyCells * cellSize && Math.abs(y - cy) < rule.stickyCells * cellSize) return current;
  }
  return nearestIntersection(x, y, cellSize);
}

/** 押した位置。選んだ交点（2×2 の中心）からのずれ（px）と、1マスの大きさ */
export interface Grip {
  x: number;
  y: number;
  cell: number;
}

/**
 * 回す向き：押したオーブが、指をすべらせた向きに動くように回す（2026-11-03 ユーザーの要望）。
 * 例：上の2個を押して右へ → 時計回り、下の2個を押して右へ → 反時計回り、右の2個を押して下へ → 時計回り。
 * 交点のすぐ近くを押したとき（どちら側か決められないとき）と grip が無いときは、右・下へ＝時計回り
 */
export function turnDirection(axis: 'x' | 'y', along: number, grip?: Grip, rule = SWIPE): Direction {
  let side = 1;
  if (grip) {
    const off = axis === 'x' ? -grip.y : grip.x; // 横：上側が正。縦：右側が正
    if (Math.abs(off) >= rule.gripDeadCells * grip.cell) side = Math.sign(off);
  }
  return along * side > 0 ? 'clockwise' : 'counterclockwise';
}

/** 指に合わせて回すときの、回す向きに沿った動き（横か縦の、大きいほう。右・下が正）。どちらとも言えなければ null */
export function swipeAlong(dx: number, dy: number, rule = SWIPE): { along: number; axis: 'x' | 'y' } | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > rule.dragDeadZone && ax > rule.axisRatio * ay) return { along: dx, axis: 'x' };
  if (ay > rule.dragDeadZone && ay > rule.axisRatio * ax) return { along: dy, axis: 'y' };
  return null;
}

export type SwipeResult =
  | { kind: 'rotate'; direction: Direction }
  | { kind: 'select' } // 縦も横も閾値未満：選択だけ
  | { kind: 'cancel' }; // 閾値以上動いたが斜め：何もしない

/** 横か縦に閾値以上すべらせたら回す（向きは turnDirection）。斜め（横と縦が同じくらい）は回さない */
export function classifySwipe(dx: number, dy: number, rule = SWIPE, grip?: Grip): SwipeResult {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= rule.minDistance && ax > rule.axisRatio * ay) {
    return { kind: 'rotate', direction: turnDirection('x', dx, grip, rule) };
  }
  if (ay >= rule.minDistance && ay > rule.axisRatio * ax) {
    return { kind: 'rotate', direction: turnDirection('y', dy, grip, rule) };
  }
  if (ax < rule.minDistance && ay < rule.minDistance) return { kind: 'select' };
  return { kind: 'cancel' };
}

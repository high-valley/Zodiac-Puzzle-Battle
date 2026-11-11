// 盤面の指の操作の判定（純粋な関数。座標は盤面の左上を原点とする CSS px）
import { BOARD_SIZE, SWIPE } from '../data/balance';
import type { Pos } from '../game/types';

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
 * 押した位置で選ぶ交点。今選んでいる 2×2 の上（縦横とも stickyCells マス以内）なら、それを選んだまま（ほかの交点の星の上を押したときは除く）。
 * それ以外は、いちばん近い交点（2026-11-03。選んでいる所でスワイプしようとして、隣を選んでしまわないように）
 */
export function pickIntersection(x: number, y: number, cellSize: number, current: Pos | null, rule = SWIPE): Pos {
  const nearest = nearestIntersection(x, y, cellSize);
  if (current) {
    const cx = (current.col + 1) * cellSize;
    const cy = (current.row + 1) * cellSize;
    const inside = Math.abs(x - cx) < rule.stickyCells * cellSize && Math.abs(y - cy) < rule.stickyCells * cellSize;
    const nx = (nearest.col + 1) * cellSize;
    const ny = (nearest.row + 1) * cellSize;
    const onOtherStar =
      (nearest.row !== current.row || nearest.col !== current.col) &&
      Math.abs(x - nx) < rule.neighborStarCells * cellSize &&
      Math.abs(y - ny) < rule.neighborStarCells * cellSize;
    if (inside && !onOtherStar) return current;
  }
  return nearest;
}

/**
 * 押しただけでは 2×2 を決めない位置か（2026-11-12 改）。
 * 交点の星の近く（neighborStarCells 以内）を押したときだけ、その交点にすぐ決める。
 * それ以外（オーブの上）は、今選んでいる 2×2 の上でも、動かした向きで決め直す（pickByDrag）
 */
export function isAmbiguousPress(x: number, y: number, cellSize: number, rule = SWIPE): boolean {
  const near = nearestIntersection(x, y, cellSize);
  const nx = (near.col + 1) * cellSize;
  const ny = (near.row + 1) * cellSize;
  return !(Math.abs(x - nx) < rule.neighborStarCells * cellSize && Math.abs(y - ny) < rule.neighborStarCells * cellSize);
}

/**
 * 押した所（x0, y0）から今の指（x1, y1）への動きで、回したい 2×2 を決める（純粋な関数）。
 * 2026-11-12 ユーザーの決定：「選んである 4つのまま」をやめ、オーブをつかむたびに、動かした向きにある 2×2 を選び直す。
 * 候補は、押したオーブの四隅の交点（盤面の中のものだけ）。
 * - 進む向き（横か縦の、大きく動いた方）の側の交点にする。右へ動かせば右側、下へ動かせば下側。
 * - 残り（横へ動かしたときの上下、縦へ動かしたときの左右）は、横ぶれの側。左下へ動かせば、左下の 2×2 になる。
 * - 横ぶれが小さい（straightRatio 未満。まっすぐ運んだ）ときだけ、今選んでいる 2×2 が進む向きの側にあればそれ、無ければ押した所に近い方
 */
export function pickByDrag(x0: number, y0: number, x1: number, y1: number, cellSize: number, current: Pos | null = null, rule = SWIPE): Pos {
  const max = BOARD_SIZE - 2;
  const orbRow = Math.min(BOARD_SIZE - 1, Math.max(0, Math.floor(y0 / cellSize)));
  const orbCol = Math.min(BOARD_SIZE - 1, Math.max(0, Math.floor(x0 / cellSize)));
  const valid = (v: number) => v >= 0 && v <= max;
  /** 交点の行（列）：side が正ならオーブの下（右）側、負なら上（左）側。盤面の外なら反対側 */
  const pick = (orb: number, side: number) => {
    const want = side > 0 ? orb : orb - 1;
    return valid(want) ? want : side > 0 ? orb - 1 : orb;
  };
  /** 押した所に近い側（+1＝下・右、-1＝上・左）。まんなかは nearestIntersection と同じ下・右 */
  const nearSide = (v: number, orb: number) => (v - (orb + 0.5) * cellSize >= 0 ? 1 : -1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const main = horizontal ? dx : dy;
  const perp = horizontal ? dy : dx;
  const ratio = Math.abs(main) > 0 ? Math.abs(perp) / Math.abs(main) : 0;
  const mainSide = Math.sign(main) || 1;
  const mainIndex = pick(horizontal ? orbCol : orbRow, mainSide);
  const perpOrb = horizontal ? orbRow : orbCol;

  // 今選んでいる 2×2 が、押したオーブをふくみ、進む向きの側にあるか
  const curMain = current ? (horizontal ? current.col : current.row) : -1;
  const curPerp = current ? (horizontal ? current.row : current.col) : -1;
  const currentFits = current !== null && curMain === mainIndex && (curPerp === perpOrb || curPerp === perpOrb - 1);

  let perpIndex: number;
  if (ratio >= rule.straightRatio) perpIndex = pick(perpOrb, Math.sign(perp) || 1);
  else if (currentFits) perpIndex = curPerp;
  else perpIndex = pick(perpOrb, nearSide(horizontal ? y0 : x0, perpOrb));
  return horizontal ? { row: perpIndex, col: mainIndex } : { row: mainIndex, col: perpIndex };
}

/** 押した位置の、選んだ交点（2×2 の中心）から見た角度（ラジアン。右が 0、時計回りに増える）と距離（px） */
export function angleAround(x: number, y: number, cellSize: number, at: Pos): { angle: number; r: number } {
  const dx = x - (at.col + 1) * cellSize;
  const dy = y - (at.row + 1) * cellSize;
  return { angle: Math.atan2(dy, dx), r: Math.hypot(dx, dy) };
}

/** 角度の差を -π〜π に（指が真後ろを回りこんでも、ひと続きの動きとして足せるように） */
export function wrapAngle(d: number): number {
  let a = d % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** 角度（ラジアン）を、90度を 1 とした回した量に */
export const toTurns = (rad: number) => rad / (Math.PI / 2);

/** 指に合わせて回す量を、残りの回数（1ターン3回まで）の範囲に収める。正＝時計回り */
export function clampTurns(q: number, remaining: number): number {
  const m = Math.max(0, remaining);
  return Math.max(-m, Math.min(m, q));
}

/**
 * 指を離したときに回す回数（符号つき。正＝時計回り）。q は回した量（90度＝1）、speed は離す直前の角速度（90度＝1 / ms）、
 * moved は押してから動いた距離（px）。90度のうち snapAt を超えていれば回しきり、届いていなければその手前の回数にする。
 * 速く払ったときは、flickMinFrac 回していれば回しきる
 */
export function releaseSteps(q: number, speed: number, moved: number, rule = SWIPE): number {
  const sign = Math.sign(q);
  const a = Math.abs(q);
  let k = Math.floor(a);
  const frac = a - k;
  if (frac > rule.snapAt) k++;
  else if (moved >= rule.minDistance && speed * sign >= rule.flickSpeed && frac >= rule.flickMinFrac) k++;
  return sign * k;
}

/** 指で回している途中のようす。q は回した量（90度＝1、正＝時計回り）、lastAngle は前の指の角度（読めないときは null） */
export interface DialState {
  q: number;
  lastAngle: number | null;
}

/**
 * 指が動いたときの、回した量の更新（純粋な関数）。angle は 2×2 の中心から見た指の角度（中心に近すぎて読めないときは null）、
 * moved は押してから動いた最大の距離（px）、remaining は今あと何回回せるか。
 * 中心を通るあいだと、動きが dragDeadZone 未満のあいだは、角度の基準だけ取り直して回さない。±180度をまたいでもひと続きに足す
 */
export function advanceDial(s: DialState, angle: number | null, moved: number, remaining: number, rule = SWIPE): DialState {
  if (angle === null) return { q: s.q, lastAngle: null };
  if (s.lastAngle === null || moved < rule.dragDeadZone) return { q: s.q, lastAngle: angle };
  return { q: clampTurns(s.q + toTurns(wrapAngle(angle - s.lastAngle)), remaining), lastAngle: angle };
}

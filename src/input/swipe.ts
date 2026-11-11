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
 * オーブをつかんだ（押しただけでは 2×2 を決めない）か（2026-11-12 改）。
 * 交点の星のすぐ近く（dialStarCells 以内）を押したときだけ、その交点にすぐ決めて、つまみのように回す。
 * それ以外は、今選んでいる 2×2 の上でも、動かした向きで決め直す（pickCarry）
 */
export function isAmbiguousPress(x: number, y: number, cellSize: number, rule = SWIPE): boolean {
  const near = nearestIntersection(x, y, cellSize);
  return Math.hypot(x - (near.col + 1) * cellSize, y - (near.row + 1) * cellSize) >= rule.dialStarCells * cellSize;
}

/** つかんだオーブの運び方。pos は回す 2×2、leg1・leg2 はオーブが進む1つ目・2つ目の辺の向き、sign は回る向き（+1＝時計回り） */
export interface Carry {
  pos: Pos;
  leg1: { x: number; y: number };
  leg2: { x: number; y: number };
  sign: 1 | -1;
}

/**
 * 押した所（x0, y0）から今の指（x1, y1）への動きで、回したい 2×2 と、つかんだオーブの進み方を決める（純粋な関数）。
 * 2026-11-12 ユーザーの決定：「選んである 4つのまま」をやめ、オーブをつかむたびに、動かした向きにある 2×2 を選び直す。
 * 候補は、押したオーブの四隅の交点（盤面の中のものだけ）。
 * - 進む向き（横か縦の、大きく動いた方）の側の交点にする。右へ動かせば右側、下へ動かせば下側。
 * - 残り（横へ動かしたときの上下、縦へ動かしたときの左右）は、横ぶれの側。左下へ動かせば、左下の 2×2 になる。
 * - 横ぶれが小さい（straightRatio 未満。まっすぐ運んだ）ときだけ、今選んでいる 2×2 が進む向きの側にあればそれ、無ければ押した所に近い方。
 * オーブは、まず進む向きへ1マス（leg1）、つづけて 2×2 の中心の側へ1マス（leg2）進む。
 * 盤面の端で進む向きへ動けないときは、横ぶれの向きを1つ目の辺にする
 */
export function pickCarry(x0: number, y0: number, x1: number, y1: number, cellSize: number, current: Pos | null = null, rule = SWIPE): Carry {
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
  const pos = horizontal ? { row: perpIndex, col: mainIndex } : { row: mainIndex, col: perpIndex };

  // 2×2 の中心は、つかんだオーブから見て (sx, sy) の側。オーブが動けるのは、横なら sx、縦なら sy の向きだけ
  const sx = pos.col === orbCol ? 1 : -1;
  const sy = pos.row === orbRow ? 1 : -1;
  const across = { x: sx, y: 0 };
  const down = { x: 0, y: sy };
  // 1つ目の辺：指の動きと同じ向きに動ける方（横が主で横へ動けるなら横。動けなければ縦）
  const canAcross = Math.sign(dx) === sx;
  const canDown = Math.sign(dy) === sy;
  const firstAcross = horizontal ? canAcross || !canDown : !canDown && canAcross;
  // 時計回りは、中心から見たオーブの位置 (-sx, -sy) と進む向きの外積が正（y は下向き）
  return firstAcross ? { pos, leg1: across, leg2: down, sign: (sx * sy) as 1 | -1 } : { pos, leg1: down, leg2: across, sign: (-sx * sy) as 1 | -1 };
}

/** 動かした向きで決めた 2×2 だけを返す（pickCarry の pos） */
export function pickByDrag(x0: number, y0: number, x1: number, y1: number, cellSize: number, current: Pos | null = null, rule = SWIPE): Pos {
  return pickCarry(x0, y0, x1, y1, cellSize, current, rule).pos;
}

/** 運んでいる途中のようす。sign は今の回る向き、locked は進む向きを固定したか */
export interface CarryState {
  sign: 1 | -1;
  locked: boolean;
}

/**
 * つかんだオーブを運んだ量（90度＝1、符号つき。正＝時計回り）と、次のようす。純粋な関数。
 * dx・dy は押した所からの指の動き（px）。オーブは 2×2 の辺に沿って、まず大きく動かした向きへ1マス、
 * つづけて角を曲がってもう1マス進む（最大 180度）。
 * - 進んだ量は、2つの辺の向きの成分 a・b（0〜1）の大きい方 p と小さい方 s から p + s × (p が carryTurnStart〜 で数え始める割合)。
 *   ななめ（中心へ向かう向き）に動かしても p で進み、角を丸く曲がっても、ななめに突っ切っても飛ばずにつながる。
 * - 回る向きは、大きく動かした方の辺で決まる。どちらかの辺を carryLockAt まで進むまでは、
 *   もう一方が carrySwapMargin 上回ったら切り替える（動かし始めに少し横へ出てから下へ運んでも、下へ進む）。
 * - 決まった所（decideCells）から carryCatchCells までのあいだに、だんだん指に追いつかせる。
 * - 逆向きへは回さない（戻せば 0 に戻る）
 */
export function advanceCarry(
  dx: number,
  dy: number,
  cellSize: number,
  carry: Carry,
  state: CarryState = { sign: carry.sign, locked: false },
  rule = SWIPE,
): { q: number; state: CarryState } {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const a = clamp01((dx * carry.leg1.x + dy * carry.leg1.y) / cellSize);
  const b = clamp01((dx * carry.leg2.x + dy * carry.leg2.y) / cellSize);
  const p = Math.max(a, b);
  const s = Math.min(a, b);
  let sign = state.sign;
  if (!state.locked) {
    // leg1 が主なら carry.sign、leg2 が主ならその逆
    if (sign === carry.sign && b > a + rule.carrySwapMargin) sign = -carry.sign as 1 | -1;
    else if (sign !== carry.sign && a > b + rule.carrySwapMargin) sign = carry.sign;
  }
  const locked = state.locked || p >= rule.carryLockAt;
  const turn = clamp01((p - rule.carryTurnStart) / rule.carryTurnSpan);
  const dist = Math.hypot(dx, dy) / cellSize;
  const catchUp = clamp01((dist - rule.decideCells) / (rule.carryCatchCells - rule.decideCells));
  return { q: sign * (p + s * turn) * catchUp, state: { sign, locked } };
}

/** 押した所からまっすぐ（途中で向きを変えずに）運んだときの量（advanceCarry を1回だけ） */
export function carryTurns(dx: number, dy: number, cellSize: number, carry: Carry, rule = SWIPE): number {
  return advanceCarry(dx, dy, cellSize, carry, undefined, rule).q;
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
export function releaseSteps(q: number, speed: number, moved: number, rule = SWIPE, flickFirstOnly = false): number {
  const sign = Math.sign(q);
  const a = Math.abs(q);
  let k = Math.floor(a);
  const frac = a - k;
  if (frac > rule.snapAt) k++;
  // flickFirstOnly：オーブをつかんで運んだときは、払って回しきるのは1回目だけ（1マス運んだときの少しの横ぶれで、2回分使わないように）
  else if (moved >= rule.minDistance && speed * sign >= rule.flickSpeed && frac >= rule.flickMinFrac && !(flickFirstOnly && k >= 1)) k++;
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

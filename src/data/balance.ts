// バランス・閾値の設定データ（仕様書の数値は仮。実測して差し替える）
import type { OrbColor } from '../game/types';

export const BOARD_SIZE = 5;
export const ORB_COLORS: readonly OrbColor[] = ['red', 'blue', 'green', 'pink'];

/** 通常マッチになる最小の連続数 */
export const MIN_MATCH = 3;
/** 1ターンに回せる回数の上限（回し終えたら「攻撃」で確定。仕様書 10章） */
export const MAX_ROTATIONS_PER_TURN = 3;

/** 連鎖の上限（無限ループ回避の暫定値） */
export const MAX_CHAIN = 8;

/** 連鎖倍率：1 + 0.25 × (連鎖段数 - 1) */
export function chainMultiplier(chain: number): number {
  return 1 + 0.25 * (chain - 1);
}

/** 交点スワイプの判定（CSS px）。横：右へ＝時計回り。縦：下へ＝時計回り（2026-11-03） */
export const SWIPE = {
  /** 横か縦にこれ以上動いたら回転 */
  minDistance: 22,
  /** 横なら |dx| > ratio × |dy|、縦なら |dy| > ratio × |dx|（どちらでもない斜めは回さない） */
  axisRatio: 1.2,
  /** 指に合わせて回し始めるまでの遊び（px） */
  dragDeadZone: 4,
  /** 何マス分動かすと 90 度回るか */
  dragCellsPer90: 0.9,
};

/**
 * 回す動きの速さのうち、開発者画面で調整できるもの（2026-11-03。ユーザーが画面で試して決める）。
 * 時間はミリ秒で、演出 ×2 ではこの半分
 */
export interface RotateTuning {
  /** 回転ボタンで回すとき */
  buttonMs: number;
  /** 指を離したあと残りを回しきる時間の下限と上限（指の速さに合わせつつ、速すぎないように）。
   *  回し始め（閾値ちょうど、残り約7割）のときの値で、残りが少ないほど短くする */
  releaseMinMs: number;
  releaseMaxMs: number;
  /** 指に合わせて回すのは、ここ（90 度に対する割合）まで。残りは指を離してから回す。0 なら指には合わせない */
  dragMaxP: number;
}

export const DEFAULT_ROTATE_TUNING: RotateTuning = { buttonMs: 600, releaseMinMs: 400, releaseMaxMs: 560, dragMaxP: 0.5 };

/** 開発者画面のつまみの範囲 */
export const ROTATE_TUNING_RANGE: Record<keyof RotateTuning, { min: number; max: number; step: number }> = {
  buttonMs: { min: 200, max: 5000, step: 100 },
  releaseMinMs: { min: 100, max: 5000, step: 20 },
  releaseMaxMs: { min: 100, max: 5000, step: 20 },
  dragMaxP: { min: 0, max: 1, step: 0.05 },
};

/** 回す動きの、調整しないもの */
export const ROTATE_ANIM = {
  /** releaseMinMs・releaseMaxMs を決めたときの残りの割合 */
  releaseRefRemaining: 0.7,
  /** 速さの計算に使う、指の速さの下限（px/ms）。これより遅いと上限の時間になる */
  releaseMinSpeed: 0.08,
  /** 離す直前にこれより長く指を止めていたら、そのぶん遅く回しきる（ms） */
  stillMs: 80,
  /** 回しかけを元に戻す時間（ms） */
  springBackMs: 140,
};

/**
 * 指を離したあと、残りを回しきる時間（ms）。残りの弧の長さを指の速さで割り、残りの割合に応じた下限・上限で挟む。
 * ms は回転ボタンの時間（演出 ×2 なら半分）で、同じ割合で縮める
 */
export function releaseDuration(
  p0: number,
  speed: number,
  cellPx: number,
  ms: number = DEFAULT_ROTATE_TUNING.buttonMs,
  t: RotateTuning = DEFAULT_ROTATE_TUNING,
): number {
  const k = ms / t.buttonMs;
  const remainingFrac = Math.max(0, Math.min(1, 1 - p0));
  // 円弧の長さ：2×2 の中心から各オーブの中心まで √2/2 マス、90 度で π/4 × √2 ≒ 1.11 マス
  const arc = remainingFrac * cellPx * ((Math.PI / 4) * Math.SQRT2);
  const scale = (remainingFrac / ROTATE_ANIM.releaseRefRemaining) * k;
  const lo = t.releaseMinMs * scale;
  const hi = Math.max(t.releaseMinMs, t.releaseMaxMs) * scale;
  const bySpeed = (arc / Math.max(speed, ROTATE_ANIM.releaseMinSpeed)) * k;
  return Math.round(Math.min(hi, Math.max(lo, bySpeed)));
}

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

/**
 * 盤面の指の操作（CSS px）。選んだ 2×2 の中心のまわりを、つまみを回すように指で回す（2026-11-04 ユーザーの決定）。
 * 指の角度にぴったり付いて回り、何周でも続けて回せる（90度ごとに1回と数え、残りの回数で止まる）
 */
export const SWIPE = {
  /** これより短い動き（px）は「押しただけ」：選ぶだけで回さない */
  dragDeadZone: 4,
  /** 速く払って回しきるのは、これ以上動かしたときだけ（px） */
  minDistance: 22,
  /** 選んでいる 2×2 を押し直したとみなす範囲（その交点からのマス数。縦横どちらもこれより近ければ選び直さない）。
   *  1 なら 2×2 の4個の上ぜんぶ。4個のどれかを押して回しても、隣の 2×2 に移らない */
  stickyCells: 1,
  /** ただし、ほかの交点の星のこの範囲（マス数）を押したときは、その交点に移る（隣を選び直せるように） */
  neighborStarCells: 0.3,
  /** 2×2 の中心からこれより近い所（マス数）では、指の角度を読まない（わずかな動きで角度が大きくぶれるため） */
  centerDeadCells: 0.35,
  /** 指を離したとき、90度のこの割合より多く回していれば回しきる（ちょうどなら戻す）。届いていなければ元に戻す */
  snapAt: 0.5,
  /** 速く払ったとき（90度を1とした角度 / ms）は、flickMinFrac 回していれば回しきる */
  flickSpeed: 0.004,
  flickMinFrac: 0.15,
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
}

// 2026-11-03 ユーザーが画面で試して決めた値（ボタン 0.5秒／離したあと 0.5秒）
export const DEFAULT_ROTATE_TUNING: RotateTuning = { buttonMs: 500, releaseMinMs: 500, releaseMaxMs: 500 };

/** 開発者画面のつまみの範囲 */
export const ROTATE_TUNING_RANGE: Record<keyof RotateTuning, { min: number; max: number; step: number }> = {
  buttonMs: { min: 200, max: 5000, step: 100 },
  releaseMinMs: { min: 100, max: 5000, step: 20 },
  releaseMaxMs: { min: 100, max: 5000, step: 20 },
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

/** キャラ特性の強さ（仕様書 12.8。数値は仮） */
export const TRAITS = {
  /** 先陣：そのターン最初の消去（連鎖1段目）に自分の色があれば、その段のダメージをこの倍に */
  vanguardMultiplier: 1.8,
  /** 量：一度に消した自分の色が3個を超えた1個ごとに、その段のダメージを増やす割合（3個で1倍、5個で1.5倍） */
  massPerExtra: 0.25,
  /** 連鎖：連鎖倍率の伸びをこれに替える（ふつうは 0.25。2連鎖で1.5倍、4連鎖で2.5倍） */
  chainStep: 0.5,
};

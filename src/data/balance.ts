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
   *  1 なら 2×2 の4個の上ぜんぶ。2026-11-12 からは、押して動かさずに離したとき（タップ）だけに使う */
  stickyCells: 1,
  /** ただし、ほかの交点の星のこの範囲（マス数）を押したときは、その交点に移る（隣を選び直せるように） */
  neighborStarCells: 0.3,
  /** オーブをつかんだときは、指がこれだけ（マス数）動いてから、動かした向きで 2×2 を決める（2026-11-12） */
  decideCells: 0.22,
  /** 決まった所から、指がここ（マス数）まで動くあいだに、オーブを指に追いつかせる（決まった瞬間に盤面が飛ばないように） */
  carryCatchCells: 0.5,
  /** つかんだオーブの進む向き（横か縦か）は、どちらかの辺をこの割合まで進むと固定する。それまでは、大きく動いた方へ切り替える */
  carryLockAt: 0.5,
  /** 進む向きを切り替えるのは、もう一方がこれ（辺の割合）だけ上回ったとき（境目でばたつかないように） */
  carrySwapMargin: 0.08,
  /** 向きで決めるとき、横ぶれ（進む向きに直角な動き ÷ 進む向きの動き）がこれ未満なら「まっすぐ運んだ」とみなす */
  straightRatio: 0.2,
  /** 交点の星からこの距離（マス数）より近い所を押したときだけ、その交点にすぐ決めて、つまみのように回す。
   *  オーブの絵（半径 約0.41マス）の上にはほとんどかからない広さにする */
  dialStarCells: 0.25,
  /** つかんだオーブを運ぶとき、1つ目の辺をこの割合まで進んだら、2つ目の辺（角を曲がった先）の動きも数え始める */
  carryTurnStart: 0.25,
  /** 2つ目の辺の動きを全部数えるようになるまでの幅（1つ目の辺の割合） */
  carryTurnSpan: 0.5,
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
  /** 回す動きの基準の時間（回転ボタンがあったころ、ボタンで回すときの時間。指を離したあとの時間もこれを基準に縮める） */
  buttonMs: number;
  /** 指を離したあと残りを回しきる時間の下限と上限（指の速さに合わせつつ、速すぎないように）。
   *  回し始め（閾値ちょうど、残り約7割）のときの値で、残りが少ないほど短くする */
  releaseMinMs: number;
  releaseMaxMs: number;
}

// 2026-11-03 ユーザーが画面で試して決めた値（ボタン 0.5秒／離したあと 0.5秒）
export const DEFAULT_ROTATE_TUNING: RotateTuning = { buttonMs: 500, releaseMinMs: 500, releaseMaxMs: 500 };

/** 開発者画面のつまみの範囲（buttonMs のつまみは回転ボタンと一緒に外したが、保存された値を読むときの範囲として使う） */
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
  /** つかんで運ぶ向きが切り替わったとき、4個を逆向きへ移す時間（ms） */
  carryFlipMs: 110,
  /** 回しかけを元に戻す時間（ms） */
  springBackMs: 140,
};

/**
 * 指を離したあと、残りを回しきる時間（ms）。残りの弧の長さを指の速さで割り、残りの割合に応じた下限・上限で挟む。
 * ms は回す動きの基準の時間（buttonMs。演出 ×2 なら半分）で、同じ割合で縮める
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
  // ── 2026-11-05 残りの9人（仕様書 12.8） ──
  /** 2回攻撃（ふたご座）：通常の攻撃が2回当たり、合わせてこの倍（1回は弱いが必ず2回） */
  twinTotal: 1.2,
  /** 毒（さそり座）：攻撃したターンから、そのターンのダメージのこの割合を、poisonTurns ターン（攻撃したターンを含む）ターンの終わりに与える。重ねがけは強い方で上書き */
  poisonRatio: 0.3,
  poisonTurns: 3,
  /** 遠距離（いて座）：上から2段（0〜1行目）で消えた自分の色1個ごとに、この割合ぶん強くする */
  farRows: 2,
  farBonus: 0.5,
  /** 均衡（てんびん座）：同じ段にほかの色が消えたら、1色ごとにこの割合ぶん強くする */
  balancePerColor: 0.25,
  /** 溜め（やぎ座）：自分の色が消えなかったターンごとに1つ溜まり（最大 chargeMax）、次に攻撃した段で 1つにつきこの割合ぶん強くなる */
  chargeStep: 0.5,
  chargeMax: 3,
  /** 渦（うお座）：2段目以降の連鎖で攻撃するたびに、そのダメージのこの割合だけ回復もする */
  vortexHeal: 0.2,
  /** 盾（かに座）：回復したターンの敵の攻撃を、この割合だけ減らす */
  shieldCut: 0.3,
  /** 大回復（おとめ座）：ピンクを一度に4個以上消すと、その段の回復をこの倍に */
  bigHealMin: 4,
  bigHealMultiplier: 1.5,
  /** 恵みの雨（みずがめ座）：回復したら、その量のこの割合を、次の rainTurns ターンのあいだ毎ターン回復する */
  rainRatio: 0.3,
  rainTurns: 2,
};

/**
 * 防御力（仕様書 12.11。2026-11-04 ユーザーの決定：割合で減らす）。
 * 受けるダメージ = 敵の攻撃 × base ÷（base ＋ 仲間の防御力の合計）。四捨五入して最低 1
 */
// 2026-11-07 キャラの防御力を10倍にしたので、base も10倍（減り方は変わらない）
export const DEFENSE = { base: 1000 };

export function damageTaken(attack: number, partyDefense: number): number {
  return Math.max(1, Math.round((attack * DEFENSE.base) / (DEFENSE.base + Math.max(0, partyDefense))));
}

/** 敵の色の弱点・耐性（仕様書 12.11。2026-11-04 ユーザーの決定）。攻撃（通常・必殺）にかけ、回復にはかけない */
export const WEAKNESS = { weak: 1.5, resist: 0.7 };

/** 3回回しきったら、少し待ってから自動で「攻撃」する（ms。演出 ×2 なら半分）。最後の盤面と光る印を見せるための間（2026-11-04 ユーザーの要望） */
export const AUTO_ATTACK_DELAY_MS = 350;

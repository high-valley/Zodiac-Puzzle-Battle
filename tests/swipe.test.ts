import { describe, expect, it } from 'vitest';
import { DEFAULT_ROTATE_TUNING, releaseDuration, ROTATE_ANIM, SWIPE } from '../src/data/balance';
import { advanceDial, angleAround, clampTurns, isAmbiguousPress, nearestIntersection, pickByDrag, pickIntersection, releaseSteps, toTurns, wrapAngle } from '../src/input/swipe';
import { DEFAULT_SETTINGS, parseRotateTuning, rotateTuningOf } from '../src/storage/settings';

describe('nearestIntersection', () => {
  const cell = 60;

  it('交点の中心を押すとその交点（16か所）', () => {
    for (let r = 0; r <= 3; r++) {
      for (let c = 0; c <= 3; c++) {
        expect(nearestIntersection((c + 1) * cell, (r + 1) * cell, cell)).toEqual({ row: r, col: c });
      }
    }
  });

  it('交点から少しずれても、いちばん近い交点を選ぶ', () => {
    expect(nearestIntersection(cell + 25, cell * 2 - 25, cell)).toEqual({ row: 1, col: 0 });
    expect(nearestIntersection(cell + 31, cell * 2 - 29, cell)).toEqual({ row: 1, col: 1 });
  });

  it('盤面の端や角を押しても、端の交点に収まる', () => {
    expect(nearestIntersection(0, 0, cell)).toEqual({ row: 0, col: 0 });
    expect(nearestIntersection(cell * 5, cell * 5, cell)).toEqual({ row: 3, col: 3 });
    expect(nearestIntersection(-10, cell * 9, cell)).toEqual({ row: 3, col: 0 });
  });
});

describe('指で回す（つまみを回すように。2026-11-04）', () => {
  const cell = 60;
  const at = { row: 1, col: 1 }; // 中心は (120, 120)

  it('角度は右が 0 で、時計回りに増える（画面は下が正）', () => {
    expect(angleAround(180, 120, cell, at).angle).toBe(0);
    expect(Math.abs(angleAround(120, 180, cell, at).angle - Math.PI / 2) < 1e-9).toBe(true);
    expect(angleAround(150, 160, cell, at).r).toBe(50);
  });

  it('角度の差は -π〜π にして足す（真後ろを回りこんでも飛ばない）', () => {
    expect(Math.abs(wrapAngle(3 * Math.PI / 2) - -Math.PI / 2) < 1e-9).toBe(true);
    expect(Math.abs(wrapAngle(-3 * Math.PI / 2) - Math.PI / 2) < 1e-9).toBe(true);
    expect(wrapAngle(0.2)).toBe(0.2);
    expect(toTurns(Math.PI)).toBe(2);
  });

  it('回せる量は残りの回数まで', () => {
    expect(clampTurns(2.7, 3)).toBe(2.7);
    expect(clampTurns(3.4, 3)).toBe(3);
    expect(clampTurns(-1.5, 1)).toBe(-1);
    expect(clampTurns(0.5, 0)).toBe(0);
  });

  it('離したとき：半分（45度）を超えていれば回しきり、届かなければ元に戻す', () => {
    expect(releaseSteps(0.49, 0, 40)).toBe(0);
    // ちょうど45度は戻す（仕様書 6.1「45度より多く」）
    expect(releaseSteps(0.5, 0, 40)).toBe(0);
    expect(releaseSteps(0.51, 0, 40)).toBe(1);
    expect(releaseSteps(-0.6, 0, 40)).toBe(-1);
    // 続けて回したとき：90度ごとに1回
    expect(releaseSteps(1.3, 0, 120)).toBe(1);
    expect(releaseSteps(1.6, 0, 120)).toBe(2);
    expect(releaseSteps(-2.55, 0, 200)).toBe(-3);
  });

  it('速く払ったときは、少し回していれば回しきる（ただし短すぎる動きや、逆向きの速さでは回さない）', () => {
    expect(releaseSteps(0.2, SWIPE.flickSpeed, SWIPE.minDistance)).toBe(1);
    expect(releaseSteps(0.2, SWIPE.flickSpeed, SWIPE.minDistance - 1)).toBe(0);
    expect(releaseSteps(0.2, -SWIPE.flickSpeed, 40)).toBe(0);
    expect(releaseSteps(-0.2, -SWIPE.flickSpeed, 40)).toBe(-1);
    expect(releaseSteps(0.1, SWIPE.flickSpeed * 3, 40)).toBe(0);
  });
});

describe('releaseDuration（指を離したあと回しきる時間）', () => {
  const cell = 71.6; // 390px 幅の端末
  const p22 = 0.3; // 回し始めで離したときの位置

  it('ゆっくり離すと長く、速く払うと短い（どちらも下限・上限の中）', () => {
    const t = { ...DEFAULT_ROTATE_TUNING, releaseMinMs: 400, releaseMaxMs: 560 };
    const ms = t.buttonMs;
    const slow = releaseDuration(p22, 0.05, cell, ms, t);
    const fast = releaseDuration(p22, 5, cell, ms, t);
    expect(slow > fast).toBe(true);
    const scale = (1 - p22) / ROTATE_ANIM.releaseRefRemaining;
    expect(Math.abs(slow - t.releaseMaxMs * scale) <= 1).toBe(true);
    expect(Math.abs(fast - t.releaseMinMs * scale) <= 1).toBe(true);
  });

  it('既定の値（2026-11-03 ユーザーが決めた値）：閾値ちょうどで離すと約0.5秒', () => {
    expect(DEFAULT_ROTATE_TUNING).toEqual({ buttonMs: 500, releaseMinMs: 500, releaseMaxMs: 500 });
    const d = releaseDuration(p22, 1, cell);
    expect(d >= 450 && d <= 560).toBe(true);
  });

  it('90 度まで回しきって離したら、待たない', () => {
    expect(releaseDuration(1, 1, cell)).toBe(0);
  });

  it('演出 ×2 では半分', () => {
    const half = releaseDuration(p22, 0.05, cell, DEFAULT_ROTATE_TUNING.buttonMs / 2);
    expect(Math.abs(half - releaseDuration(p22, 0.05, cell) / 2) <= 1).toBe(true);
  });
});

describe('回す動きの速さの調整（開発者画面）', () => {
  it('保存した値を読む。範囲の外や足りない項目は設定データの値', () => {
    expect(parseRotateTuning(null)).toBeNull();
    expect(parseRotateTuning({ buttonMs: 900 })).toEqual({ ...DEFAULT_ROTATE_TUNING, buttonMs: 900 });
    expect(parseRotateTuning({ buttonMs: 99999, releaseMinMs: 'x' })).toEqual(DEFAULT_ROTATE_TUNING);
    expect(rotateTuningOf({ ...DEFAULT_SETTINGS, devRotate: null })).toEqual(DEFAULT_ROTATE_TUNING);
    expect(rotateTuningOf({ ...DEFAULT_SETTINGS, devRotate: { ...DEFAULT_ROTATE_TUNING, buttonMs: 1200 } }).buttonMs).toBe(1200);
  });

  it('時間を長くすると、指を離したあとも長くなる', () => {
    const slowT = { ...DEFAULT_ROTATE_TUNING, releaseMinMs: 800, releaseMaxMs: 1200 };
    expect(releaseDuration(0.3, 5, 71.6, DEFAULT_ROTATE_TUNING.buttonMs, slowT)).toBe(800);
    // 下限が上限より大きいときは下限に合わせる
    const odd = { ...DEFAULT_ROTATE_TUNING, releaseMinMs: 900, releaseMaxMs: 300 };
    expect(releaseDuration(0.3, 0.01, 71.6, DEFAULT_ROTATE_TUNING.buttonMs, odd)).toBe(900);
  });
});

describe('pickIntersection（押した位置で選ぶ交点。2026-11-03）', () => {
  const cell = 60;
  const cur = { row: 1, col: 1 }; // 交点の中心は (120, 120)

  it('選んでいる 2×2 の4個の上なら、外側の縁でも隣に移らない', () => {
    for (const [gx, gy] of [[0.5, 0.5], [-0.5, 0.5], [0.95, 0.5], [-0.5, -0.95], [0.6, 0], [0.4, -0.95]]) {
      expect(pickIntersection(120 + gx * cell, 120 + gy * cell, cell, cur)).toEqual(cur);
    }
  });

  it('ただし、ほかの交点の星の近く（0.3 マス以内）なら、そちらに移る', () => {
    expect(pickIntersection(120 + 0.9 * cell, 120 + 0.9 * cell, cell, cur)).toEqual({ row: 2, col: 2 });
    expect(pickIntersection(120 - 0.8 * cell, 120 - 0.1 * cell, cell, cur)).toEqual({ row: 1, col: 0 });
  });

  it('選んでいる交点の近く（縦横とも 0.8 マス以内）を押しても、隣に移らない', () => {
    // いちばん近いのは (1,2) だが、選んでいる (1,1) のまま
    expect(pickIntersection(120 + 0.7 * cell, 120, cell, cur)).toEqual(cur);
    expect(pickIntersection(120 - 0.7 * cell, 120 + 0.7 * cell, cell, cur)).toEqual(cur);
  });

  it('隣の交点の近くを押せば、そちらを選ぶ', () => {
    expect(pickIntersection(120 + cell, 120, cell, cur)).toEqual({ row: 1, col: 2 });
    expect(pickIntersection(120 + 0.85 * cell, 120, cell, cur)).toEqual({ row: 1, col: 2 });
    expect(pickIntersection(120, 120 - cell, cell, cur)).toEqual({ row: 0, col: 1 });
  });

  it('何も選んでいなければ、いちばん近い交点', () => {
    expect(pickIntersection(120 + 0.7 * cell, 120, cell, null)).toEqual({ row: 1, col: 2 });
  });

  it('隣の交点の真上を押せば、必ずそちらに移れる（選び直せなくならない）', () => {
    for (let r = 0; r <= 3; r++) {
      for (let c = 0; c <= 3; c++) {
        expect(pickIntersection((c + 1) * cell, (r + 1) * cell, cell, cur)).toEqual({ row: r, col: c });
      }
    }
  });

  it('端の交点を選んでいるときも、隣に移れる', () => {
    expect(pickIntersection(cell * 1.7, cell, cell, { row: 0, col: 0 })).toEqual({ row: 0, col: 0 });
    expect(pickIntersection(cell * 2, cell, cell, { row: 0, col: 0 })).toEqual({ row: 0, col: 1 });
    expect(pickIntersection(cell * 4, cell * 3, cell, { row: 3, col: 3 })).toEqual({ row: 2, col: 3 });
    expect(pickIntersection(cell * 5, cell * 5, cell, { row: 3, col: 3 })).toEqual({ row: 3, col: 3 });
  });
});



describe('advanceDial（指の角度から回した量を足す。2026-11-04）', () => {
  const deg = (d: number) => (d * Math.PI) / 180;
  // 小数の誤差をならして比べる
  const near = (x: number) => Math.round(x * 1e6) / 1e6;
  // 角度の並びを順に入れて、最後の回した量を返す
  const run = (angles: (number | null)[], remaining = 3, moved = 40) =>
    angles.reduce((s, a) => advanceDial(s, a === null ? null : deg(a), moved, remaining), { q: 0, lastAngle: null as number | null }).q;

  it('時計回りに90度描くと1回分、逆なら -1', () => {
    expect(near(run([0, 30, 60, 90]))).toBe(near(1));
    expect(near(run([0, -45, -90]))).toBe(near(-1));
  });

  it('±180度をまたいでも、ひと続きに足す', () => {
    expect(near(run([150, 170, -170, -150]))).toBe(near(60 / 90));
    expect(near(run([-150, -170, 170, 150]))).toBe(near(-60 / 90));
  });

  it('中心を通るあいだ（角度が読めない）は回さず、通りすぎたら基準を取り直す', () => {
    expect(near(run([0, 45, null, 200, 245]))).toBe(near(1));
  });

  it('残りの回数で止まり、そこから逆へ回せばすぐ戻る', () => {
    expect(near(run([0, 90, 180, 270], 2))).toBe(near(2));
    expect(near(run([0, 90, 180, 270, 225], 2))).toBe(near(1.5));
  });

  it('動きが小さいあいだ（dragDeadZone 未満）は回さない', () => {
    expect(run([0, 30, 60], 3, SWIPE.dragDeadZone - 1)).toBe(0);
  });
});

describe('古い保存設定の互換', () => {
  it('前の版の「指に付いて回る角度」（dragMaxP）が残っていても読める', () => {
    expect(parseRotateTuning({ ...DEFAULT_ROTATE_TUNING, dragMaxP: 1 })).toEqual(DEFAULT_ROTATE_TUNING);
  });
});

// 2026-11-12：オーブをつかむたびに、動かした向きにある 2×2 を選び直す（仕様書 6.2）
describe('動かした向きで 2×2 を決める', () => {
  const C = 100; // 1マス 100px。オーブ (行2, 列2) は x・y とも 200〜300、まんなかは (250, 250)

  it('交点の星の近くだけ、押した瞬間に決める。オーブの上は、選んである 2×2 の上でも向きで決め直す', () => {
    expect(isAmbiguousPress(250, 250, C)).toBe(true);
    expect(isAmbiguousPress(250, 215, C)).toBe(true);
    expect(isAmbiguousPress(215, 215, C)).toBe(false); // 交点 (200,200) の星の近く
  });

  it('動かした向きの側の 2×2 になる（オーブのどこを押しても、ゆっくりでも）', () => {
    for (let ox = 5; ox < 100; ox += 5) {
      for (let oy = 5; oy < 100; oy += 5) {
        for (const d of [30, 31, 33, 60]) {
          expect(pickByDrag(200 + ox, 200 + oy, 200 + ox + d, 200 + oy, C).col).toBe(2);
          expect(pickByDrag(200 + ox, 200 + oy, 200 + ox - d, 200 + oy, C).col).toBe(1);
          expect(pickByDrag(200 + ox, 200 + oy, 200 + ox, 200 + oy + d, C).row).toBe(2);
          expect(pickByDrag(200 + ox, 200 + oy, 200 + ox, 200 + oy - d, C).row).toBe(1);
        }
      }
    }
  });

  it('ななめに動かすと、その向きにある 2×2（左下へ動かせば左下）', () => {
    expect(pickByDrag(250, 250, 225, 275, C)).toEqual({ row: 2, col: 1 }); // 左下
    expect(pickByDrag(250, 250, 275, 275, C)).toEqual({ row: 2, col: 2 }); // 右下
    expect(pickByDrag(250, 250, 225, 225, C)).toEqual({ row: 1, col: 1 }); // 左上
    expect(pickByDrag(250, 250, 275, 225, C)).toEqual({ row: 1, col: 2 }); // 右上
    // 下へ動かしながら少し左へ寄せても、左下
    expect(pickByDrag(250, 250, 238, 285, C)).toEqual({ row: 2, col: 1 });
  });

  it('右の 2×2 を選んであっても、同じオーブを左下へ動かせば左下の 2×2 に移る（ユーザーの報告の場面）', () => {
    const right = { row: 2, col: 2 };
    expect(pickByDrag(250, 250, 225, 275, C, right)).toEqual({ row: 2, col: 1 });
    expect(pickByDrag(250, 250, 220, 250, C, right).col).toBe(1);
  });

  it('まっすぐ運んだときだけ、選んである 2×2 が進む向きの側にあればそれ。向きを寄せれば移る', () => {
    const lowerRight = { row: 2, col: 2 };
    expect(pickByDrag(250, 240, 285, 240, C, lowerRight)).toEqual(lowerRight); // 上寄りを押しても選んだまま
    expect(pickByDrag(250, 250, 285, 246, C, lowerRight)).toEqual(lowerRight); // ごくわずかなぶれでは移らない
    // 上へ寄せたら、右上の 2×2 に移る
    expect(pickByDrag(250, 250, 285, 240, C, lowerRight)).toEqual({ row: 1, col: 2 });
    // 下へ運びながら少し左へ寄せたら、左下の 2×2 に移る
    expect(pickByDrag(250, 250, 242, 285, C, lowerRight)).toEqual({ row: 2, col: 1 });
  });

  it('選んでいないとき、まっすぐ運ぶと押した所に近い方（まんなかは下・右）', () => {
    expect(pickByDrag(250, 262, 285, 262, C)).toEqual({ row: 2, col: 2 });
    expect(pickByDrag(250, 238, 285, 238, C)).toEqual({ row: 1, col: 2 });
    expect(pickByDrag(250, 250, 285, 250, C)).toEqual(nearestIntersection(250, 250, C));
  });

  it('盤面の端・角のオーブは、盤面の中の 2×2 だけから選ぶ', () => {
    expect(pickByDrag(50, 50, 50, 15, C)).toEqual({ row: 0, col: 0 });
    expect(pickByDrag(450, 450, 485, 450, C)).toEqual({ row: 3, col: 3 });
    expect(pickByDrag(50, 250, 20, 280, C)).toEqual({ row: 2, col: 0 }); // 左端のオーブを左下へ → 左は無いので右側の下
  });
});

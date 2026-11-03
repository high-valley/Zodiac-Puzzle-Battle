import { describe, expect, it } from 'vitest';
import { releaseDuration, ROTATE_ANIM, SWIPE } from '../src/data/balance';
import { classifySwipe, nearestIntersection, swipeAlong } from '../src/input/swipe';

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

describe('classifySwipe', () => {
  it('右へ閾値以上 → 時計回り、左へ → 反時計回り', () => {
    expect(classifySwipe(SWIPE.minDistance, 0)).toEqual({ kind: 'rotate', direction: 'clockwise' });
    expect(classifySwipe(-SWIPE.minDistance, 0)).toEqual({ kind: 'rotate', direction: 'counterclockwise' });
    expect(classifySwipe(80, 20)).toEqual({ kind: 'rotate', direction: 'clockwise' });
  });

  it('閾値未満の移動は回転せず選択だけ', () => {
    expect(classifySwipe(SWIPE.minDistance - 1, 0)).toEqual({ kind: 'select' });
    expect(classifySwipe(0, 0)).toEqual({ kind: 'select' });
    expect(classifySwipe(-10, 10)).toEqual({ kind: 'select' });
    // 斜めの合計距離が閾値を超えても、縦横どちらも閾値未満なら選択だけ
    expect(classifySwipe(21, 8)).toEqual({ kind: 'select' });
    expect(classifySwipe(-18, 18)).toEqual({ kind: 'select' });
  });

  it('下へ閾値以上 → 時計回り、上へ → 反時計回り（2026-11-03）', () => {
    expect(classifySwipe(0, SWIPE.minDistance)).toEqual({ kind: 'rotate', direction: 'clockwise' });
    expect(classifySwipe(0, -SWIPE.minDistance)).toEqual({ kind: 'rotate', direction: 'counterclockwise' });
    expect(classifySwipe(20, 80)).toEqual({ kind: 'rotate', direction: 'clockwise' });
    expect(classifySwipe(0, SWIPE.minDistance - 1)).toEqual({ kind: 'select' });
  });

  it('斜め（横と縦が同じくらい）の大きな動きはキャンセル', () => {
    // |dx| = 1.2 × |dy| ちょうどは横と見なさない（縦も同じ）
    expect(classifySwipe(36, 30)).toEqual({ kind: 'cancel' });
    expect(classifySwipe(30, 36)).toEqual({ kind: 'cancel' });
    expect(classifySwipe(-30, -30)).toEqual({ kind: 'cancel' });
  });
});

describe('swipeAlong（指に合わせて回すときの向き）', () => {
  it('横か縦の大きいほうに沿った動き。斜めは null', () => {
    expect(swipeAlong(30, 5)).toEqual({ along: 30, axis: 'x' });
    expect(swipeAlong(-3, -40)).toEqual({ along: -40, axis: 'y' });
    expect(swipeAlong(20, 20)).toBeNull();
    expect(swipeAlong(3, 0)).toBeNull();
  });

  it('境界：遊びちょうどと、比率ちょうどは null', () => {
    expect(swipeAlong(SWIPE.dragDeadZone, 0)).toBeNull();
    expect(swipeAlong(0, SWIPE.dragDeadZone)).toBeNull();
    expect(swipeAlong(30, 36)).toBeNull();
    expect(swipeAlong(36, 30)).toBeNull();
  });

  it('classifySwipe が回すと決めたとき、swipeAlong の向き（正＝時計回り）と必ず一致する', () => {
    for (let dx = -120; dx <= 120; dx += 1.5) {
      for (let dy = -120; dy <= 120; dy += 1.5) {
        const r = classifySwipe(dx, dy);
        if (r.kind !== 'rotate') continue;
        const s = swipeAlong(dx, dy);
        expect(s !== null).toBe(true);
        expect(s!.along > 0 ? 'clockwise' : 'counterclockwise').toBe(r.direction);
      }
    }
  });
});

describe('releaseDuration（指を離したあと回しきる時間）', () => {
  const cell = 71.6; // 390px 幅の端末
  const p22 = (22 - SWIPE.dragDeadZone) / (cell * SWIPE.dragCellsPer90); // 閾値ちょうどで離したときの位置

  it('ゆっくり離すと長く、速く払うと短い（どちらも下限・上限の中）', () => {
    const slow = releaseDuration(p22, 0.05, cell);
    const fast = releaseDuration(p22, 5, cell);
    expect(slow > fast).toBe(true);
    const scale = (1 - p22) / ROTATE_ANIM.releaseRefRemaining;
    expect(Math.abs(slow - ROTATE_ANIM.releaseMaxMs * scale) <= 1).toBe(true);
    expect(Math.abs(fast - ROTATE_ANIM.releaseMinMs * scale) <= 1).toBe(true);
    expect(fast >= 300).toBe(true);
  });

  it('90 度まで回しきって離したら、待たない', () => {
    expect(releaseDuration(1, 1, cell)).toBe(0);
  });

  it('演出 ×2 では半分', () => {
    const half = releaseDuration(p22, 0.05, cell, ROTATE_ANIM.buttonMs / 2);
    expect(Math.abs(half - releaseDuration(p22, 0.05, cell) / 2) <= 1).toBe(true);
  });
});

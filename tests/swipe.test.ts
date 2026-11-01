import { describe, expect, it } from 'vitest';
import { SWIPE } from '../src/data/balance';
import { classifySwipe, nearestIntersection } from '../src/input/swipe';

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

  it('縦寄りの大きな動きはキャンセル', () => {
    expect(classifySwipe(0, 60)).toEqual({ kind: 'cancel' });
    // |dx| = 1.2 × |dy| ちょうどは水平と見なさない
    expect(classifySwipe(36, 30)).toEqual({ kind: 'cancel' });
    expect(classifySwipe(-30, -30)).toEqual({ kind: 'cancel' });
  });
});

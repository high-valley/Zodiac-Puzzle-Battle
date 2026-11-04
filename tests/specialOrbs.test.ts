import { describe, expect, it } from 'vitest';
import { specialOrbsHtml } from '../src/components/specialPreview';
import { HEROES } from '../src/data/heroes';
import { SHAPES } from '../src/game/specials';
import type { HeroId } from '../src/game/types';

// 必殺の形を本物のオーブで並べる図（バトル画面の下。2026-11-04）。判定に使う形の基本の向きと同じ並びになっていること
describe('specialOrbsHtml（必殺の形の図）', () => {
  for (const id of Object.keys(HEROES) as HeroId[]) {
    it(`${HEROES[id].name}：形のマスだけ、その色のオーブ`, () => {
      const { color, shape } = HEROES[id].special;
      const cells = SHAPES[shape][0];
      const rows = Math.max(...cells.map(([r]) => r)) + 1;
      const cols = Math.max(...cells.map(([, c]) => c)) + 1;
      const html = specialOrbsHtml(id);
      const marks = [...html.matchAll(/class="(mini-orb orb-\w+|mini-dot)"/g)].map((m) => m[1]);
      expect(marks.length).toBe(rows * cols);
      const lit = new Set(cells.map(([r, c]) => r * cols + c));
      marks.forEach((m, i) => expect(m).toBe(lit.has(i) ? `mini-orb orb-${color}` : 'mini-dot'));
      expect(html.includes(`--rows:${rows};--cols:${cols}`)).toBe(true);
    });
  }
});

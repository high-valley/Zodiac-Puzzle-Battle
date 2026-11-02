// 選んでいるキャラの必殺の形を、3×3 の星図として見せる
import { HEROES } from '../data/heroes';
import { SHAPES, SHAPE_LABEL } from '../game/specials';
import type { HeroId } from '../game/types';
import { ORB_LABEL } from './board';
import { shapeLinks } from './shapeLinks';


export function specialPreviewSvg(heroId: HeroId): string {
  const { color, shape, name } = HEROES[heroId].special;
  const cells = SHAPES[shape][0];
  // 形の大きさに合わせた正方形のマス目（3×3 より小さくはしない。一直線5個なら 5×5）
  const size = Math.max(3, ...cells.map(([r, c]) => Math.max(r, c) + 1));
  const offR = Math.floor((size - (Math.max(...cells.map(([r]) => r)) + 1)) / 2);
  const offC = Math.floor((size - (Math.max(...cells.map(([, c]) => c)) + 1)) / 2);
  const placed = cells.map(([r, c]) => [r + offR, c + offC] as const);
  const lit = new Set(placed.map(([r, c]) => `${r},${c}`));
  const step = 60 / size;
  const pos = (v: number) => step / 2 + v * step;
  const dot = Math.min(6, step * 0.32);
  const lines = shapeLinks(placed.map(([row, col]) => ({ row, col }))).map(
    ([a, b]) => `<line x1="${pos(a.col)}" y1="${pos(a.row)}" x2="${pos(b.col)}" y2="${pos(b.row)}"/>`,
  );
  const dots: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      dots.push(
        lit.has(`${r},${c}`)
          ? `<circle class="lit orb-fill-${color}" cx="${pos(c)}" cy="${pos(r)}" r="${dot}"/>`
          : `<circle class="dim" cx="${pos(c)}" cy="${pos(r)}" r="${Math.min(2, dot / 3)}"/>`,
      );
    }
  }
  const label = `必殺「${name}」：${ORB_LABEL[color]}の${SHAPE_LABEL[shape]}`;
  return `<svg viewBox="0 0 60 60" role="img" aria-label="${label}"><g class="links">${lines.join('')}</g>${dots.join('')}</svg>`;
}

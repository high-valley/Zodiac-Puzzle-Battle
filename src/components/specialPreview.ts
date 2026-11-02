// 選んでいるキャラの必殺の形を、3×3 の星図として見せる
import { HEROES } from '../data/heroes';
import { SHAPES } from '../game/specials';
import type { HeroId } from '../game/types';
import { ORB_LABEL } from './board';
import { shapeLinks } from './shapeLinks';

const SHAPE_LABEL = { L: 'L字', cross: '十字', square: '2×2' } as const;

export function specialPreviewSvg(heroId: HeroId): string {
  const { color, shape, name } = HEROES[heroId].special;
  const cells = SHAPES[shape][0];
  const lit = new Set(cells.map(([r, c]) => `${r},${c}`));
  const pos = (v: number) => 10 + v * 20;
  const lines = shapeLinks(cells.map(([row, col]) => ({ row, col }))).map(
    ([a, b]) => `<line x1="${pos(a.col)}" y1="${pos(a.row)}" x2="${pos(b.col)}" y2="${pos(b.row)}"/>`,
  );
  const dots: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      dots.push(
        lit.has(`${r},${c}`)
          ? `<circle class="lit orb-fill-${color}" cx="${pos(c)}" cy="${pos(r)}" r="6"/>`
          : `<circle class="dim" cx="${pos(c)}" cy="${pos(r)}" r="2"/>`,
      );
    }
  }
  const label = `必殺「${name}」：${ORB_LABEL[color]}の${SHAPE_LABEL[shape]}`;
  return `<svg viewBox="0 0 60 60" role="img" aria-label="${label}"><g class="links">${lines.join('')}</g>${dots.join('')}</svg>`;
}

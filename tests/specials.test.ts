import { describe, expect, it } from 'vitest';
import { shapeLinks } from '../src/components/shapeLinks';
import { SHAPES, detectHeroSpecial } from '../src/game/specials';
import type { SpecialShape } from '../src/game/types';
import { QUIET_ROWS, parseBoard } from './helpers';

// 形の判定だけを見るときの背景（調べる色を含まない。通常マッチは判定に関係しない）
const GREEN = ['GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG'];

/** 背景に、指定した位置だけ色を置いた盤面 */
function boardWith(cells: [number, number][], ch: string, base = GREEN) {
  const rows = base.map((line) => line.split(''));
  for (const [r, c] of cells) rows[r][c] = ch;
  return parseBoard(rows.map((line) => line.join('')));
}

function shift(offsets: readonly (readonly [number, number])[], dr: number, dc: number): [number, number][] {
  return offsets.map(([r, c]) => [r + dr, c + dc]);
}

const size = (o: readonly (readonly [number, number])[]) => ({
  h: Math.max(...o.map(([r]) => r)) + 1,
  w: Math.max(...o.map(([, c]) => c)) + 1,
});

describe('必殺の形の定義', () => {
  it('どの形も、縦横に3個並ぶところを含まない（含むと通常マッチで先に消えて組み立てられない）', () => {
    for (const shape of Object.keys(SHAPES) as SpecialShape[]) {
      for (const o of SHAPES[shape]) {
        const set = new Set(o.map(([r, c]) => `${r},${c}`));
        for (const [r, c] of o) {
          expect(set.has(`${r},${c + 1}`) && set.has(`${r},${c + 2}`)).toBeFalsy();
          expect(set.has(`${r + 1},${c}`) && set.has(`${r + 2},${c}`)).toBeFalsy();
        }
      }
    }
  });

  it('角は5個で4方向、×字は5個、2×2は4個。どれも 3×3 に収まる', () => {
    expect(SHAPES.horns).toHaveLength(4);
    expect(SHAPES.x).toHaveLength(1);
    expect(SHAPES.square).toHaveLength(1);
    for (const o of SHAPES.horns) expect(o).toHaveLength(5);
    expect(SHAPES.x[0]).toHaveLength(5);
    expect(SHAPES.square[0]).toHaveLength(4);
    for (const shape of Object.keys(SHAPES) as SpecialShape[]) {
      for (const o of SHAPES[shape]) {
        const { h, w } = size(o);
        expect(h <= 3 && w <= 3).toBeTruthy();
      }
    }
  });

  it('角の4方向は、90度ずつ回したすべて違う配置（角が上・右・下・左）', () => {
    const asText = SHAPES.horns.map((o) =>
      [0, 1, 2].map((r) => [0, 1, 2].map((c) => (o.some(([a, b]) => a === r && b === c) ? '●' : '・')).join('')),
    );
    expect(asText).toEqual([
      ['●・●', '●・●', '・●・'],
      ['・●●', '●・・', '・●●'],
      ['・●・', '●・●', '●・●'],
      ['●●・', '・・●', '●●・'],
    ]);
  });
});

describe('detectHeroSpecial', () => {
  it('静かな盤面ではどのキャラの必殺も出ない', () => {
    const board = parseBoard(QUIET_ROWS);
    expect(detectHeroSpecial(board, 'aries')).toBeNull();
    expect(detectHeroSpecial(board, 'sagittarius')).toBeNull();
    expect(detectHeroSpecial(board, 'virgo')).toBeNull();
  });

  it('おひつじ座：赤の角を4方向とも、盤面のどこでも見つける', () => {
    for (const o of SHAPES.horns) {
      const { h, w } = size(o);
      for (let dr = 0; dr + h <= 5; dr++) {
        for (let dc = 0; dc + w <= 5; dc++) {
          const cells = shift(o, dr, dc);
          const result = detectHeroSpecial(boardWith(cells, 'R'), 'aries');
          expect(result).not.toBeNull();
          expect(result!.shape).toBe('horns');
          expect(result!.cells).toHaveLength(5);
          result!.cells.forEach((p) => expect(cells.some(([r, c]) => r === p.row && c === p.col)).toBeTruthy());
        }
      }
    }
  });

  it('おひつじ座：角の1個が欠ける・別の色なら出ない', () => {
    const cells = shift(SHAPES.horns[0], 1, 1);
    for (let i = 0; i < cells.length; i++) {
      expect(detectHeroSpecial(boardWith(cells.filter((_, j) => j !== i), 'R'), 'aries')).toBeNull();
    }
    expect(detectHeroSpecial(boardWith(cells, 'B'), 'aries')).toBeNull();
  });

  it('いて座：青の×字を盤面のどこでも見つける', () => {
    for (let dr = 0; dr <= 2; dr++) {
      for (let dc = 0; dc <= 2; dc++) {
        const result = detectHeroSpecial(boardWith(shift(SHAPES.x[0], dr, dc), 'B'), 'sagittarius');
        expect(result).not.toBeNull();
        expect(result!.shape).toBe('x');
      }
    }
    expect(detectHeroSpecial(boardWith(shift(SHAPES.x[0], 0, 0), 'R'), 'sagittarius')).toBeNull();
    // 中央が欠けたら出ない
    const noCenter = shift(SHAPES.x[0], 1, 1).filter(([r, c]) => !(r === 2 && c === 2));
    expect(detectHeroSpecial(boardWith(noCenter, 'B'), 'sagittarius')).toBeNull();
  });

  it('おとめ座：ピンク2×2を16か所どこでも見つける', () => {
    for (let r = 0; r <= 3; r++) {
      for (let c = 0; c <= 3; c++) {
        const result = detectHeroSpecial(boardWith(shift(SHAPES.square[0], r, c), 'P'), 'virgo');
        expect(result).not.toBeNull();
        expect(result!.cells).toEqual([
          { row: r, col: c },
          { row: r, col: c + 1 },
          { row: r + 1, col: c },
          { row: r + 1, col: c + 1 },
        ]);
      }
    }
  });

  it('ほかのキャラの形があっても、選んだキャラの必殺にはならない', () => {
    const redHorns = boardWith(shift(SHAPES.horns[0], 0, 0), 'R');
    expect(detectHeroSpecial(redHorns, 'sagittarius')).toBeNull();
    expect(detectHeroSpecial(redHorns, 'virgo')).toBeNull();
    const blueX = boardWith(shift(SHAPES.x[0], 0, 0), 'B');
    expect(detectHeroSpecial(blueX, 'aries')).toBeNull();
    expect(detectHeroSpecial(blueX, 'virgo')).toBeNull();
    const pinkSquare = boardWith(shift(SHAPES.square[0], 0, 0), 'P');
    expect(detectHeroSpecial(pinkSquare, 'aries')).toBeNull();
    expect(detectHeroSpecial(pinkSquare, 'sagittarius')).toBeNull();
  });
});

describe('形を結ぶ線（画面の演出用）', () => {
  const pos = (o: readonly (readonly [number, number])[]) => o.map(([row, col]) => ({ row, col }));
  const asText = (links: ReturnType<typeof shapeLinks>) =>
    links.map(([a, b]) => `${a.row}${a.col}-${b.row}${b.col}`).sort();

  it('2×2は四角だけ（中に斜めの線を引かない）', () => {
    expect(asText(shapeLinks(pos(SHAPES.square[0])))).toEqual(['00-01', '00-10', '01-11', '10-11']);
  });

  it('×字は中央から斜めの4本', () => {
    expect(asText(shapeLinks(pos(SHAPES.x[0])))).toEqual(['00-11', '02-11', '11-20', '11-22']);
  });

  it('角は2本の角と、顔へ斜めの2本', () => {
    expect(asText(shapeLinks(pos(SHAPES.horns[0])))).toEqual(['00-10', '02-12', '10-21', '12-21']);
  });

  it('どの形のどの向きも、線をたどるとすべてのオーブがつながる（線はどれも4本）', () => {
    for (const shape of Object.keys(SHAPES) as SpecialShape[]) {
      for (const o of SHAPES[shape]) {
        const links = shapeLinks(pos(o));
        expect(links).toHaveLength(4);
        const k = (p: { row: number; col: number }) => `${p.row},${p.col}`;
        const seen = new Set([k(pos(o)[0])]);
        for (let changed = true; changed; ) {
          changed = false;
          for (const [a, b] of links) {
            if (seen.has(k(a)) !== seen.has(k(b))) {
              seen.add(k(a));
              seen.add(k(b));
              changed = true;
            }
          }
        }
        expect(seen.size).toBe(o.length);
      }
    }
  });
});

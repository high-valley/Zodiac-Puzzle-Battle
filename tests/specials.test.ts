import { describe, expect, it } from 'vitest';
import { shapeLinks } from '../src/components/shapeLinks';
import { SHAPES, detectHeroSpecial } from '../src/game/specials';
import { QUIET_ROWS, parseBoard } from './helpers';

/** QUIET_ROWS に、指定した位置だけ色を置いた盤面 */
function boardWith(cells: [number, number][], ch: string, base = QUIET_ROWS) {
  const rows = base.map((line) => line.split(''));
  for (const [r, c] of cells) rows[r][c] = ch;
  return parseBoard(rows.map((line) => line.join('')));
}

function shift(offsets: readonly (readonly [number, number])[], dr: number, dc: number): [number, number][] {
  return offsets.map(([r, c]) => [r + dr, c + dc]);
}

describe('detectHeroSpecial', () => {
  it('静かな盤面ではどのキャラの必殺も出ない', () => {
    const board = parseBoard(QUIET_ROWS);
    expect(detectHeroSpecial(board, 'aries')).toBeNull();
    expect(detectHeroSpecial(board, 'sagittarius')).toBeNull();
    expect(detectHeroSpecial(board, 'virgo')).toBeNull();
  });

  it('おひつじ座：赤L字を4方向とも、盤面のどこでも見つける', () => {
    expect(SHAPES.L).toHaveLength(4);
    for (const offsets of SHAPES.L) {
      for (const [dr, dc] of [[0, 0], [2, 2], [0, 2], [2, 0], [1, 1]]) {
        const cells = shift(offsets, dr, dc);
        const result = detectHeroSpecial(boardWith(cells, 'R'), 'aries');
        expect(result).not.toBeNull();
        expect(result!.shape).toBe('L');
        expect(result!.cells).toHaveLength(5);
        result!.cells.forEach((p) => expect(cells.some(([r, c]) => r === p.row && c === p.col)).toBeTruthy());
      }
    }
  });

  it('おひつじ座：L字の1個が欠ける・別の色なら出ない', () => {
    const cells = shift(SHAPES.L[0], 1, 1);
    expect(detectHeroSpecial(boardWith(cells.slice(0, 4), 'R'), 'aries')).toBeNull();
    expect(detectHeroSpecial(boardWith(cells, 'B'), 'aries')).toBeNull();
  });

  it('いて座：青十字を見つける（端に寄せても）', () => {
    for (const [dr, dc] of [[0, 0], [2, 2], [1, 0]]) {
      const result = detectHeroSpecial(boardWith(shift(SHAPES.cross[0], dr, dc), 'B'), 'sagittarius');
      expect(result).not.toBeNull();
      expect(result!.shape).toBe('cross');
    }
    expect(detectHeroSpecial(boardWith(shift(SHAPES.cross[0], 0, 0), 'R'), 'sagittarius')).toBeNull();
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
    const redL = boardWith(shift(SHAPES.L[0], 0, 0), 'R');
    expect(detectHeroSpecial(redL, 'sagittarius')).toBeNull();
    expect(detectHeroSpecial(redL, 'virgo')).toBeNull();
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

  it('十字は中央から上下左右の4本（斜めは引かない）', () => {
    expect(asText(shapeLinks(pos(SHAPES.cross[0])))).toEqual(['01-11', '10-11', '11-12', '11-21']);
  });

  it('L字は縦と横の4本で、4方向とも同じ本数', () => {
    expect(asText(shapeLinks(pos(SHAPES.L[0])))).toEqual(['00-10', '10-20', '20-21', '21-22']);
    for (const o of SHAPES.L) expect(shapeLinks(pos(o))).toHaveLength(4);
  });
});

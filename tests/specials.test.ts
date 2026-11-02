import { describe, expect, it } from 'vitest';
import { shapeLinks } from '../src/components/shapeLinks';
import { SHAPES, detectHeroSpecial } from '../src/game/specials';
import { ALL_HEROES, HEROES } from '../src/data/heroes';
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

  it('おひつじ座：L字の5個のどれが欠けても、別の色でも出ない（4方向とも）', () => {
    for (const o of SHAPES.L) {
      const cells = shift(o, 1, 1);
      for (let i = 0; i < cells.length; i++) {
        expect(detectHeroSpecial(boardWith(cells.filter((_, j) => j !== i), 'R'), 'aries')).toBeNull();
      }
      expect(detectHeroSpecial(boardWith(cells, 'B'), 'aries')).toBeNull();
    }
  });

  it('L字の4方向は、90度ずつ回したすべて違う配置', () => {
    const asText = SHAPES.L.map((o) =>
      [0, 1, 2].map((r) => [0, 1, 2].map((c) => (o.some(([a, b]) => a === r && b === c) ? '●' : '・')).join('')),
    );
    expect(asText).toEqual([
      ['●・・', '●・・', '●●●'],
      ['●●●', '●・・', '●・・'],
      ['●●●', '・・●', '・・●'],
      ['・・●', '・・●', '●●●'],
    ]);
  });

  it('いて座：青十字を見つける（端に寄せても）', () => {
    for (const [dr, dc] of [[0, 0], [2, 2], [1, 0]]) {
      const result = detectHeroSpecial(boardWith(shift(SHAPES.cross[0], dr, dc), 'B'), 'sagittarius');
      expect(result).not.toBeNull();
      expect(result!.shape).toBe('cross');
    }
    expect(detectHeroSpecial(boardWith(shift(SHAPES.cross[0], 0, 0), 'R'), 'sagittarius')).toBeNull();
    // 5個のどれが欠けても出ない（中央も含む）
    const cells = shift(SHAPES.cross[0], 1, 1);
    for (let i = 0; i < cells.length; i++) {
      expect(detectHeroSpecial(boardWith(cells.filter((_, j) => j !== i), 'B'), 'sagittarius')).toBeNull();
    }
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

describe('12星座の形（仕様書 9.2 の図と同じか）', () => {
  // 仕様書 9.2 の図を書き写したもの（実装の定義とは別に持つ）
  const SPEC: Record<string, { rows: string[]; orientations: number }> = {
    aries: { rows: ['●・・', '●・・', '●●●'], orientations: 4 },
    taurus: { rows: ['●●●', '・●・', '・●・'], orientations: 4 },
    gemini: { rows: ['●・●', '●・●'], orientations: 2 },
    cancer: { rows: ['●・●', '・・・', '●・●'], orientations: 1 },
    leo: { rows: ['●●●●●'], orientations: 2 },
    virgo: { rows: ['●●', '●●'], orientations: 1 },
    libra: { rows: ['・●・', '●●●'], orientations: 4 },
    scorpio: { rows: ['●●・', '・●・', '・●●'], orientations: 2 },
    sagittarius: { rows: ['・●・', '●●●', '・●・'], orientations: 1 },
    capricorn: { rows: ['●・●', '●・●', '・●・'], orientations: 4 },
    aquarius: { rows: ['●●●●'], orientations: 2 },
    pisces: { rows: ['・●●', '●●・'], orientations: 2 },
  };
  const CHAR = { red: 'R', blue: 'B', green: 'G', pink: 'P' } as const;
  /** 左上をそろえて並べ替えた文字列（向きを比べるため） */
  const norm = (cells: readonly (readonly [number, number])[]) => {
    const r0 = Math.min(...cells.map(([r]) => r));
    const c0 = Math.min(...cells.map(([, c]) => c));
    return cells.map(([r, c]) => `${r - r0},${c - c0}`).sort().join(' ');
  };
  const cellsOf = (rows: string[]) => rows.flatMap((l, r) => [...l].flatMap((ch, c) => (ch === '●' ? [[r, c] as [number, number]] : [])));
  const turn = (cells: [number, number][]) => cells.map(([r, c]) => [c, -r] as [number, number]);

  for (const id of ALL_HEROES) {
    const h = HEROES[id];
    it(`${h.name}：${h.special.color}の形が図どおりで、どの向き・どの位置でも見つかり、1個欠けると出ない`, () => {
      const spec = SPEC[id];
      // 図を90度ずつ回した向き（重なりを除く）が実装の向きと同じ
      const expected = new Set<string>();
      let cur = cellsOf(spec.rows);
      for (let i = 0; i < 4; i++) {
        expected.add(norm(cur));
        cur = turn(cur);
      }
      expect(expected.size).toBe(spec.orientations);
      const actual = SHAPES[h.special.shape];
      expect(new Set(actual.map(norm))).toEqual(expected);
      expect(actual).toHaveLength(spec.orientations);

      const ch = CHAR[h.special.color];
      const bg = Array(5).fill((h.special.color === 'green' ? 'R' : 'G').repeat(5));
      let placements = 0;
      for (const offsets of actual) {
        const height = Math.max(...offsets.map(([r]) => r)) + 1;
        const width = Math.max(...offsets.map(([, c]) => c)) + 1;
        for (let dr = 0; dr + height <= 5; dr++)
          for (let dc = 0; dc + width <= 5; dc++) {
            const cells = shift(offsets, dr, dc);
            placements++;
            const found = detectHeroSpecial(boardWith(cells, ch, bg), id);
            expect(found?.shape).toBe(h.special.shape);
            expect(found?.cells).toHaveLength(cells.length);
            expect(detectHeroSpecial(boardWith(cells.slice(1), ch, bg), id)).toBeNull();
          }
      }
      // 一直線5個は行か列の端から端まで（5行＋5列）だけ
      if (h.special.shape === 'line5') expect(placements).toBe(10);
    });
  }
});

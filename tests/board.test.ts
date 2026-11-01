import { describe, expect, it } from 'vitest';
import { BOARD_SIZE } from '../src/data/balance';
import { collapseAndRefill, createInitialBoard, rotate2x2 } from '../src/game/board';
import { findMatches } from '../src/game/matching';
import type { Direction } from '../src/game/types';
import { boardToStrings, parseBoard } from './helpers';

// 25マスすべてが違う値になるよう、位置を色の代わりに追跡する
function labelled(): string[][] {
  return Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => `${r}${c}`),
  );
}

describe('rotate2x2', () => {
  it('時計回りは [A B; C D] → [C A; D B]、反時計回りは [B D; A C]', () => {
    const board = parseBoard(['RBGPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR']);
    // 左上の2×2は [R B; G P]
    expect(boardToStrings(rotate2x2(board, 0, 0, 'clockwise')).slice(0, 2)).toEqual(['GRGPR', 'PBRBG']);
    expect(boardToStrings(rotate2x2(board, 0, 0, 'counterclockwise')).slice(0, 2)).toEqual(['BPGPR', 'RGRBG']);
  });

  it('16か所すべての交点で、4個だけが入れ替わり残り21マスは動かない', () => {
    const base = labelled() as unknown as Parameters<typeof rotate2x2>[0];
    for (const direction of ['clockwise', 'counterclockwise'] as Direction[]) {
      for (let r = 0; r <= 3; r++) {
        for (let c = 0; c <= 3; c++) {
          const next = rotate2x2(base, r, c, direction) as unknown as string[][];
          const b = base as unknown as string[][];
          let changed = 0;
          for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
              const inside = i >= r && i <= r + 1 && j >= c && j <= c + 1;
              if (!inside) expect(next[i][j]).toBe(b[i][j]);
              if (next[i][j] !== b[i][j]) changed++;
            }
          }
          expect(changed).toBe(4);
          const expected =
            direction === 'clockwise'
              ? [b[r + 1][c], b[r][c], b[r + 1][c + 1], b[r][c + 1]]
              : [b[r][c + 1], b[r + 1][c + 1], b[r][c], b[r + 1][c]];
          expect([next[r][c], next[r][c + 1], next[r + 1][c], next[r + 1][c + 1]]).toEqual(expected);
        }
      }
    }
  });

  it('同じ向きに4回で元に戻り、右→左でも元に戻る', () => {
    const base = labelled() as unknown as Parameters<typeof rotate2x2>[0];
    let b = base;
    for (let i = 0; i < 4; i++) b = rotate2x2(b, 2, 1, 'clockwise');
    expect(b).toEqual(base);
    expect(rotate2x2(rotate2x2(base, 3, 3, 'clockwise'), 3, 3, 'counterclockwise')).toEqual(base);
  });

  it('引数の盤面は変更しない', () => {
    const board = parseBoard(['RBGPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR']);
    const before = boardToStrings(board);
    rotate2x2(board, 1, 1, 'clockwise');
    expect(boardToStrings(board)).toEqual(before);
  });

  it('範囲外の交点は受け付けない', () => {
    const board = parseBoard(['RBGPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR']);
    for (const [r, c] of [[-1, 0], [0, 4], [4, 0], [0.5, 1]]) {
      expect(() => rotate2x2(board, r, c, 'clockwise')).toThrow();
    }
  });
});

describe('createInitialBoard', () => {
  it('通常マッチが1つも無い5×5を作る', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { board } = createInitialBoard(seed);
      expect(board).toHaveLength(5);
      board.forEach((row) => expect(row).toHaveLength(5));
      expect(findMatches(board)).toEqual([]);
    }
  });

  it('同じ seed なら同じ盤面、違う seed なら（ほぼ）違う盤面', () => {
    expect(createInitialBoard(7)).toEqual(createInitialBoard(7));
    expect(createInitialBoard(7).board).not.toEqual(createInitialBoard(8).board);
  });
});

describe('collapseAndRefill', () => {
  const board = parseBoard(['RBGPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR']);
  const none = () => Array.from({ length: 5 }, () => Array<boolean>(5).fill(false));

  it('消したマスの上にあるオーブが順番を保って下に詰まり、上から補充される', () => {
    const cleared = none();
    cleared[2][0] = true;
    cleared[4][0] = true;
    const { board: next } = collapseAndRefill(board, cleared, 1);
    const col0 = next.map((row) => row[0]);
    // 元の列0（上から R G R G R）から 2・4行目を消すと、残りは R G G。下に詰まる
    expect(col0.slice(2)).toEqual(['red', 'green', 'green']);
    // ほかの列は変わらない
    for (let c = 1; c < 5; c++) expect(next.map((row) => row[c])).toEqual(board.map((row) => row[c]));
  });

  it('同じ seed なら同じ補充になり、seed が進む', () => {
    const cleared = none();
    cleared[0][0] = cleared[0][1] = cleared[0][2] = true;
    const a = collapseAndRefill(board, cleared, 99);
    const b = collapseAndRefill(board, cleared, 99);
    expect(a).toEqual(b);
    expect(a.seed).not.toBe(99);
  });

  it('何も消さなければ盤面も seed も変わらない', () => {
    const r = collapseAndRefill(board, none(), 5);
    expect(r.board).toEqual(board);
    expect(r.seed).toBe(5);
  });
});

// 盤面の生成・2×2回転・落下と補充
import { BOARD_SIZE, MIN_MATCH, ORB_COLORS } from '../data/balance';
import { nextInt } from './rng';
import type { Board, Cell, Direction, OrbColor } from './types';

/** 回転できる交点は 0..(BOARD_SIZE - 2) */
export const MAX_INTERSECTION = BOARD_SIZE - 2;

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function isValidIntersection(row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    col >= 0 &&
    row <= MAX_INTERSECTION &&
    col <= MAX_INTERSECTION
  );
}

/**
 * (row, col) を左上とする 2×2 を 90° 回転する。
 * [A B; C D] → 時計回り [C A; D B]、反時計回り [B D; A C]
 */
export function rotate2x2(board: Board, row: number, col: number, direction: Direction): Board {
  if (!isValidIntersection(row, col)) {
    throw new RangeError(`交点が範囲外です: (${row}, ${col})`);
  }
  const next = cloneBoard(board);
  const a = board[row][col];
  const b = board[row][col + 1];
  const c = board[row + 1][col];
  const d = board[row + 1][col + 1];
  if (direction === 'clockwise') {
    next[row][col] = c;
    next[row][col + 1] = a;
    next[row + 1][col] = d;
    next[row + 1][col + 1] = b;
  } else {
    next[row][col] = b;
    next[row][col + 1] = d;
    next[row + 1][col] = a;
    next[row + 1][col + 1] = c;
  }
  return next;
}

/**
 * 通常マッチが1つもない初期盤面を作る。
 * 左に同色が (MIN_MATCH - 1) 個、または上に同色が (MIN_MATCH - 1) 個続く色は選ばない
 */
export function createInitialBoard(seed: number): { board: Board; seed: number } {
  let s = seed;
  const board: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: OrbColor[] = [];
    board.push(row);
    for (let c = 0; c < BOARD_SIZE; c++) {
      const banned = new Set<OrbColor>();
      if (c >= MIN_MATCH - 1) {
        const left = row.slice(c - (MIN_MATCH - 1), c);
        if (left.every((x) => x === left[0])) banned.add(left[0]);
      }
      if (r >= MIN_MATCH - 1) {
        const above = board.slice(r - (MIN_MATCH - 1), r).map((line) => line[c]);
        if (above.every((x) => x === above[0])) banned.add(above[0] as OrbColor);
      }
      const choices = ORB_COLORS.filter((color) => !banned.has(color));
      const pick = nextInt(s, choices.length);
      s = pick.seed;
      row.push(choices[pick.value]);
    }
  }
  return { board, seed: s };
}

/**
 * cleared が true のマスを消し、各列で残りを下に詰め、上から補充する。
 * 補充は左の列から、各列は下の空きから順に乱数を引く
 */
export function collapseAndRefill(
  board: Board,
  cleared: boolean[][],
  seed: number,
): { board: Board; seed: number } {
  let s = seed;
  const next = cloneBoard(board);
  for (let c = 0; c < BOARD_SIZE; c++) {
    // 星屑も残って落ちる。補充では星屑は出ない
    const kept: Cell[] = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (!cleared[r][c]) kept.push(board[r][c]);
    }
    for (let r = BOARD_SIZE - 1, i = 0; r >= 0; r--, i++) {
      if (i < kept.length) {
        next[r][c] = kept[i];
      } else {
        const pick = nextInt(s, ORB_COLORS.length);
        s = pick.seed;
        next[r][c] = ORB_COLORS[pick.value];
      }
    }
  }
  return { board: next, seed: s };
}

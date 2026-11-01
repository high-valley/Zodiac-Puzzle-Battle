// 通常マッチ：同色が縦または横に MIN_MATCH 個以上続くと消去対象。対角は対象外
import { BOARD_SIZE, MIN_MATCH } from '../data/balance';
import type { Board, MatchGroup, Pos } from './types';

export function findMatches(board: Board): MatchGroup[] {
  const groups: MatchGroup[] = [];
  // 横
  for (let r = 0; r < BOARD_SIZE; r++) {
    let start = 0;
    for (let c = 1; c <= BOARD_SIZE; c++) {
      if (c < BOARD_SIZE && board[r][c] === board[r][start]) continue;
      if (c - start >= MIN_MATCH) {
        const cells: Pos[] = [];
        for (let k = start; k < c; k++) cells.push({ row: r, col: k });
        groups.push({ color: board[r][start], axis: 'row', cells });
      }
      start = c;
    }
  }
  // 縦
  for (let c = 0; c < BOARD_SIZE; c++) {
    let start = 0;
    for (let r = 1; r <= BOARD_SIZE; r++) {
      if (r < BOARD_SIZE && board[r][c] === board[start][c]) continue;
      if (r - start >= MIN_MATCH) {
        const cells: Pos[] = [];
        for (let k = start; k < r; k++) cells.push({ row: k, col: c });
        groups.push({ color: board[start][c], axis: 'col', cells });
      }
      start = r;
    }
  }
  return groups;
}

/** マッチしたマスの一覧（縦横の交差は1回だけ数える） */
export function matchedMask(groups: MatchGroup[]): boolean[][] {
  const mask = Array.from({ length: BOARD_SIZE }, () => Array<boolean>(BOARD_SIZE).fill(false));
  for (const g of groups) for (const p of g.cells) mask[p.row][p.col] = true;
  return mask;
}

export function maskToCells(mask: boolean[][]): Pos[] {
  const cells: Pos[] = [];
  mask.forEach((line, row) => line.forEach((on, col) => on && cells.push({ row, col })));
  return cells;
}

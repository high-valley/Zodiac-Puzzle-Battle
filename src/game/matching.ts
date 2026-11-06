// 通常マッチ：同色が縦または横に MIN_MATCH 個以上続くと消去対象。対角は対象外。
// お邪魔の星屑（'junk'）はそろわない。隣で消去が起きたマスの星屑は一緒に消える（仕様書 12.12）
import { BOARD_SIZE, MIN_MATCH } from '../data/balance';
import type { Board, MatchGroup, OrbColor, Pos } from './types';

export function findMatches(board: Board): MatchGroup[] {
  const groups: MatchGroup[] = [];
  // 横
  for (let r = 0; r < BOARD_SIZE; r++) {
    let start = 0;
    for (let c = 1; c <= BOARD_SIZE; c++) {
      if (c < BOARD_SIZE && board[r][c] === board[r][start]) continue;
      if (c - start >= MIN_MATCH && board[r][start] !== 'junk') {
        const cells: Pos[] = [];
        for (let k = start; k < c; k++) cells.push({ row: r, col: k });
        groups.push({ color: board[r][start] as OrbColor, axis: 'row', cells });
      }
      start = c;
    }
  }
  // 縦
  for (let c = 0; c < BOARD_SIZE; c++) {
    let start = 0;
    for (let r = 1; r <= BOARD_SIZE; r++) {
      if (r < BOARD_SIZE && board[r][c] === board[start][c]) continue;
      if (r - start >= MIN_MATCH && board[start][c] !== 'junk') {
        const cells: Pos[] = [];
        for (let k = start; k < r; k++) cells.push({ row: k, col: c });
        groups.push({ color: board[start][c] as OrbColor, axis: 'col', cells });
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

/** 消えるマス（mask）の上下左右にある星屑のマス。mask は変えない */
export function junkBeside(board: Board, mask: boolean[][]): Pos[] {
  const cells: Pos[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 'junk' || mask[r][c]) continue;
      const near = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < BOARD_SIZE && cc < BOARD_SIZE && mask[rr][cc];
      if (near(r - 1, c) || near(r + 1, c) || near(r, c - 1) || near(r, c + 1)) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/** 盤面にある星屑の数 */
export function countJunk(board: Board): number {
  return board.reduce((n, line) => n + line.filter((x) => x === 'junk').length, 0);
}

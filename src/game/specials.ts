// キャラ固有の「形」による必殺技の判定。形は盤面のどこにあってもよい
import { BOARD_SIZE } from '../data/balance';
import { HEROES } from '../data/heroes';
import type { Board, HeroId, Pos, SpecialResult, SpecialShape } from './types';

type Offsets = readonly (readonly [number, number])[];

/**
 * 形ごとの配置（[行, 列] の相対位置）。
 * L字：縦3＋横3で角の1個を共有する5個。角から伸びる向きで4方向
 */
export const SHAPES: Record<SpecialShape, readonly Offsets[]> = {
  L: [
    // 角が左上：下と右へ
    [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
    // 角が右上：下と左へ
    [[0, 2], [1, 2], [2, 2], [0, 1], [0, 0]],
    // 角が左下：上と右へ
    [[2, 0], [1, 0], [0, 0], [2, 1], [2, 2]],
    // 角が右下：上と左へ
    [[2, 2], [1, 2], [0, 2], [2, 1], [2, 0]],
  ],
  cross: [[[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]],
  square: [[[0, 0], [0, 1], [1, 0], [1, 1]]],
};

/** 選んだキャラの必殺の形が盤面にあれば、最初に見つかった1つを返す（左上から順に探す） */
export function detectHeroSpecial(board: Board, heroId: HeroId): SpecialResult | null {
  const { color, shape } = HEROES[heroId].special;
  for (const offsets of SHAPES[shape]) {
    const height = Math.max(...offsets.map(([r]) => r)) + 1;
    const width = Math.max(...offsets.map(([, c]) => c)) + 1;
    for (let r = 0; r + height <= BOARD_SIZE; r++) {
      for (let c = 0; c + width <= BOARD_SIZE; c++) {
        const cells: Pos[] = offsets.map(([dr, dc]) => ({ row: r + dr, col: c + dc }));
        if (cells.every((p) => board[p.row][p.col] === color)) {
          return { heroId, shape, color, cells };
        }
      }
    }
  }
  return null;
}

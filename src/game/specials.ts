// キャラ固有の「形」による必殺技の判定。形は盤面のどこにあってもよい
import { BOARD_SIZE } from '../data/balance';
import { HEROES } from '../data/heroes';
import type { Board, HeroId, Pos, SpecialResult, SpecialShape } from './types';

type Offsets = readonly (readonly [number, number])[];

/** 右に90度回した配置 */
function rotateOffsets(offsets: Offsets): Offsets {
  const height = Math.max(...offsets.map(([r]) => r));
  return offsets.map(([r, c]) => [c, height - r] as const);
}

// 角（つの）：上に2本の角、下に顔。●・● / ●・● / ・●・
const HORNS: Offsets = [
  [0, 0],
  [1, 0],
  [0, 2],
  [1, 2],
  [2, 1],
];

/**
 * 形ごとの配置（[行, 列] の相対位置）。
 * どの形も縦横に同じ色が3個並ぶところを含まない。3個並ぶと通常マッチで先に消えるので、
 * 3個の並びを含む形（以前のL字・十字）は少しずつ組み立てられなかった（docs/decisions.md）
 */
export const SHAPES: Record<SpecialShape, readonly Offsets[]> = {
  // 角は90度ずつ回した4方向（角が上・右・下・左）
  horns: [HORNS, rotateOffsets(HORNS), rotateOffsets(rotateOffsets(HORNS)), rotateOffsets(rotateOffsets(rotateOffsets(HORNS)))],
  // ×字：中央と斜め4つ
  x: [
    [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
  ],
  square: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
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

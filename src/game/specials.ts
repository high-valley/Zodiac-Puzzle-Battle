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

// L字：縦3＋横3で角の1個を共有する5個（角が左下の向き）
const L_SHAPE: Offsets = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
];

/**
 * 形ごとの配置（[行, 列] の相対位置）。
 * L字と十字は縦横の3個並びを含むので、1回の回転では作れないことが多い。
 * 1ターンに3回まで回せて、「攻撃」を押すまで消えないので、途中で3個並んでも崩れずに組み立てられる（docs/decisions.md）
 */
export const SHAPES: Record<SpecialShape, readonly Offsets[]> = {
  // L字は90度ずつ回した4方向
  L: [L_SHAPE, rotateOffsets(L_SHAPE), rotateOffsets(rotateOffsets(L_SHAPE)), rotateOffsets(rotateOffsets(rotateOffsets(L_SHAPE)))],
  // 十字：中央と上下左右
  cross: [
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
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

/** 選んだキャラの必殺の形が盤面にあれば、最初に見つかった1つを返す（向きの順に、それぞれ左上から探す） */
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

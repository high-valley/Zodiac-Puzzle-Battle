import type { BattleState, Board, OrbColor } from '../src/game/types';

const FROM_CHAR: Record<string, OrbColor> = { R: 'red', B: 'blue', G: 'green', P: 'pink' };
const TO_CHAR: Record<OrbColor, string> = { red: 'R', blue: 'B', green: 'G', pink: 'P' };

/** ['RBGPR', ...] の形で盤面を書く */
export function parseBoard(rows: string[]): Board {
  return rows.map((line) =>
    line.split('').map((ch) => {
      const color = FROM_CHAR[ch];
      if (!color) throw new Error(`不明な色: ${ch}`);
      return color;
    }),
  );
}

export function boardToStrings(board: Board): string[] {
  return board.map((row) => row.map((c) => TO_CHAR[c]).join(''));
}

/**
 * どこにも通常マッチも必殺の形も無い盤面（行ごとに2つずらした4色の並び）。
 * 横は4色が巡回し、縦は2色が交互になる
 */
export const QUIET_ROWS = ['RBGPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];

export function stateWith(base: BattleState, rows: string[], patch: Partial<BattleState> = {}): BattleState {
  return { ...base, board: parseBoard(rows), ...patch };
}

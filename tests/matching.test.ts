import { describe, expect, it } from 'vitest';
import { findMatches, matchedMask, maskToCells } from '../src/game/matching';
import { QUIET_ROWS, parseBoard } from './helpers';

describe('findMatches', () => {
  it('マッチの無い盤面では何も返さない', () => {
    expect(findMatches(parseBoard(QUIET_ROWS))).toEqual([]);
  });

  it('横3個・縦3個を見つける', () => {
    const horizontal = findMatches(parseBoard(['GGGPR', 'RBRBG', 'BRGPR', 'GPRBG', 'RBGPR']));
    expect(horizontal).toEqual([
      { color: 'green', axis: 'row', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
    ]);
    const vertical = findMatches(parseBoard(['RBGPR', 'GPRBR', 'RBGPR', 'GPRBG', 'RBGPB']));
    expect(vertical).toEqual([
      { color: 'red', axis: 'col', cells: [{ row: 0, col: 4 }, { row: 1, col: 4 }, { row: 2, col: 4 }] },
    ]);
  });

  it('5個の直線は1つのまとまりとして扱う', () => {
    const groups = findMatches(parseBoard(['PPPPP', 'RBGRB', 'GRBGR', 'RBGRB', 'GRBGR']));
    expect(groups).toHaveLength(1);
    expect(groups[0].cells).toHaveLength(5);
  });

  it('2個並びと対角3個は消去対象にならない', () => {
    expect(findMatches(parseBoard(['RRGPB', 'GPRBG', 'BGPRB', 'GPRBG', 'RBGPR']))).toEqual([]);
    // 対角に R が3個（(0,0)・(1,1)・(2,2)）
    expect(findMatches(parseBoard(['RBGPB', 'GRPBG', 'BGRPB', 'GPBRG', 'BBGPR']))).toEqual([]);
  });

  it('縦横が交差しても、交差マスは1回だけ数える', () => {
    // 十字：横3＋縦3で中央を共有 → 5マス
    const board = parseBoard(['RRGPR', 'GBRPG', 'BBBGR', 'GBRPG', 'RGGPR']);
    const groups = findMatches(board);
    expect(groups).toHaveLength(2);
    expect(maskToCells(matchedMask(groups))).toHaveLength(5);
  });
});

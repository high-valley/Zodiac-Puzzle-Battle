// ぶつかり岩（仕様書 12.14。2026-11-12）
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { ROCK } from '../src/data/balance';
import { breakAndDropRocks, freeIntersections, isRockBlocked } from '../src/game/board';
import { createBattle, placeRocks, resolveTurn } from '../src/game/combat';
import { isBattleState } from '../src/storage/progress';
import type { Pos, TurnAction } from '../src/game/types';
import { QUIET_ROWS, boardToStrings, parseBoard, stateWith } from './helpers';

const quiet: TurnAction = { rotations: [{ row: 3, col: 3, direction: 'clockwise' }] };
const mask = (cells: Pos[]) => {
  const m = Array.from({ length: 5 }, () => Array<boolean>(5).fill(false));
  for (const p of cells) m[p.row][p.col] = true;
  return m;
};

describe('岩で固まったオーブ', () => {
  it('岩のマスを含む 2×2 は回せない', () => {
    const rocks = [{ row: 1, col: 1 }];
    expect(isRockBlocked(rocks, 0, 0)).toBe(true);
    expect(isRockBlocked(rocks, 0, 1)).toBe(true);
    expect(isRockBlocked(rocks, 1, 0)).toBe(true);
    expect(isRockBlocked(rocks, 1, 1)).toBe(true);
    expect(isRockBlocked(rocks, 2, 2)).toBe(false);
    expect(isRockBlocked(undefined, 0, 0)).toBe(false);
    expect(freeIntersections(rocks)).toBe(12);
  });

  it('回そうとするとエラーで、状態は変わらない', () => {
    const state = stateWith(createBattle(1, 'stormshade'), QUIET_ROWS, { rocks: [{ row: 3, col: 3 }] });
    expect(() => resolveTurn(state, quiet)).toThrow(RangeError);
    expect(state.rocks).toEqual([{ row: 3, col: 3 }]);
  });

  it('岩のマスか上下左右が消えると割れ、残りはオーブと一緒に落ちる', () => {
    // (4,0) が消える：(3,0) の岩は上で隣なので割れる。(1,1) の岩はその下の (4,1) が消えるので1つ落ちる
    const r = breakAndDropRocks([{ row: 3, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 4 }], mask([{ row: 4, col: 0 }, { row: 4, col: 1 }]));
    expect(r.broken).toEqual([{ row: 3, col: 0 }]);
    expect(r.rocks).toEqual([{ row: 0, col: 4 }, { row: 2, col: 1 }]);
  });

  it('固まったオーブもそろえば消えて、岩も割れる', () => {
    // 上の行の赤3つのうち (0,1) が岩。右下の 2×2 を回して攻撃すると、上の行がそろって消える
    const rows = ['RRRPB', 'GPGBG', 'RBRPR', 'GPGBG', 'RBRPR'];
    const state = stateWith(createBattle(1, 'stormshade'), rows, { rocks: [{ row: 0, col: 1 }] });
    const { state: next, events } = resolveTurn(state, quiet);
    const clear = events.find((e) => e.type === 'clear');
    expect(clear && clear.type === 'clear' && clear.broken).toEqual([{ row: 0, col: 1 }]);
    expect(next.rocks).toEqual([]);
  });
});

describe('敵が岩で固める', () => {
  const rock = ENEMIES.clashrocks.rock!;

  it('固める敵だけ、はじめから残りターンと空の岩の一覧を持つ', () => {
    const s = createBattle(1, 'clashrocks');
    expect(s.enemyRockIn).toBe(rock.every);
    expect(s.rocks).toEqual([]);
    expect(createBattle(1, 'falsescale').rocks).toBe(undefined);
    expect(createBattle(1, 'falsescale').enemyRockIn).toBe(undefined);
  });

  it('残りが 0 になったターンの、敵の攻撃のあとで count 個固めて数え直す', () => {
    const state = stateWith(createBattle(1, 'clashrocks'), QUIET_ROWS, { enemyRockIn: 1 });
    const { state: next, events } = resolveTurn(state, quiet);
    const types = events.map((e) => e.type);
    expect(types.indexOf('rock')).toBeGreaterThan(types.indexOf('enemyAttack'));
    expect(next.rocks!.length).toBe(rock.count);
    expect(next.enemyRockIn).toBe(rock.every);
    // 盤面のオーブの色は変わらない
    expect(boardToStrings(next.board)).toEqual(boardToStrings(resolveTurn({ ...state, enemyRockIn: 2 }, quiet).state.board));
  });

  it('盤面の岩は max 個まで', () => {
    const rocks = [{ row: 0, col: 0 }, { row: 0, col: 4 }, { row: 4, col: 0 }, { row: 4, col: 4 }].slice(0, rock.max);
    const state = stateWith(createBattle(1, 'clashrocks'), QUIET_ROWS, { enemyRockIn: 1, rocks, rngSeed: 5 });
    const { state: next, events } = resolveTurn({ ...state, board: parseBoard(QUIET_ROWS) }, { rotations: [{ row: 1, col: 1, direction: 'clockwise' }] });
    expect(events.some((e) => e.type === 'rock')).toBe(false);
    expect(next.rocks!.length).toBe(rock.max);
  });

  it('岩を置いても回せる 2×2 が残る。星屑と岩は重ならない', () => {
    const board = parseBoard(['XBGPR', ...QUIET_ROWS.slice(1)]);
    for (let seed = 0; seed < 200; seed++) {
      const r = placeRocks(board, [], 6, seed);
      expect(freeIntersections(r.rocks) >= ROCK.minFreeIntersections).toBe(true);
      expect(r.rocks.some((p) => p.row === 0 && p.col === 0)).toBe(false);
    }
  });

  it('同じ盤面・seed・操作なら、固める場所も同じ（再現性）。引数は変えない', () => {
    const state = stateWith(createBattle(7, 'bulleater'), QUIET_ROWS, { enemyRockIn: 1 });
    const a = resolveTurn(state, quiet).state;
    const b = resolveTurn(state, quiet).state;
    expect(a.rocks).toEqual(b.rocks);
    expect(a.rngSeed).toBe(b.rngSeed);
    expect(state.rocks).toEqual([]);
  });

  it('敵を倒したターンは固めない', () => {
    const state = stateWith(createBattle(1, 'clashrocks'), ['RRRPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR'], { enemyRockIn: 1, enemyHp: 1 });
    const { state: next, events } = resolveTurn(state, quiet);
    expect(next.status).toBe('victory');
    expect(events.some((e) => e.type === 'rock')).toBe(false);
  });
});

describe('途中のバトルの保存（岩）', () => {
  it('岩のある状態を読める', () => {
    const state = stateWith(createBattle(1, 'clashrocks'), QUIET_ROWS, { rocks: [{ row: 2, col: 2 }] });
    expect(isBattleState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });
  it('固めない敵に岩があったり、岩が星屑と重なったりすれば読まない', () => {
    expect(isBattleState(JSON.parse(JSON.stringify({ ...createBattle(1, 'falsescale'), rocks: [] })))).toBe(false);
    const onJunk = stateWith(createBattle(1, 'bulleater'), ['XBGPR', ...QUIET_ROWS.slice(1)], { rocks: [{ row: 0, col: 0 }] });
    expect(isBattleState(JSON.parse(JSON.stringify(onJunk)))).toBe(false);
    const noList = { ...createBattle(1, 'clashrocks') } as Record<string, unknown>;
    delete noList.rocks;
    expect(isBattleState(JSON.parse(JSON.stringify(noList)))).toBe(false);
  });
});

describe('岩の落下（レビューの指摘）', () => {
  it('落ちた岩で回せる 2×2 が足りなくなったら、落ちた岩を下から割る（broken は落ちる前の位置）', () => {
    // 一番下の行の (4,1)〜(4,3) が消えると、(0,1)(0,3)(1,1)(2,3) は1つずつ落ちる → 回せる 2×2 が2つになるので割る
    const rocks = [{ row: 0, col: 1 }, { row: 0, col: 3 }, { row: 1, col: 1 }, { row: 2, col: 3 }];
    expect(freeIntersections(rocks)).toBe(6);
    const r = breakAndDropRocks(rocks, mask([{ row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 }]));
    expect(freeIntersections(r.rocks) >= ROCK.minFreeAfterDrop).toBe(true);
    expect(r.broken.length + r.rocks.length).toBe(4);
    // 割れたのは落ちる前の位置で、元の岩のどれか
    for (const p of r.broken) expect(rocks.some((q) => q.row === p.row && q.col === p.col)).toBe(true);
  });

  it('引数の岩と盤面は変えない（凍結して渡しても動く）', () => {
    const rocks = Object.freeze([Object.freeze({ row: 1, col: 1 })]) as unknown as Pos[];
    const state = Object.freeze(stateWith(createBattle(3, 'clashrocks'), QUIET_ROWS, { rocks, enemyRockIn: 1 }));
    const before = JSON.stringify(state);
    resolveTurn(state, quiet);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('回しかけの保存に岩で回せない 2×2 があれば読まない', async () => {
    const { parsePending } = await import('../src/storage/progress');
    expect(parsePending([{ row: 0, col: 0, direction: 'clockwise' }], [{ row: 1, col: 1 }])).toEqual([]);
    expect(parsePending([{ row: 3, col: 3, direction: 'clockwise' }], [{ row: 1, col: 1 }])).toEqual([{ row: 3, col: 3, direction: 'clockwise' }]);
  });

  it('回せる 2×2 が1つもない岩の並びは、保存から読まない', () => {
    const rocks = [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 3 }];
    expect(freeIntersections(rocks)).toBe(0);
    const state = stateWith(createBattle(1, 'clashrocks'), QUIET_ROWS, { rocks });
    expect(isBattleState(JSON.parse(JSON.stringify(state)))).toBe(false);
  });
});

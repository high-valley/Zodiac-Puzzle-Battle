// お邪魔の星屑（仕様書 12.12）：そろわない・補充で出ない・隣の消去で一緒に消える・敵が決まったターンにまぜる
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { collapseAndRefill } from '../src/game/board';
import { createBattle, mixJunk, resolveTurn } from '../src/game/combat';
import { countJunk, findMatches } from '../src/game/matching';
import { isBattleState } from '../src/storage/progress';
import type { TurnAction } from '../src/game/types';
import { QUIET_ROWS, boardToStrings, parseBoard, stateWith } from './helpers';

const quiet: TurnAction = { rotations: [{ row: 3, col: 3, direction: 'clockwise' }] };

describe('星屑のマス', () => {
  it('星屑が3個並んでもそろわない', () => {
    const board = parseBoard(['XXXPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR']);
    expect(findMatches(board)).toEqual([]);
  });

  it('補充では星屑は出ず、盤面の星屑は残って落ちる', () => {
    const board = parseBoard(['XBGPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR']);
    const cleared = board.map((line, r) => line.map((_, c) => r === 4 && c === 0));
    const { board: next } = collapseAndRefill(board, cleared, 123);
    expect(next[1][0]).toBe('junk');
    expect(countJunk(next)).toBe(1);
  });

  it('消えたマスの上下左右の星屑は一緒に消え、ななめの星屑は残る', () => {
    const base = createBattle(1, 'stardust');
    // 2行目の赤3個がそろう。真上の星屑(0,1)は消え、ななめの星屑(0,4)は残る
    const state = stateWith(base, ['RXGPX', 'GRRRG', 'RBGPR', 'GPRBG', 'RBGPR'], { enemyJunkIn: undefined });
    // (3,3) を回しても下の方は何もそろわない
    const { events } = resolveTurn(state, quiet);
    const clear = events.find((e) => e.type === 'clear');
    expect(clear && clear.type === 'clear' && clear.junk).toEqual([{ row: 0, col: 1 }]);
    expect(clear && clear.type === 'clear' && clear.cells.some((p) => p.row === 0 && p.col === 1)).toBe(true);
    // 星屑の分は通常効果に数えない
    expect(clear && clear.type === 'clear' && clear.counts).toEqual({ red: 3, blue: 0, green: 0, pink: 0 });
  });
});

describe('敵が星屑をまぜる', () => {
  const enemy = ENEMIES.falsescale;
  if (!enemy.junk) throw new Error('第2章の敵は星屑をまぜる');
  const junk = enemy.junk;

  it('はじめは every ターン後にまぜる予定', () => {
    expect(createBattle(1, 'falsescale').enemyJunkIn).toBe(junk.every);
    expect(createBattle(1, 'stardust').enemyJunkIn).toBe(undefined);
  });

  it('残りが 0 になったターンの、敵の攻撃のあとで count 個まぜて数え直す', () => {
    const state = stateWith(createBattle(1, 'falsescale'), QUIET_ROWS, { enemyJunkIn: 1 });
    const { state: next, events } = resolveTurn(state, quiet);
    const types = events.map((e) => e.type);
    expect(types.indexOf('junk')).toBe(types.indexOf('enemyAttack') + 1);
    const ev = events.find((e) => e.type === 'junk');
    expect(ev && ev.type === 'junk' && ev.cells.length).toBe(junk.count);
    expect(countJunk(next.board)).toBe(junk.count);
    expect(next.enemyJunkIn).toBe(junk.every);
    // まぜても新しいマッチはできない
    expect(findMatches(next.board)).toEqual([]);
  });

  it('残りが 2 以上なら数えるだけ', () => {
    const state = stateWith(createBattle(1, 'falsescale'), QUIET_ROWS, { enemyJunkIn: 2 });
    const { state: next, events } = resolveTurn(state, quiet);
    expect(events.some((e) => e.type === 'junk')).toBe(false);
    expect(next.enemyJunkIn).toBe(1);
  });

  it('盤面の星屑は max 個まで', () => {
    const full = QUIET_ROWS.map((row, r) => (r === 0 ? 'X'.repeat(junk.max) + row.slice(junk.max) : row));
    const state = stateWith(createBattle(1, 'falsescale'), full, { enemyJunkIn: 1 });
    const { state: next, events } = resolveTurn(state, quiet);
    expect(events.some((e) => e.type === 'junk')).toBe(false);
    expect(countJunk(next.board)).toBe(junk.max);
  });

  it('敵を倒したターンはまぜない', () => {
    const state = stateWith(createBattle(1, 'falsescale'), ['RRRPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR'], { enemyJunkIn: 1, enemyHp: 1 });
    const { state: next, events } = resolveTurn(state, quiet);
    expect(next.status).toBe('victory');
    expect(events.some((e) => e.type === 'junk')).toBe(false);
  });

  it('同じ盤面・seed・操作なら、まぜる場所も同じ（再現性）', () => {
    const state = stateWith(createBattle(7, 'brokenverdict'), QUIET_ROWS, { enemyJunkIn: 1 });
    const a = resolveTurn(state, quiet).state;
    const b = resolveTurn(state, quiet).state;
    expect(boardToStrings(a.board)).toEqual(boardToStrings(b.board));
    expect(a.rngSeed).toBe(b.rngSeed);
  });

  it('mixJunk は引数の盤面を変えない', () => {
    const board = parseBoard(QUIET_ROWS);
    const before = boardToStrings(board);
    const mixed = mixJunk(board, 3, 99);
    expect(boardToStrings(board)).toEqual(before);
    expect(countJunk(mixed.board)).toBe(3);
  });
});

describe('途中のバトルの保存', () => {
  it('星屑のある盤面と残りターンを読める', () => {
    const state = stateWith(createBattle(1, 'falsescale'), ['XBGPR', ...QUIET_ROWS.slice(1)]);
    expect(isBattleState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it('星屑をまぜない敵の盤面に星屑があれば読まない', () => {
    const state = stateWith(createBattle(1, 'stardust'), ['XBGPR', ...QUIET_ROWS.slice(1)]);
    expect(isBattleState(JSON.parse(JSON.stringify(state)))).toBe(false);
  });

  it('星屑をまぜる敵で残りターンが無ければ読まない', () => {
    const state = { ...createBattle(1, 'falsescale') } as Record<string, unknown>;
    delete state.enemyJunkIn;
    expect(isBattleState(JSON.parse(JSON.stringify(state)))).toBe(false);
  });
});

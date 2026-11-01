import { describe, expect, it } from 'vitest';
import { ENEMY, chainMultiplier } from '../src/data/balance';
import { HEROES } from '../src/data/heroes';
import { createBattle, normalEffect, partyMaxHp, resolveTurn } from '../src/game/combat';
import { findMatches } from '../src/game/matching';
import type { BattleState, Direction, HeroId, TurnAction } from '../src/game/types';
import { QUIET_ROWS, boardToStrings, stateWith } from './helpers';

const base = createBattle(1);

// QUIET_ROWS で交点(3,3)を回しても、マッチも必殺の形もできない
const quietMove = (hero: HeroId, direction: Direction = 'clockwise'): TurnAction => ({ hero, row: 3, col: 3, direction });

// 左上にピンク2×2（どの縦横にも3個は並ばない）
const PINK_SQUARE = ['PPGPR', 'PPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
// 左上に赤L字（縦3＋横3、角を共有）
const RED_L = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];

describe('戦闘の開始', () => {
  it('パーティー最大HPは3人の寄与値の合計で、共通HPは満タンから', () => {
    const expected = HEROES.aries.maxHpContribution + HEROES.sagittarius.maxHpContribution + HEROES.virgo.maxHpContribution;
    expect(partyMaxHp()).toBe(expected);
    expect(base.partyMaxHp).toBe(expected);
    expect(base.partyHp).toBe(expected);
    expect(base.enemyHp).toBe(ENEMY.maxHp);
    expect(base.status).toBe('playing');
    expect(base.turn).toBe(1);
  });
});

describe('resolveTurn', () => {
  it('マッチも必殺も無いターンは、回転と敵の攻撃だけ', () => {
    const state = stateWith(base, QUIET_ROWS);
    const { state: next, events } = resolveTurn(state, quietMove('aries'));
    expect(events.map((e) => e.type)).toEqual(['rotate', 'enemyAttack']);
    expect(next.enemyHp).toBe(state.enemyHp);
    expect(next.partyHp).toBe(state.partyHp - ENEMY.attack);
    expect(next.turn).toBe(state.turn + 1);
    expect(next.rngSeed).toBe(state.rngSeed);
  });

  it('引数の状態は変更しない', () => {
    const state = stateWith(base, RED_L);
    const before = JSON.stringify(state);
    resolveTurn(state, quietMove('aries'));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('おとめ座のピンク2×2は、通常マッチが無くても回復の必殺が出る', () => {
    const state = stateWith(base, PINK_SQUARE, { partyHp: 100 });
    const { state: next, events } = resolveTurn(state, quietMove('virgo'));
    // 必殺 → 必殺に使った4個を消す（通常効果なし）→ 回復 → 敵の攻撃
    expect(events.map((e) => e.type)).toEqual(['rotate', 'special', 'clear', 'heal', 'enemyAttack']);
    const heal = HEROES.virgo.special.power;
    expect(next.partyHp).toBe(100 + heal - ENEMY.attack);
    expect(next.enemyHp).toBe(state.enemyHp);
  });

  it('必殺の形があっても、選んでいないキャラの技は出ない', () => {
    const state = stateWith(base, PINK_SQUARE);
    for (const hero of ['aries', 'sagittarius'] as HeroId[]) {
      const { events } = resolveTurn(state, quietMove(hero));
      expect(events.some((e) => e.type === 'special')).toBeFalsy();
    }
  });

  it('必殺は回転直後に判定し、そのあと通常マッチを消す（必殺に使った赤も消える）', () => {
    const state = stateWith(base, RED_L);
    const { events } = resolveTurn(state, quietMove('aries'));
    const types = events.map((e) => e.type);
    expect(types.indexOf('special')).toBe(1);
    expect(types.indexOf('clear')).toBeGreaterThan(1);
    const special = events.find((e) => e.type === 'special');
    expect(special && special.type === 'special' && special.damage).toBe(HEROES.aries.special.power);
    const firstClear = events.find((e) => e.type === 'clear');
    expect(firstClear && firstClear.type === 'clear' && firstClear.counts.red).toBe(5);
  });

  it('必殺は1ターンに1回まで', () => {
    // 赤L字が2つ
    const twoL = ['RRRPB', 'RPGBG', 'RBRRR', 'GPRBR', 'BBGPR'];
    // 交点(3,0)の回転はどちらのL字も崩さない
    const { events } = resolveTurn(stateWith(base, twoL), { hero: 'aries', row: 3, col: 0, direction: 'clockwise' });
    expect(events.filter((e) => e.type === 'special')).toHaveLength(1);
  });

  it('ダメージ合計は 必殺 ＋ 各連鎖の通常効果 で、敵HPに反映される', () => {
    const state = stateWith(base, RED_L);
    const { state: next, events } = resolveTurn(state, quietMove('aries'));
    let total = 0;
    for (const e of events) if (e.type === 'special' || e.type === 'clear') total += e.damage;
    const dmg = events.find((e) => e.type === 'damage');
    expect(dmg && dmg.type === 'damage' && dmg.amount).toBe(total);
    expect(next.enemyHp).toBe(state.enemyHp - total);
  });

  it('回復は敵の攻撃より先に入り、最大HPを超えない', () => {
    const state = stateWith(base, PINK_SQUARE, { partyHp: base.partyMaxHp - 10 });
    const { state: next, events } = resolveTurn(state, quietMove('virgo'));
    const heal = events.find((e) => e.type === 'heal');
    expect(heal && heal.type === 'heal' && heal.partyHp).toBe(base.partyMaxHp);
    // 回復量は実際に増えた分だけ
    expect(heal && heal.type === 'heal' && heal.amount).toBe(10);
    expect(next.partyHp).toBe(base.partyMaxHp - ENEMY.attack);
  });

  it('HPが満タンなら回復の出来事は出ない（必殺の演出は出る）', () => {
    const { events } = resolveTurn(stateWith(base, PINK_SQUARE), quietMove('virgo'));
    expect(events.map((e) => e.type)).toEqual(['rotate', 'special', 'clear', 'enemyAttack']);
  });

  it('敵HPが0になったら勝利し、敵は攻撃しない', () => {
    const state = stateWith(base, RED_L, { enemyHp: 1 });
    const { state: next, events } = resolveTurn(state, quietMove('aries'));
    expect(next.enemyHp).toBe(0);
    expect(next.status).toBe('victory');
    expect(events.some((e) => e.type === 'enemyAttack')).toBeFalsy();
    expect(next.partyHp).toBe(state.partyHp);
    expect(events[events.length - 1]).toEqual({ type: 'end', status: 'victory' });
  });

  it('共通HPが0になったら敗北し、0未満にはならない', () => {
    const state = stateWith(base, QUIET_ROWS, { partyHp: 5 });
    const { state: next, events } = resolveTurn(state, quietMove('sagittarius'));
    expect(next.partyHp).toBe(0);
    expect(next.status).toBe('defeat');
    expect(events[events.length - 1]).toEqual({ type: 'end', status: 'defeat' });
  });

  it('終わった戦闘や不正な操作は受け付けない', () => {
    const quiet = stateWith(base, QUIET_ROWS);
    expect(() => resolveTurn({ ...quiet, status: 'victory' }, quietMove('aries'))).toThrow();
    expect(() => resolveTurn(quiet, { hero: 'leo' as HeroId, row: 0, col: 0, direction: 'clockwise' })).toThrow();
    expect(() => resolveTurn(quiet, { hero: 'aries', row: 4, col: 0, direction: 'clockwise' })).toThrow();
    expect(() => resolveTurn(quiet, { hero: 'aries', row: 0, col: -1, direction: 'clockwise' })).toThrow();
    expect(() => resolveTurn(quiet, { hero: 'aries', row: 0, col: 0, direction: 'up' as Direction })).toThrow();
  });

  it('連鎖は8段まで。各段の盤面は消去・落下・補充の後のもの', () => {
    const state = stateWith(base, RED_L);
    const { state: next, events } = resolveTurn(state, quietMove('aries'));
    const clears = events.filter((e) => e.type === 'clear');
    expect(clears.length).toBeGreaterThan(0);
    expect(clears.length).toBeLessThan(9);
    clears.forEach((e, i) => e.type === 'clear' && expect(e.chain).toBe(i + 1));
    const last = clears[clears.length - 1];
    if (last.type === 'clear') expect(boardToStrings(last.board)).toEqual(boardToStrings(next.board));
  });
});

describe('必殺に使ったオーブを消す', () => {
  const at = (cells: { row: number; col: number }[], r: number, c: number) =>
    cells.some((p) => p.row === r && p.col === c);

  it('ピンク2×2は通常マッチが無くても消え、通常の回復は出ない（連鎖にも数えない）', () => {
    const state = stateWith(base, PINK_SQUARE, { partyHp: 100 });
    const { events } = resolveTurn(state, quietMove('virgo'));
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.chain).toBe(0);
    expect(first.cells).toHaveLength(4);
    for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]]) expect(at(first.cells, r, c)).toBeTruthy();
    expect(first.counts).toEqual({ red: 0, blue: 0, green: 0, pink: 0 });
    expect(first.heal).toBe(0);
    // 続く通常マッチの連鎖は1段目から数える
    events
      .filter((e) => e.type === 'clear')
      .slice(1)
      .forEach((e, i) => e.type === 'clear' && expect(e.chain).toBe(i + 1));
  });

  it('必殺の形と通常マッチが重なるときは、両方を同時に1回で消す（重なったマスは1回）', () => {
    const state = stateWith(base, RED_L);
    const { events } = resolveTurn(state, quietMove('aries'));
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    // 赤L字の5個は縦3＋横3の通常マッチでもある
    expect(first.chain).toBe(1);
    expect(first.cells).toHaveLength(5);
    expect(first.counts.red).toBe(5);
  });

  it('選んでいないキャラの形は消さない', () => {
    const { events } = resolveTurn(stateWith(base, PINK_SQUARE), quietMove('aries'));
    expect(events.some((e) => e.type === 'clear')).toBeFalsy();
  });

  it('同じ形で毎ターン必殺が出続けることはない', () => {
    // 以前はピンク2×2が残り続け、離れた交点を回すだけで毎ターン回復の必殺が出ていた
    let state = stateWith(base, PINK_SQUARE, { partyHp: 100 });
    let specials = 0;
    for (let t = 0; t < 30 && state.status === 'playing'; t++) {
      const r = resolveTurn(state, quietMove('virgo', t % 2 === 0 ? 'clockwise' : 'counterclockwise'));
      if (r.events.some((e) => e.type === 'special')) specials++;
      state = r.state;
    }
    expect(specials).toBeLessThan(10);
  });
});

describe('連鎖の上限', () => {
  // seed 47 で下の操作列を流すと、6ターン目（t = 5）で連鎖が8段に達し、マッチが残る
  const scripted = (t: number): TurnAction => ({
    hero: (['aries', 'sagittarius', 'virgo'] as HeroId[])[t % 3],
    row: (t * 7) % 4,
    col: (t * 3) % 4,
    direction: t % 2 === 0 ? 'clockwise' : 'counterclockwise',
  });

  it('8段で止め、残ったマッチは次の回転のあとに消える', () => {
    let state = createBattle(47);
    for (let t = 0; t < 5; t++) state = resolveTurn(state, scripted(t)).state;
    const capped = resolveTurn(state, scripted(5));
    expect(capped.events.filter((e) => e.type === 'clear')).toHaveLength(8);
    expect(findMatches(capped.state.board).length).toBeGreaterThan(0);

    // 次のターンは、残っていたマッチから消える（1段目に clear が出る）
    expect(capped.state.status).toBe('playing');
    const next = resolveTurn(capped.state, scripted(6));
    expect(next.events.some((e) => e.type === 'clear' && e.chain === 1)).toBeTruthy();
  });
});

describe('通常効果（形ボーナスなし）', () => {
  it('消した個数と連鎖段数だけで決まる', () => {
    const red5 = { red: 5, blue: 0, green: 0, pink: 0 };
    expect(normalEffect('sagittarius', red5, 1)).toEqual({ damage: HEROES.sagittarius.actions.red!.coef * 5, heal: 0 });
    expect(normalEffect('sagittarius', red5, 3).damage).toBe(Math.round(HEROES.sagittarius.actions.red!.coef * 5 * chainMultiplier(3)));
  });

  it('攻撃キャラのピンク、ヒーラーの赤青緑は直接効果なし', () => {
    expect(normalEffect('aries', { red: 0, blue: 0, green: 0, pink: 6 }, 1)).toEqual({ damage: 0, heal: 0 });
    expect(normalEffect('virgo', { red: 3, blue: 3, green: 3, pink: 0 }, 1)).toEqual({ damage: 0, heal: 0 });
    expect(normalEffect('virgo', { red: 0, blue: 0, green: 0, pink: 4 }, 1).heal).toBe(HEROES.virgo.actions.pink!.coef * 4);
  });

  it('連鎖倍率は 1 + 0.25 × (段数 - 1)', () => {
    expect(chainMultiplier(1)).toBe(1);
    expect(chainMultiplier(2)).toBe(1.25);
    expect(chainMultiplier(5)).toBe(2);
  });
});

describe('再現性', () => {
  // seed から決まる操作列で、終わるまで（最大60ターン）進める
  function play(seed: number): { final: BattleState; log: string[] } {
    let state = createBattle(seed);
    const heroes: HeroId[] = ['aries', 'sagittarius', 'virgo'];
    const log: string[] = [];
    for (let t = 0; t < 60 && state.status === 'playing'; t++) {
      const action: TurnAction = {
        hero: heroes[t % 3],
        row: (t * 7) % 4,
        col: (t * 3) % 4,
        direction: t % 2 === 0 ? 'clockwise' : 'counterclockwise',
      };
      const result = resolveTurn(state, action);
      log.push(JSON.stringify(result.events));
      state = result.state;
    }
    return { final: state, log };
  }

  it('同じ seed と同じ操作列なら、出来事も最終状態も同じ', () => {
    expect(play(2026)).toEqual(play(2026));
  });

  it('seed が違えば結果も変わる', () => {
    expect(play(2026).final.board).not.toEqual(play(2027).final.board);
  });
});

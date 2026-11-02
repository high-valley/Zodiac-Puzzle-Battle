import { describe, expect, it } from 'vitest';
import { chainMultiplier } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { HEROES } from '../src/data/heroes';
import { createBattle, normalEffect, partyMaxHp, resolveTurn } from '../src/game/combat';
import { findMatches } from '../src/game/matching';
import { detectHeroSpecial } from '../src/game/specials';
import type { BattleState, Direction, HeroId, TurnAction } from '../src/game/types';
import { QUIET_ROWS, boardToStrings, stateWith } from './helpers';

// 強攻撃のない敵で、ふつうの攻撃だけを確かめる
const base = createBattle(1, 'stardust');
const ENEMY = ENEMIES.stardust;

// QUIET_ROWS で交点(3,3)を回しても、マッチも必殺の形もできない
const quietMove = (hero: HeroId, direction: Direction = 'clockwise'): TurnAction => ({ hero, row: 3, col: 3, direction });

// 左上にピンク2×2（どの縦横にも3個は並ばない）
const PINK_SQUARE = ['PPGPR', 'PPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
// 左上に赤の角（●・● / ●・● / ・●・）。交点(3,3)を回してもマッチはできない
const RED_HORNS = ['RBRPR', 'RPRBG', 'BRGPR', 'GPRBG', 'RBGPR'];

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
    const state = stateWith(base, RED_HORNS);
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

  it('攻撃の必殺：回転直後に判定し、形のオーブは必殺だけで消える（連鎖0・通常効果なし）。ダメージは必殺の威力', () => {
    const state = stateWith(base, RED_HORNS);
    const { events } = resolveTurn(state, quietMove('aries'));
    const types = events.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(['rotate', 'special', 'clear']);
    const special = events.find((e) => e.type === 'special');
    expect(special && special.type === 'special' && special.damage).toBe(HEROES.aries.special.power);
    const firstClear = events.find((e) => e.type === 'clear');
    if (firstClear?.type !== 'clear') throw new Error('clear がない');
    expect(firstClear.chain).toBe(0);
    expect(firstClear.cells).toHaveLength(5);
    expect(firstClear.counts).toEqual({ red: 0, blue: 0, green: 0, pink: 0 });
    expect(firstClear.damage).toBe(0);
  });

  it('いて座：青の×字で必殺が出る', () => {
    const blueX = ['BRBPR', 'GBRBG', 'BGBPR', 'GPRBG', 'RBGPR'];
    const { events } = resolveTurn(stateWith(base, blueX), quietMove('sagittarius'));
    const special = events.find((e) => e.type === 'special');
    if (special?.type !== 'special') throw new Error('必殺が出ない');
    expect(special.special.shape).toBe('x');
    expect(special.damage).toBe(HEROES.sagittarius.special.power);
    // ×字のオーブも必殺だけで消える（連鎖0・通常効果なし）
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.chain).toBe(0);
    expect(first.cells).toHaveLength(5);
    expect(first.counts).toEqual({ red: 0, blue: 0, green: 0, pink: 0 });
  });

  it('必殺は1ターンに1回まで（形が2つあっても、残ったほうは次のターンまで出ない）', () => {
    // 赤の角が2つ（上向きと下向き）。交点(0,3)の回転はどちらも崩さない
    const twoHorns = ['RPRBP', 'RBRBG', 'PRPRP', 'GPRBR', 'PPRPR'];
    const state = stateWith(base, twoHorns);
    const { state: next, events } = resolveTurn(state, { hero: 'aries', row: 0, col: 3, direction: 'clockwise' });
    expect(events.filter((e) => e.type === 'special')).toHaveLength(1);
    // 消えるのは見つかった1つの形の5個だけ
    const first = events.find((e) => e.type === 'clear');
    expect(first && first.type === 'clear' && first.cells.length).toBe(5);
    // もう1つの角（下向き）は消えずに残っている
    expect(detectHeroSpecial(next.board, 'aries')).not.toBeNull();
    // 敵へのダメージは必殺1回分＋通常効果だけ
    const normal = events.reduce((sum, e) => (e.type === 'clear' ? sum + e.damage : sum), 0);
    expect(state.enemyHp - next.enemyHp).toBe(HEROES.aries.special.power + normal);
  });

  it('角の一部が通常マッチと重なるときは、同時に1回で消し、通常効果は通常マッチの分だけ', () => {
    // 回すと、角の顔 (2,1) を通る縦の赤3個ができる
    const rows = ['RBRGG', 'RBRPP', 'PRBBG', 'BBGPP', 'BRRPP'];
    const { events } = resolveTurn(stateWith(base, rows), { hero: 'aries', row: 3, col: 1, direction: 'clockwise' });
    expect(events.filter((e) => e.type === 'special')).toHaveLength(1);
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.chain).toBe(1);
    // 角の5個＋縦3個のうち角でない2個 = 7個（重なった顔は1回だけ）
    expect(first.cells).toHaveLength(7);
    expect(first.counts.red).toBe(3);
    expect(first.damage).toBe(HEROES.aries.actions.red!.coef * 3);
  });

  it('ダメージ合計は 必殺 ＋ 各連鎖の通常効果 で、敵HPに反映される', () => {
    const state = stateWith(base, RED_HORNS);
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
    const state = stateWith(base, RED_HORNS, { enemyHp: 1 });
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
    const state = stateWith(base, RED_HORNS);
    const { state: next, events } = resolveTurn(state, quietMove('aries'));
    const clears = events.filter((e) => e.type === 'clear');
    expect(clears.length).toBeGreaterThan(0);
    expect(clears.length).toBeLessThan(9);
    // 1段目は必殺の形だけの消去（連鎖0）、そのあと落ちてきたオーブの連鎖が 1, 2, ... と続く
    clears.forEach((e, i) => e.type === 'clear' && expect(e.chain).toBe(i));
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
  });

  const chains = (rngSeed: number) =>
    resolveTurn(stateWith(base, PINK_SQUARE, { rngSeed }), quietMove('virgo'))
      .events.flatMap((e) => (e.type === 'clear' ? [e.chain] : []));

  it('必殺だけの消去のあと、落ちてきたオーブの通常マッチは1連鎖目から数える', () => {
    // rngSeed 1315 では、必殺の消去のあとに通常マッチが7段続く
    expect(chains(1315)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('必殺だけの消去は連鎖の上限（8段）に数えない', () => {
    // rngSeed 17538 では、必殺の消去のあとに通常マッチが8段に達し、マッチが残る
    const state = stateWith(base, PINK_SQUARE, { rngSeed: 17538 });
    const result = resolveTurn(state, quietMove('virgo'));
    expect(result.events.flatMap((e) => (e.type === 'clear' ? [e.chain] : []))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(findMatches(result.state.board).length).toBeGreaterThan(0);
  });

  it('形の一部だけが通常マッチと重なるとき、同時に1回で消し、通常効果は通常マッチの分だけ', () => {
    // 上の行のピンク3個（横並び）が通常マッチ、うち2個がピンク2×2の上の辺と重なる
    const rows = ['PPPGR', 'PPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
    const { events } = resolveTurn(stateWith(base, rows, { partyHp: 100 }), quietMove('virgo'));
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.chain).toBe(1);
    // 2×2 の4個 ＋ (0,2) の5個。重なった (0,0)(0,1) は1回だけ
    expect(first.cells).toHaveLength(5);
    for (const [r, c] of [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]]) expect(at(first.cells, r, c)).toBeTruthy();
    // 必殺だけで消えた (1,0)(1,1) は通常効果に入らない
    expect(first.counts.pink).toBe(3);
    expect(first.heal).toBe(HEROES.virgo.actions.pink!.coef * 3);
  });

  it('選んでいないキャラの形は消さない', () => {
    const { events } = resolveTurn(stateWith(base, PINK_SQUARE), quietMove('aries'));
    expect(events.some((e) => e.type === 'clear')).toBeFalsy();
  });

  it('同じ形は盤面に残らない（毎ターン必殺が出続けない）', () => {
    // 以前はピンク2×2が残り続け、離れた交点を回すだけで毎ターン回復の必殺が出ていた
    const { state: next } = resolveTurn(stateWith(base, PINK_SQUARE), quietMove('virgo'));
    const found = detectHeroSpecial(next.board, 'virgo');
    // 補充でたまたま新しい2×2ができることはあるが、元の位置（左上）の形は消えている
    expect(found !== null && found.cells[0].row === 0 && found.cells[0].col === 0).toBeFalsy();
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

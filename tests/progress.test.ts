import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { ALL_STAGES, findStage, starsFor } from '../src/data/stages';
import { createBattle, resolveTurn } from '../src/game/combat';
import { emptyProgress, isBattleState, isUnlocked, nextStageId, parseProgress, recordResult, type Progress } from '../src/storage/progress';
import { QUIET_ROWS, stateWith } from './helpers';

describe('敵の強攻撃と記録', () => {
  it('強攻撃のある敵は、決まったターンごとに強攻撃し、残りターンを数え直す（3周）', () => {
    const enemy = ENEMIES.shadow;
    const heavy = enemy.heavy!;
    let state = stateWith(createBattle(5, 'shadow'), QUIET_ROWS);
    expect(state.enemyChargeIn).toBe(heavy.every);
    const heavyTurns: number[] = [];
    const charges: (number | null)[] = [];
    for (let t = 1; t <= heavy.every * 3; t++) {
      const r = resolveTurn(state, { hero: 'aries', rotations: [{ row: 3, col: 3, direction: t % 2 ? 'clockwise' : 'counterclockwise' }] });
      const attack = r.events.find((e) => e.type === 'enemyAttack');
      if (attack?.type !== 'enemyAttack') throw new Error('攻撃がない');
      expect(attack.amount).toBe(attack.heavy ? heavy.attack : enemy.attack);
      if (attack.heavy) heavyTurns.push(t);
      charges.push(r.state.enemyChargeIn);
      state = { ...r.state, partyHp: r.state.partyMaxHp }; // 負けないように満タンに戻す
    }
    expect(heavyTurns).toEqual([heavy.every, heavy.every * 2, heavy.every * 3]);
    // every=4 なら 3,2,1,4,3,2,1,4,...
    expect(charges.slice(0, heavy.every)).toEqual([...Array(heavy.every - 1)].map((_, i) => heavy.every - 1 - i).concat([heavy.every]));
  });

  it('強攻撃が来るはずのターンに勝てば、敵は攻撃せず残りターンも減らない', () => {
    const redL = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];
    const start = stateWith(createBattle(5, 'shadow'), redL, { enemyHp: 5, enemyChargeIn: 1 });
    const r = resolveTurn(start, { hero: 'aries', rotations: [{ row: 3, col: 3, direction: 'clockwise' }] });
    expect(r.state.status).toBe('victory');
    expect(r.events.some((e) => e.type === 'enemyAttack')).toBeFalsy();
    expect(r.state.enemyChargeIn).toBe(1);
    expect(r.state.partyHp).toBe(start.partyHp);
  });

  it('強攻撃のない敵は残りターンを持たず、いつも同じ攻撃', () => {
    const state = createBattle(5, 'stardust');
    expect(state.enemyChargeIn).toBeNull();
    const r = resolveTurn(stateWith(state, QUIET_ROWS), { hero: 'aries', rotations: [{ row: 3, col: 3, direction: 'clockwise' }] });
    expect(r.state.enemyChargeIn).toBeNull();
  });

  it('知らない敵では始められない', () => {
    expect(() => createBattle(1, 'nobody')).toThrow();
  });

  it('記録：ピンク2×2の必殺だけのターン（必殺1回・回復110・連鎖0・ダメージ0）', () => {
    const pink = ['PPGPR', 'PPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
    const start = stateWith(createBattle(1, 'stardust'), pink, { partyHp: 100 });
    const r1 = resolveTurn(start, { hero: 'virgo', rotations: [{ row: 3, col: 3, direction: 'clockwise' }] });
    // 必殺だけの消去は連鎖0。回復は必殺の110だけ（必殺で消えたピンクは通常の回復を出さない）
    expect(r1.state.stats).toEqual({ maxChain: 0, specials: 1, damageDealt: 0, healed: 110 });
  });

  it('記録は前のターンの値に積み上がる（最大連鎖は大きいほう）', () => {
    const start = stateWith(createBattle(1, 'stardust'), QUIET_ROWS, {
      stats: { maxChain: 4, specials: 2, damageDealt: 100, healed: 30 },
    });
    const r = resolveTurn(start, { hero: 'aries', rotations: [{ row: 3, col: 3, direction: 'clockwise' }] });
    expect(r.state.stats).toEqual({ maxChain: 4, specials: 2, damageDealt: 100, healed: 30 });
  });

  it('とどめのダメージは、敵の残りHPを超えた分を数えない', () => {
    const redL = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];
    const start = stateWith(createBattle(1, 'stardust'), redL, { enemyHp: 5 });
    const r = resolveTurn(start, { hero: 'aries', rotations: [{ row: 3, col: 3, direction: 'clockwise' }] });
    expect(r.state.status).toBe('victory');
    expect(r.state.stats.damageDealt).toBe(5);
  });
});

describe('★の条件', () => {
  const stage = findStage('1-3')!;
  const base = { partyMaxHp: 300 };
  it('負けたら★0、勝てば★1以上', () => {
    expect(starsFor(stage, { ...base, victory: false, turns: 3, partyHp: 300 })).toBe(0);
    expect(starsFor(stage, { ...base, victory: true, turns: stage.targetTurns + 1, partyHp: 300 })).toBe(1);
  });
  it('目標ターン以内なら★2、さらにHPが半分以上残っていれば★3', () => {
    expect(starsFor(stage, { ...base, victory: true, turns: stage.targetTurns, partyHp: 149 })).toBe(2);
    expect(starsFor(stage, { ...base, victory: true, turns: stage.targetTurns, partyHp: 150 })).toBe(3);
  });
});

describe('進行の保存', () => {
  it('最初は1-1だけ遊べ、★1以上で次が開く', () => {
    let p = emptyProgress();
    expect(isUnlocked(p, '1-1')).toBeTruthy();
    expect(isUnlocked(p, '1-2')).toBeFalsy();
    expect(nextStageId(p)).toBe('1-1');
    p = recordResult(p, '1-1', 0, null);
    expect(isUnlocked(p, '1-2')).toBeFalsy();
    p = recordResult(p, '1-1', 2, 7);
    expect(isUnlocked(p, '1-2')).toBeTruthy();
    expect(nextStageId(p)).toBe('1-2');
    expect(isUnlocked(p, '9-9')).toBeFalsy();
  });

  it('★とターン数は良いほうを残し、記録すると途中のバトルは消える', () => {
    let p: Progress = { ...emptyProgress(), battle: { stageId: '1-1', state: createBattle(1, 'stardust'), pending: [] } };
    p = recordResult(p, '1-1', 3, 9);
    p = recordResult(p, '1-1', 1, 12);
    p = recordResult(p, '1-1', 2, 8);
    expect(p.stages['1-1']).toEqual({ stars: 3, bestTurns: 8 });
    expect(p.battle).toBeNull();
  });

  it('全部クリアすると次のステージは最後のステージ', () => {
    let p = emptyProgress();
    for (const s of ALL_STAGES) p = recordResult(p, s.id, 1, 20);
    expect(nextStageId(p)).toBe(ALL_STAGES[ALL_STAGES.length - 1].id);
  });

  it('保存した文字列から読み戻せる（途中のバトルも）', () => {
    let state = createBattle(42, 'mistbeast');
    state = resolveTurn(state, { hero: 'aries', rotations: [{ row: 1, col: 1, direction: 'clockwise' }] }).state;
    const pending = [{ row: 1, col: 2, direction: 'clockwise' as const }];
    const p = { ...recordResult(emptyProgress(), '1-1', 3, 6), battle: { stageId: '1-2', state, pending } };
    const back = parseProgress(JSON.stringify(p));
    expect(back).toEqual(p);
    // 読み戻した状態から同じ手を指すと、同じ結果になる
    expect(back.battle!.pending).toEqual(pending);
    const a = { hero: 'sagittarius' as const, rotations: [{ row: 2, col: 0, direction: 'counterclockwise' as const }] };
    expect(resolveTurn(back.battle!.state, a)).toEqual(resolveTurn(state, a));
  });

  it('壊れた値や知らないステージは捨て、読める部分は残す', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('not json')).toEqual(emptyProgress());
    expect(parseProgress('[]')).toEqual(emptyProgress());
    const raw = JSON.stringify({ stages: { '1-1': { stars: 2, bestTurns: 7 }, '9-9': { stars: 3 }, '1-2': { stars: 5 } } });
    expect(parseProgress(raw).stages).toEqual({ '1-1': { stars: 2, bestTurns: 7 } });
  });

  it('続けられない途中のバトルは捨てる', () => {
    const unlocked = { '1-1': { stars: 1, bestTurns: 9 }, '1-2': { stars: 1, bestTurns: 9 }, '1-3': { stars: 1, bestTurns: 9 }, '1-4': { stars: 1, bestTurns: 9 } };
    const parseWith = (stageId: string, state: unknown) =>
      parseProgress(JSON.stringify({ stages: unlocked, battle: { stageId, state } })).battle;
    const good = createBattle(3, 'stardust');
    const bad = (patch: Record<string, unknown>) => parseWith('1-1', { ...good, ...patch });
    expect(bad({})).not.toBeNull();
    expect(bad({ status: 'victory' })).toBeNull();
    expect(bad({ partyHp: 9999 })).toBeNull();
    expect(bad({ enemyId: 'nobody' })).toBeNull();
    expect(bad({ board: [['red']] })).toBeNull();
    expect(bad({ stats: undefined })).toBeNull();
    // HP 0 のまま「戦闘中」にはしない
    expect(bad({ partyHp: 0 })).toBeNull();
    expect(bad({ enemyHp: 0 })).toBeNull();
    // 最大HPは今の設定データと同じであること
    expect(bad({ partyMaxHp: 99999, partyHp: 50 })).toBeNull();
    expect(bad({ enemyMaxHp: 9999 })).toBeNull();
    // 強攻撃のない敵に残りターンがある
    expect(bad({ enemyChargeIn: 2 })).toBeNull();
    // ステージと敵が合わない
    expect(parseWith('1-1', createBattle(3, 'shadow'))).toBeNull();
    expect(isBattleState(null)).toBeFalsy();

    // 強攻撃のある敵：残りターンは 1〜間隔 の中だけ
    const shadow = createBattle(3, 'shadow');
    const every = ENEMIES.shadow.heavy!.every;
    expect(parseWith('1-5', shadow)).not.toBeNull();
    expect(parseWith('1-5', { ...shadow, enemyChargeIn: null })).toBeNull();
    expect(parseWith('1-5', { ...shadow, enemyChargeIn: every + 1 })).toBeNull();
    expect(parseWith('1-5', { ...shadow, enemyChargeIn: 0 })).toBeNull();
  });

  it('回した途中の分は、おかしければ回していないことにする（盤面の状態は残す）', () => {
    const state = createBattle(3, 'stardust');
    const read = (pending: unknown) =>
      parseProgress(JSON.stringify({ stages: {}, battle: { stageId: '1-1', state, pending } })).battle;
    expect(read([{ row: 0, col: 0, direction: 'clockwise' }])!.pending).toHaveLength(1);
    expect(read(undefined)!.pending).toEqual([]);
    expect(read([{ row: 4, col: 0, direction: 'clockwise' }])!.pending).toEqual([]);
    expect(read([{ row: 0, col: 0, direction: 'up' }])!.pending).toEqual([]);
    const r = { row: 0, col: 0, direction: 'clockwise' };
    expect(read([r, r, r, r])!.pending).toEqual([]);
    expect(read([r, r, r, r])!.state).toEqual(state);
  });

  it('まだ開いていないステージの途中バトルは捨てる', () => {
    const raw = JSON.stringify({ stages: {}, battle: { stageId: '1-5', state: createBattle(3, 'shadow'), pending: [] } });
    expect(parseProgress(raw).battle).toBeNull();
  });
});

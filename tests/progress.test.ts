import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { ALL_STAGES, findStage, starsFor } from '../src/data/stages';
import { createBattle, resolveTurn } from '../src/game/combat';
import { emptyProgress, isBattleState, isUnlocked, nextStageId, parseProgress, recordResult, type Progress } from '../src/storage/progress';
import { QUIET_ROWS, stateWith } from './helpers';

describe('敵の強攻撃と記録', () => {
  it('強攻撃のある敵は、決まったターンごとに強攻撃し、残りターンを数え直す', () => {
    const enemy = ENEMIES.shadow;
    const heavy = enemy.heavy!;
    let state = stateWith(createBattle(5, 'shadow'), QUIET_ROWS);
    expect(state.enemyChargeIn).toBe(heavy.every);
    const kinds: boolean[] = [];
    for (let t = 0; t < heavy.every * 2; t++) {
      const r = resolveTurn(state, { hero: 'aries', row: 3, col: 3, direction: t % 2 ? 'counterclockwise' : 'clockwise' });
      const attack = r.events.find((e) => e.type === 'enemyAttack');
      if (attack?.type !== 'enemyAttack') throw new Error('攻撃がない');
      expect(attack.amount).toBe(attack.heavy ? heavy.attack : enemy.attack);
      kinds.push(attack.heavy);
      state = r.state;
    }
    // every=4 なら 4ターン目と8ターン目が強攻撃
    expect(kinds.map((h, i) => (h ? i + 1 : 0)).filter(Boolean)).toEqual([heavy.every, heavy.every * 2]);
  });

  it('強攻撃のない敵は残りターンを持たず、いつも同じ攻撃', () => {
    const state = createBattle(5, 'stardust');
    expect(state.enemyChargeIn).toBeNull();
    const r = resolveTurn(stateWith(state, QUIET_ROWS), { hero: 'aries', row: 3, col: 3, direction: 'clockwise' });
    expect(r.state.enemyChargeIn).toBeNull();
  });

  it('知らない敵では始められない', () => {
    expect(() => createBattle(1, 'nobody')).toThrow();
  });

  it('記録（最大連鎖・必殺の回数・与えたダメージ・回復量）がターンごとに積み上がる', () => {
    const pink = ['PPGPR', 'PPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
    const start = stateWith(createBattle(1, 'stardust'), pink, { partyHp: 100 });
    const r1 = resolveTurn(start, { hero: 'virgo', row: 3, col: 3, direction: 'clockwise' });
    expect(r1.state.stats.specials).toBe(1);
    const healed = r1.events.reduce((s, e) => (e.type === 'heal' ? s + e.amount : s), 0);
    expect(r1.state.stats.healed).toBe(healed);
    const maxChain = r1.events.reduce((m, e) => (e.type === 'clear' ? Math.max(m, e.chain) : m), 0);
    expect(r1.state.stats.maxChain).toBe(maxChain);
    expect(r1.state.stats.damageDealt).toBe(start.enemyHp - r1.state.enemyHp);
  });

  it('とどめのダメージは、敵の残りHPを超えた分を数えない', () => {
    const redL = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];
    const start = stateWith(createBattle(1, 'stardust'), redL, { enemyHp: 5 });
    const r = resolveTurn(start, { hero: 'aries', row: 3, col: 3, direction: 'clockwise' });
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
    let p: Progress = { ...emptyProgress(), battle: { stageId: '1-1', state: createBattle(1, 'stardust') } };
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
    state = resolveTurn(state, { hero: 'aries', row: 1, col: 1, direction: 'clockwise' }).state;
    const p = { ...recordResult(emptyProgress(), '1-1', 3, 6), battle: { stageId: '1-2', state } };
    const back = parseProgress(JSON.stringify(p));
    expect(back).toEqual(p);
    // 読み戻した状態から同じ手を指すと、同じ結果になる
    const a = { hero: 'sagittarius' as const, row: 2, col: 0, direction: 'counterclockwise' as const };
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
    const good = createBattle(3, 'stardust');
    const bad = (patch: Record<string, unknown>) =>
      parseProgress(JSON.stringify({ stages: {}, battle: { stageId: '1-1', state: { ...good, ...patch } } })).battle;
    expect(bad({})).not.toBeNull();
    expect(bad({ status: 'victory' })).toBeNull();
    expect(bad({ partyHp: 9999 })).toBeNull();
    expect(bad({ enemyId: 'nobody' })).toBeNull();
    expect(bad({ enemyId: 'shadow', enemyHp: 1, enemyMaxHp: 1250 })).toBeNull(); // ステージと敵が合わない
    expect(bad({ board: [['red']] })).toBeNull();
    expect(bad({ stats: undefined })).toBeNull();
    expect(isBattleState(null)).toBeFalsy();
  });
});

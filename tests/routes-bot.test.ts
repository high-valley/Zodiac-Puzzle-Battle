import { describe, expect, it } from 'vitest';
import { hashToRoute, routeToHash, type Route } from '../src/routes';
import { createBattle, resolveTurn } from '../src/game/combat';
import { allActions, chooseAction } from '../tools/bot';

describe('画面の行き先と URL', () => {
  it('行き先 → URL → 行き先 で元に戻る', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'quest' },
      { name: 'quest', stageId: '1-3' },
      { name: 'battle', stageId: '1-2' },
      { name: 'result' },
    ];
    for (const r of routes) expect(hashToRoute(routeToHash(r))).toEqual(r);
  });

  it('知らない URL や空の URL はホーム', () => {
    expect(hashToRoute('')).toEqual({ name: 'home' });
    expect(hashToRoute('#/')).toEqual({ name: 'home' });
    expect(hashToRoute('#/nowhere')).toEqual({ name: 'home' });
    expect(hashToRoute('#/battle')).toEqual({ name: 'home' });
  });
});

describe('計測用の自動プレイヤー', () => {
  it('手は96通り（3人 × 交点16 × 向き2）', () => {
    expect(allActions()).toHaveLength(96);
  });

  it('どの強さでも、選ぶ手はいつも有効（強い敵で最後まで）', () => {
    const valid = new Set(allActions().map((a) => JSON.stringify(a)));
    for (const level of ['random', 'skilled', 'planner'] as const) {
      let state = createBattle(11, 'shadow');
      let seed = 3;
      for (let t = 0; t < (level === 'planner' ? 6 : 200) && state.status === 'playing'; t++) {
        const c = chooseAction(state, level, seed);
        expect(valid.has(JSON.stringify(c.action))).toBeTruthy();
        seed = c.seed;
        state = resolveTurn(state, c.action).state;
      }
    }
  });

  it('補充で落ちてくるオーブ（seed の先）を見ない：盤面が同じなら rngSeed が違っても同じ手を選ぶ', () => {
    for (const level of ['skilled', 'planner'] as const) {
      for (const enemy of ['stardust', 'shadow']) {
        const base = createBattle(21, enemy);
        const a = chooseAction(base, level, 5).action;
        const b = chooseAction({ ...base, rngSeed: (base.rngSeed + 12345) >>> 0 }, level, 5).action;
        expect(b).toEqual(a);
      }
    }
  });

  it('上手な自動プレイヤーは、でたらめより明らかに強い', () => {
    let wins = { random: 0, skilled: 0 };
    for (const level of ['random', 'skilled'] as const) {
      for (let i = 0; i < 20; i++) {
        let state = createBattle(1000 + i, 'mistbeast');
        let seed = i;
        while (state.status === 'playing') {
          const c = chooseAction(state, level, seed);
          seed = c.seed;
          state = resolveTurn(state, c.action).state;
        }
        if (state.status === 'victory') wins = { ...wins, [level]: wins[level] + 1 };
      }
    }
    expect(wins.skilled).toBeGreaterThan(15);
    expect(wins.random).toBeLessThan(5);
  });
});

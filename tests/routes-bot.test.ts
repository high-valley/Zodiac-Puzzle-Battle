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

  it('どの強さでも、戦闘が終わるまで有効な手だけを選ぶ', () => {
    for (const level of ['random', 'skilled'] as const) {
      let state = createBattle(11, 'stardust');
      let seed = 3;
      for (let t = 0; t < 80 && state.status === 'playing'; t++) {
        const c = chooseAction(state, level, seed);
        seed = c.seed;
        state = resolveTurn(state, c.action).state;
      }
      expect(state.status === 'playing').toBeFalsy();
    }
  });
});

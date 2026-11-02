import { describe, expect, it } from 'vitest';
import { FEATURE_IDS, hashToRoute, routeToHash, tabOf, type Route } from '../src/routes';
import { parseBoard } from './helpers';
import { createBattle, resolveTurn } from '../src/game/combat';
import { MAX_ROTATIONS_PER_TURN } from '../src/data/balance';
import { isValidIntersection } from '../src/game/board';
import { chooseAction, shapeProgress } from '../tools/bot';

describe('画面の行き先と URL', () => {
  it('行き先 → URL → 行き先 で元に戻る', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'quest' },
      { name: 'quest', stageId: '1-3' },
      { name: 'battle', stageId: '1-2' },
      { name: 'result' },
      { name: 'party' },
      { name: 'heroes' },
      { name: 'heroes', heroId: 'scorpio' },
      { name: 'book' },
      ...FEATURE_IDS.map((id) => ({ name: 'feature', id }) as Route),
    ];
    for (const r of routes) expect(hashToRoute(routeToHash(r))).toEqual(r);
  });

  it('知らない URL や空の URL はホーム', () => {
    expect(hashToRoute('')).toEqual({ name: 'home' });
    expect(hashToRoute('#/')).toEqual({ name: 'home' });
    expect(hashToRoute('#/nowhere')).toEqual({ name: 'home' });
    expect(hashToRoute('#/battle')).toEqual({ name: 'home' });
  });

  it('知らないキャラ名は育成の一覧（Object の持ち物の名前も通さない）', () => {
    expect(hashToRoute('#/heroes/ophiuchus')).toEqual({ name: 'heroes' });
    expect(hashToRoute('#/heroes/constructor')).toEqual({ name: 'heroes' });
    expect(hashToRoute('#/heroes/toString')).toEqual({ name: 'heroes' });
  });

  it('光らせるタブ：バトルとリザルトはタブバーを出さず、図鑑はメニュー', () => {
    expect(tabOf({ name: 'home' })).toBe('home');
    expect(tabOf({ name: 'quest', stageId: '1-1' })).toBe('quest');
    expect(tabOf({ name: 'party' })).toBe('party');
    expect(tabOf({ name: 'heroes', heroId: 'leo' })).toBe('heroes');
    expect(tabOf({ name: 'book' })).toBe('menu');
    expect(tabOf({ name: 'battle', stageId: '1-1' })).toBeNull();
    expect(tabOf({ name: 'result' })).toBeNull();
  });

  it('準備中の画面は #/<名前> で開け、ホームのタブを光らせる', () => {
    expect(FEATURE_IDS).toHaveLength(9);
    expect(hashToRoute('#/gacha')).toEqual({ name: 'feature', id: 'gacha' });
    expect(routeToHash({ name: 'feature', id: 'shop' })).toBe('#/shop');
    expect(tabOf({ name: 'feature', id: 'news' })).toBe('home');
    // Object の持ち物の名前は画面名として通さない
    expect(hashToRoute('#/constructor')).toEqual({ name: 'home' });
  });
});

describe('計測用の自動プレイヤー', () => {
  it('どの強さでも、選ぶ手はいつも有効（1〜3回の回転、範囲内の交点）', () => {
    for (const level of ['random', 'skilled', 'expert'] as const) {
      let state = createBattle(11, 'shadow');
      let seed = 3;
      for (let t = 0; t < (level === 'expert' ? 2 : 60) && state.status === 'playing'; t++) {
        const c = chooseAction(state, level, seed);
        expect(c.action.rotations.length >= 1 && c.action.rotations.length <= MAX_ROTATIONS_PER_TURN).toBeTruthy();
        for (const r of c.action.rotations) expect(isValidIntersection(r.row, r.col)).toBeTruthy();
        seed = c.seed;
        state = resolveTurn(state, c.action).state;
      }
    }
  });

  it('補充で落ちてくるオーブ（seed の先）を見ない：盤面が同じなら rngSeed が違っても同じ手を選ぶ', () => {
    for (const level of ['skilled', 'expert'] as const) {
      for (const enemy of ['stardust', 'shadow']) {
        const base = createBattle(21, enemy);
        const a = chooseAction(base, level, 5).action;
        const b = chooseAction({ ...base, rngSeed: (base.rngSeed + 12345) >>> 0 }, level, 5).action;
        expect(b).toEqual(a);
      }
    }
  });

  it('必殺の形のそろい具合を数える', () => {
    const board = parseBoard(['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR']);
    expect(shapeProgress(board, 'aries')).toEqual({ count: 5, size: 5 });
    expect(shapeProgress(board, 'virgo').size).toBe(4);
  });

  it('上手な自動プレイヤーは、でたらめより明らかに強い', () => {
    const wins = { random: 0, skilled: 0 };
    for (const level of ['random', 'skilled'] as const) {
      for (let i = 0; i < 12; i++) {
        let state = createBattle(1000 + i, 'mistbeast');
        let seed = i;
        while (state.status === 'playing') {
          const c = chooseAction(state, level, seed);
          seed = c.seed;
          state = resolveTurn(state, c.action).state;
        }
        if (state.status === 'victory') wins[level]++;
      }
    }
    expect(wins.skilled).toBeGreaterThan(10);
    expect(wins.random).toBeLessThan(3);
  });
});

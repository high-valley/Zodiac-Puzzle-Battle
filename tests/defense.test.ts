import { describe, expect, it } from 'vitest';
import { damageTaken } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { HEROES } from '../src/data/heroes';
import { normalEffect, specialEffect } from '../src/game/combat';
import { heroDefense, partyDefense } from '../src/game/party';
import type { HeroId } from '../src/game/types';
import { estimate, nextEnemyAttack } from '../tools/bot';
import { createBattle } from '../src/game/combat';
import { parseBoard } from './helpers';

// 仕様書 12.11 の表（防御と係数）
const TABLE: Record<HeroId, [number, number]> = {
  aries: [12, 12],
  taurus: [24, 11],
  gemini: [10, 12],
  cancer: [24, 8],
  leo: [6, 13],
  virgo: [12, 9],
  libra: [14, 12],
  scorpio: [6, 13],
  sagittarius: [10, 12],
  capricorn: [22, 11],
  aquarius: [8, 10],
  pisces: [12, 12],
};

describe('防御力と色の弱点（仕様書 12.11）', () => {
  it('12人の防御と係数が仕様書の表どおり', () => {
    for (const [id, [def, coef]] of Object.entries(TABLE) as [HeroId, [number, number]][]) {
      const h = HEROES[id];
      expect(h.defense).toBe(def);
      expect(h.actions[h.special.color]!.coef).toBe(coef);
    }
  });

  it('防御もレベルで伸びる（Lv6 で 1.5倍）。仲間の合計で効く', () => {
    expect(heroDefense('taurus', 6)).toBe(36);
    expect(partyDefense([{ id: 'taurus', level: 1 }, { id: 'leo', level: 1 }])).toBe(30);
    expect(damageTaken(100, 30)).toBe(77);
  });

  it('必殺の耐性（×0.7）は、レベルをかけてから最後に1回だけ丸める（.5 は切り上げ）', () => {
    // 威力160（さそり座）Lv6 → 240 × 0.7 = 168
    expect(specialEffect('scorpio', 6, { resist: 'blue' }).damage).toBe(168);
    // 威力110 Lv6 → 165 × 0.7 = 115.5 → 116
    expect(specialEffect('gemini', 6, { resist: 'blue' }).damage).toBe(116);
    // 回復役の必殺には弱点がかからない
    expect(specialEffect('virgo', 1, { weak: 'pink' }).heal).toBe(HEROES.virgo.special.power);
  });

  it('通常の攻撃も .5 を切り上げる（小数の誤差で切り捨てにならない）', () => {
    // さそり座 青10個・3連鎖（×1.5）・耐性（×0.7）：13 × 10 × 1.5 × 0.7 = 136.5 → 137
    expect(normalEffect('scorpio', { red: 0, blue: 10, green: 0, pink: 0 }, 3, 1, { resist: 'blue' }).damage).toBe(137);
  });

  it('弱点と特性は掛け算で重なる（おうし座の量 × 弱点）', () => {
    const c = HEROES.taurus.actions.red!.coef;
    expect(normalEffect('taurus', { red: 5, blue: 0, green: 0, pink: 0 }, 1, 1, { weak: 'red' }).damage).toBe(Math.round(c * 5 * 1.5 * 1.5));
  });

  it('自動プレイヤーの見積もりも、防御と弱点を入れた値', () => {
    const state = createBattle(1, 'stardust');
    expect(nextEnemyAttack(state)).toBe(damageTaken(ENEMIES.stardust.attack, partyDefense(state.party)));
    // 赤の3個並び（星屑のかけらは赤が弱点）
    const board = parseBoard(['RRRGB', 'GBGBG', 'BGBGB', 'GBGBG', 'BGBGB']);
    const e = estimate(board, [{ id: 'aries', level: 1 }], ENEMIES.stardust);
    expect(e.damage).toBe(normalEffect('aries', { red: 3, blue: 0, green: 0, pink: 0 }, 1, 1, ENEMIES.stardust).damage);
  });
});

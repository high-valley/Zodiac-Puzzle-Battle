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

// 防御と係数（2026-11-07〜 仕様書 12.13 のタイプの値。12.11 の表は10倍前の値）
const TABLE: Record<HeroId, [number, number]> = {
  aries: [120, 120],
  taurus: [100, 110],
  gemini: [100, 110],
  cancer: [240, 80],
  leo: [60, 140],
  virgo: [100, 100],
  libra: [120, 120],
  scorpio: [60, 140],
  sagittarius: [120, 120],
  capricorn: [240, 100],
  aquarius: [90, 90],
  pisces: [100, 110],
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
    expect(heroDefense('taurus', 6)).toBe(150);
    expect(partyDefense([{ id: 'taurus', level: 1 }, { id: 'leo', level: 1 }])).toBe(160);
    expect(damageTaken(1000, 300)).toBe(769);
  });

  it('必殺の耐性（×0.7）は、レベルをかけてから最後に1回だけ丸める（.5 は切り上げ）', () => {
    // 威力1600（さそり座）Lv6 → 2400 × 0.7 = 1680
    expect(specialEffect('scorpio', 6, { resist: 'blue' }).damage).toBe(1680);
    // 威力1100 Lv6 → 1650 × 0.7 = 1155。必殺の威力が100の倍数なので、今のデータでは .5 は出ない。
    // .5 の切り上げは scaled（party-growth の「ちょうど .5 になる値」）と、下の通常の攻撃で確かめる
    expect(specialEffect('gemini', 6, { resist: 'blue' }).damage).toBe(1155);
    // 回復役の必殺には弱点がかからない
    expect(specialEffect('virgo', 1, { weak: 'pink' }).heal).toBe(HEROES.virgo.special.power);
  });

  it('通常の攻撃も .5 を切り上げる（小数の誤差で切り捨てにならない）', () => {
    // おうし座（体力型・係数110）赤3個・3連鎖（×1.5）・耐性（×0.7）：110 × 3 × 1.5 × 0.7 = 346.5 → 347（3個なので量の特性はかからない）
    expect(normalEffect('taurus', { red: 3, blue: 0, green: 0, pink: 0 }, 3, 1, { resist: 'red' }).damage).toBe(347);
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

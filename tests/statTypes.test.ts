// ステータスのタイプ（仕様書 12.13）と、キャラ一覧の並び替え（2026-11-07）
import { describe, expect, it } from 'vitest';
import { ALL_HEROES, ATTACKER_TYPES, HEALER_TYPES, HEROES } from '../src/data/heroes';
import { sortHeroes } from '../src/components/heroSort';
import type { HeroId, OrbColor } from '../src/game/types';

describe('ステータスのタイプ', () => {
  it('同じ色の3人は、みな別のタイプ', () => {
    const byColor = new Map<OrbColor, string[]>();
    for (const id of ALL_HEROES) {
      const c = HEROES[id].special.color;
      byColor.set(c, [...(byColor.get(c) ?? []), HEROES[id].statType]);
    }
    for (const [, types] of byColor) {
      expect(types).toHaveLength(3);
      expect(new Set(types).size).toBe(3);
    }
  });

  it('HP・防御・係数はタイプの値どおり（攻撃キャラも回復役も）', () => {
    for (const id of ALL_HEROES) {
      const h = HEROES[id];
      const table = (h.role === 'healer' ? HEALER_TYPES : ATTACKER_TYPES) as Record<string, { hp: number; defense: number; coef: number }>;
      const t = table[h.statType];
      expect(t === undefined).toBe(false);
      expect(h.maxHpContribution).toBe(t.hp);
      expect(h.defense).toBe(t.defense);
      expect(h.actions[h.special.color]!.coef).toBe(t.coef);
      // 係数は10の倍数（画面の攻撃力・回復力が小数にならない）
      expect(t.coef % 10).toBe(0);
    }
  });

  it('最初の3人の HP と防御の合計は、タイプ分けの前と同じ（10倍で 3000・340）', () => {
    const first: HeroId[] = ['aries', 'sagittarius', 'virgo'];
    expect(first.reduce((n, id) => n + HEROES[id].maxHpContribution, 0)).toBe(3000);
    expect(first.reduce((n, id) => n + HEROES[id].defense, 0)).toBe(340);
  });
});

describe('キャラ一覧の並び替え', () => {
  const joined = (id: HeroId) => ['aries', 'sagittarius', 'virgo', 'libra'].includes(id);
  const level = (id: HeroId) => ({ aries: 12, sagittarius: 9, virgo: 15, libra: 3 })[id as 'aries'] ?? 1;

  it('星座順：仲間を先に、まだ仲間でないキャラは後ろに（どちらも星座順）', () => {
    const order = sortHeroes('zodiac', joined, level);
    expect(order.slice(0, 4)).toEqual(['aries', 'virgo', 'libra', 'sagittarius']);
    expect(order.slice(4)).toEqual(ALL_HEROES.filter((id) => !joined(id)));
  });

  it('数値は大きい順。まだ仲間でないキャラは数値に関係なく後ろ', () => {
    expect(sortHeroes('level', joined, level).slice(0, 4)).toEqual(['virgo', 'aries', 'sagittarius', 'libra']);
    const hp = sortHeroes('hp', joined, level);
    expect(hp.slice(4).every((id) => !joined(id))).toBe(true);
  });

  it('同じ値なら星座順', () => {
    const same = () => 1;
    // みな Lv1 で同じレベル → 星座順
    expect(sortHeroes('level', joined, same).slice(0, 4)).toEqual(['aries', 'virgo', 'libra', 'sagittarius']);
  });

  it('色は赤・青・緑・ピンクの順', () => {
    const all = () => true;
    const colors = sortHeroes('color', all, () => 1).map((id) => HEROES[id].special.color);
    expect(colors).toEqual(['red', 'red', 'red', 'blue', 'blue', 'blue', 'green', 'green', 'green', 'pink', 'pink', 'pink']);
  });
});

import { describe, expect, it } from 'vitest';
import { ALL_HEROES, HEROES } from '../src/data/heroes';
import { normalEffect } from '../src/game/combat';
import { heroMaxHp, heroStats, scaled, statText } from '../src/game/party';

// 育成・編成に出すステータスが、戦闘の計算と合っていること（2026-11-04）
describe('heroStats', () => {
  for (const id of ALL_HEROES) {
    it(`${HEROES[id].name}：HP・攻撃力（回復力）・必殺の威力が戦闘と合う`, () => {
      const h = HEROES[id];
      // 行動の色は必殺の色と同じ1色
      expect(Object.keys(h.actions)).toEqual([h.special.color]);
      for (const level of [1, 2, 11, 20]) {
        const st = heroStats(id, level);
        expect(st.hp).toBe(heroMaxHp(id, level));
        expect(st.special).toBe(scaled(h.special.power, level));
        // 特性のかからない値で比べる（連鎖2段目・3個。先陣・量・連鎖の特性はここでは効かない形に）
        const counts = { red: 0, blue: 0, green: 0, pink: 0, [h.special.color]: 3 };
        const e = normalEffect(id, counts, 1, level);
        const value = h.role === 'healer' ? e.heal : e.damage;
        if (!h.trait) expect(value).toBe(Math.round(st.power * 3));
      }
    });
  }

  it('数の出し方：整数はそのまま、小数は1桁', () => {
    expect(statText(12)).toBe('12');
    expect(statText(12.6)).toBe('12.6');
    expect(statText(9.45)).toBe('9.4');
  });
});

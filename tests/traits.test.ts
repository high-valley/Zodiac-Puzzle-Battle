import { describe, expect, it } from 'vitest';
import { TRAITS, damageTaken } from '../src/data/balance';
import { ALL_HEROES, HEROES, TRAIT_LABEL } from '../src/data/heroes';
import { ENEMIES } from '../src/data/enemies';
import { createBattle, normalEffect, resolveTurn } from '../src/game/combat';
import { partyDefense } from '../src/game/party';
import type { BattleState, HeroId, OrbColor } from '../src/game/types';
import { isBattleState } from '../src/storage/progress';
import { QUIET_ROWS, stateWith } from './helpers';

const c = (o: Partial<Record<OrbColor, number>>) => ({ red: 0, blue: 0, green: 0, pink: 0, ...o });
const coef = (id: HeroId) => HEROES[id].actions[HEROES[id].special.color]!.coef;
const quiet = { rotations: [{ row: 3, col: 3, direction: 'clockwise' as const }] };

describe('キャラ特性（仕様書 12.8。12人全員）', () => {
  it('12人とも特性があり、名前と説明がある', () => {
    for (const id of ALL_HEROES) {
      expect(!!HEROES[id].trait).toBe(true);
      expect(TRAIT_LABEL[HEROES[id].trait!].name.length > 0).toBe(true);
    }
    expect(new Set(ALL_HEROES.map((id) => HEROES[id].trait)).size).toBe(12);
  });

  it('2回攻撃（ふたご座）：合わせて ×1.2', () => {
    expect(normalEffect('gemini', c({ blue: 3 }), 1).damage).toBe(Math.round(coef('gemini') * 3 * TRAITS.twinTotal));
  });

  it('遠距離（いて座）：上の2段で消えた分だけ強い', () => {
    const base = normalEffect('sagittarius', c({ blue: 3 }), 1).damage;
    const top = normalEffect('sagittarius', c({ blue: 3 }), 1, 1, undefined, { top: c({ blue: 3 }) }).damage;
    expect(base).toBe(coef('sagittarius') * 3);
    expect(top).toBe(Math.round(coef('sagittarius') * 3 * (1 + TRAITS.farBonus)));
  });

  it('均衡（てんびん座）：ほかの色が消えた数だけ強い', () => {
    expect(normalEffect('libra', c({ green: 3, red: 3, blue: 3 }), 1, 1, undefined, { colors: 3 }).damage).toBe(
      Math.round(coef('libra') * 3 * (1 + TRAITS.balancePerColor * 2)),
    );
  });

  it('溜め（やぎ座）：溜めた数だけ強く、最大3', () => {
    expect(normalEffect('capricorn', c({ green: 3 }), 1, 1, undefined, { charge: 2 }).damage).toBe(Math.round(coef('capricorn') * 3 * 2));
    expect(normalEffect('capricorn', c({ green: 3 }), 1, 1, undefined, { charge: 9 }).damage).toBe(Math.round(coef('capricorn') * 3 * 2.5));
  });

  it('溜め：攻撃しないターンは溜まり、攻撃したら使い切る', () => {
    let s: BattleState = stateWith(createBattle(1, 'stardust', [{ id: 'capricorn', level: 1 }]), QUIET_ROWS);
    for (let i = 0; i < 4; i++) s = { ...resolveTurn(s, quiet).state, board: s.board, partyHp: s.partyMaxHp };
    expect(s.traits?.charge).toBe(TRAITS.chargeMax);
  });

  it('渦（うお座）：2段目からの連鎖で攻撃すると、少し回復もする', () => {
    expect(normalEffect('pisces', c({ green: 3 }), 1).heal).toBe(0);
    const e = normalEffect('pisces', c({ green: 3 }), 2);
    expect(e.heal).toBe(Math.round(e.damage * TRAITS.vortexHeal));
  });

  it('大回復（おとめ座）：4個以上で ×1.5', () => {
    expect(normalEffect('virgo', c({ pink: 4 }), 1).heal).toBe(Math.round(coef('virgo') * 4 * TRAITS.bigHealMultiplier));
  });

  it('盾（かに座）：回復したターンは敵の攻撃が3割減る', () => {
    // 左上にピンクの四隅（かに座の必殺）
    const corners = ['PBPGB', 'BGBGR', 'PBPRG', 'GRGBG', 'BGBRB'];
    const party = [{ id: 'aries' as const, level: 1 }, { id: 'cancer' as const, level: 1 }];
    const s = stateWith(createBattle(1, 'stardust', party), corners, { partyHp: 50 });
    const r = resolveTurn(s, { rotations: [{ row: 3, col: 3, direction: 'clockwise' }] });
    const atk = r.events.find((e) => e.type === 'enemyAttack');
    expect(r.events.some((e) => e.type === 'special')).toBe(true);
    expect(atk?.type === 'enemyAttack' && atk.shield).toBe(true);
    expect(atk?.type === 'enemyAttack' && atk.amount).toBe(Math.round(damageTaken(ENEMIES.stardust.attack, partyDefense(party)) * (1 - TRAITS.shieldCut)));
  });

  it('毒と恵みの雨：続く分は保存でき、壊れた値は読まない', () => {
    const s = createBattle(1, 'stardust');
    expect(isBattleState({ ...s, traits: { poison: { amount: 10, turns: 2 }, rain: { amount: 5, turns: 1 }, charge: 1 } })).toBe(true);
    expect(isBattleState({ ...s, traits: { poison: { amount: -1, turns: 2 } } })).toBe(false);
    expect(isBattleState(s)).toBe(true);
  });

  it('毒：前のターンの毒はターンの終わりにダメージを与え、残りターンが減る', () => {
    const s = stateWith(createBattle(1, 'stardust'), QUIET_ROWS, { traits: { poison: { amount: 15, turns: 2 } } });
    const r = resolveTurn(s, quiet);
    expect(r.events.some((e) => e.type === 'poison' && e.amount === 15)).toBe(true);
    expect(r.state.traits?.poison).toEqual({ amount: 15, turns: 1 });
    expect(r.state.enemyHp).toBe(s.enemyHp - 15);
  });

  it('恵みの雨：前のターンからの回復が入り、残りターンが減る', () => {
    const s = stateWith(createBattle(1, 'stardust'), QUIET_ROWS, { partyHp: 100, traits: { rain: { amount: 12, turns: 1 } } });
    const r = resolveTurn(s, quiet);
    expect(r.events.some((e) => e.type === 'rain' && e.amount === 12)).toBe(true);
    expect(r.state.traits?.rain).toBe(undefined);
  });
});

describe('特性：ターンをまたぐもの（レビューの指摘）', () => {
  it('溜め：必殺だけで攻撃したターンは溜まらない。やぎ座がいなければ溜まらない', () => {
    const horns = ['GBGPR', 'GPGBR', 'RGBRB', 'BRPGP', 'PBRBG'];
    const s = stateWith(createBattle(1, 'stardust', [{ id: 'capricorn', level: 1 }]), horns);
    const r = resolveTurn(s, quiet);
    expect(r.events.some((e) => e.type === 'special')).toBe(true);
    expect(r.state.traits?.charge).toBe(undefined);
    const noCap = resolveTurn(stateWith(createBattle(1, 'stardust'), QUIET_ROWS), quiet);
    expect(noCap.state.traits?.charge).toBe(undefined);
  });

  it('溜め：攻撃した段で使い切る', () => {
    const r = normalEffect('capricorn', c({ green: 3 }), 1, 1, undefined, { charge: 3 });
    expect(r.damage).toBe(Math.round(coef('capricorn') * 3 * 2.5));
  });

  it('毒：毒で倒せば敵は攻撃せず勝ち。表示する量は実際に減った量', () => {
    const s = stateWith(createBattle(1, 'stardust'), QUIET_ROWS, { enemyHp: 10, traits: { poison: { amount: 15, turns: 2 } } });
    const r = resolveTurn(s, quiet);
    expect(r.state.status).toBe('victory');
    expect(r.events.some((e) => e.type === 'enemyAttack')).toBe(false);
    expect(r.events.find((e) => e.type === 'poison')?.type === 'poison' && (r.events.find((e) => e.type === 'poison') as { amount: number }).amount).toBe(10);
  });

  it('再現性：特性の状態を持ったまま、同じ入力なら同じ結果', () => {
    const s = stateWith(createBattle(3, 'stardust', [{ id: 'scorpio', level: 1 }, { id: 'aquarius', level: 1 }, { id: 'capricorn', level: 1 }]), QUIET_ROWS, {
      traits: { poison: { amount: 9, turns: 2 }, rain: { amount: 4, turns: 2 }, charge: 2 },
      partyHp: 100,
    });
    expect(JSON.stringify(resolveTurn(s, quiet))).toBe(JSON.stringify(resolveTurn(s, quiet)));
  });
});

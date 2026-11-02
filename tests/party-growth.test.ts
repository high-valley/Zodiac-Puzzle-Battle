import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, expToNext, levelMultiplier } from '../src/data/growth';
import { ALL_HEROES, DEFAULT_PARTY, HEROES } from '../src/data/heroes';
import { ALL_STAGES } from '../src/data/stages';
import { createBattle, normalEffect, resolveTurn } from '../src/game/combat';
import { battleExp, gainExp } from '../src/game/growth';
import { heroMaxHp, partyMaxHp, partyProblem, scaled } from '../src/game/party';
import { SHAPES } from '../src/game/specials';
import type { HeroId, PartyMember } from '../src/game/types';
import { applyBattleExp, emptyProgress, parseProgress, partyMembers } from '../src/storage/progress';
import { stateWith } from './helpers';

const m = (id: HeroId, level = 1): PartyMember => ({ id, level });

describe('12星座のデータ', () => {
  it('12人そろっていて、星座の順に並ぶ', () => {
    expect(ALL_HEROES).toHaveLength(12);
    expect(new Set(ALL_HEROES).size).toBe(12);
    for (const id of ALL_HEROES) expect(HEROES[id].id).toBe(id);
  });

  it('攻撃キャラは赤・青・緑で攻撃し、係数の合計は31（得意な色が12）。回復キャラはピンクだけで回復', () => {
    for (const id of ALL_HEROES) {
      const h = HEROES[id];
      if (h.role === 'attacker') {
        expect(Object.keys(h.actions).sort()).toEqual(['blue', 'green', 'red']);
        const coefs = Object.values(h.actions).map((a) => a!.coef);
        expect(coefs.reduce((s, c) => s + c, 0)).toBe(31);
        expect(h.special.color === 'pink').toBeFalsy();
      } else {
        expect(Object.keys(h.actions)).toEqual(['pink']);
        expect(h.special.color).toBe('pink');
      }
    }
  });

  it('攻撃10人・回復2人（かに座・おとめ座）で、必殺の形は全員ちがう', () => {
    expect(ALL_HEROES.filter((id) => HEROES[id].role === 'attacker')).toHaveLength(10);
    expect(ALL_HEROES.filter((id) => HEROES[id].role === 'healer')).toEqual(['cancer', 'virgo']);
    expect(new Set(ALL_HEROES.map((id) => HEROES[id].special.shape)).size).toBe(12);
  });

  it('どの必殺の形も盤面（5×5）に収まり、向きの重複がない', () => {
    for (const id of ALL_HEROES) {
      const os = SHAPES[HEROES[id].special.shape];
      const keys = os.map((o) => [...o].map(([r, c]) => `${r},${c}`).sort().join(' '));
      expect(new Set(keys).size).toBe(os.length);
      for (const o of os) {
        expect(Math.max(...o.map(([r]) => r)) < 5 && Math.max(...o.map(([, c]) => c)) < 5).toBeTruthy();
      }
    }
  });
});

describe('編成のルール', () => {
  it('攻撃キャラのいない編成は noAttacker（回復役が3人いたとしたら）', () => {
    // 今の回復役は2人なので、しし座も回復役として扱う役割の引き方を渡す
    const roleOf = (id: HeroId) => (id === 'leo' ? 'healer' : HEROES[id].role);
    expect(partyProblem([m('cancer'), m('virgo'), m('leo')], roleOf)).toBe('noAttacker');
    expect(partyProblem([m('cancer'), m('virgo'), m('aries')], roleOf)).toBeNull();
  });

  it('3人・同じキャラは1人まで・攻撃キャラが1人以上（1回の編成に入れる回復役は0〜2人）', () => {
    expect(partyProblem(DEFAULT_PARTY)).toBeNull();
    expect(partyProblem([m('aries'), m('leo'), m('cancer')])).toBeNull();
    expect(partyProblem([m('aries'), m('leo'), m('taurus')])).toBeNull(); // 攻撃3人（攻撃特化）
    expect(partyProblem([m('leo'), m('cancer'), m('virgo')])).toBeNull(); // 攻撃1人＋回復2人
    expect(partyProblem([m('aries'), m('virgo')])).toBe('size');
    expect(partyProblem([m('aries'), m('aries'), m('virgo')])).toBe('duplicate');
    expect(partyProblem([m('aries'), m('leo'), m('virgo', 0)])).toBe('level');
    expect(partyProblem([m('aries'), m('leo'), m('virgo', MAX_LEVEL + 1)])).toBe('level');
    expect(partyProblem([m('aries'), m('nobody' as HeroId), m('virgo')])).toBe('unknown');
  });

  it('ルールに合わない編成では戦闘を始められない', () => {
    expect(() => createBattle(1, 'stardust', [m('cancer'), m('virgo')])).toThrow();
    expect(createBattle(1, 'stardust', [m('aries'), m('leo'), m('taurus')]).partyMaxHp).toBe(310);
  });

  it('編成にいないキャラでは行動できない', () => {
    const state = createBattle(1, 'stardust', [m('leo'), m('scorpio'), m('cancer')]);
    expect(() => resolveTurn(state, { hero: 'aries', rotations: [{ row: 0, col: 0, direction: 'clockwise' }] })).toThrow();
    expect(() => resolveTurn(state, { hero: 'leo', rotations: [{ row: 0, col: 0, direction: 'clockwise' }] })).not.toThrow();
  });
});

describe('レベルによる強さ', () => {
  it('レベル1で倍率1、1上がるごとに5%', () => {
    expect(levelMultiplier(1)).toBe(1);
    expect(levelMultiplier(11)).toBe(1.5);
    expect(MAX_LEVEL).toBe(20);
    expect(levelMultiplier(MAX_LEVEL)).toBe(1.95);
  });

  it('ちょうど .5 になる値はどのレベルでも切り上げる（小数の誤差で切り捨てない）', () => {
    expect(scaled(90, 2)).toBe(95); // 94.5
    expect(scaled(90, 4)).toBe(104); // 103.5
    expect(scaled(110, 4)).toBe(127); // 126.5
    expect(heroMaxHp('gemini', 4)).toBe(104);
  });

  it('パーティー最大HPは3人のレベル込みの寄与値の合計', () => {
    const party = [m('aries', 11), m('sagittarius'), m('virgo', 3)];
    expect(heroMaxHp('aries', 11)).toBe(150);
    expect(partyMaxHp(party)).toBe(150 + 90 + Math.round(110 * 1.1));
    expect(createBattle(1, 'stardust', party).partyMaxHp).toBe(partyMaxHp(party));
  });

  it('通常効果と必殺の威力はレベルで伸びる', () => {
    const counts = { red: 3, blue: 0, green: 0, pink: 0 };
    expect(normalEffect('aries', counts, 1, 11).damage).toBe(Math.round(12 * 3 * 1.5));
    // 赤L字の盤面で、レベル1とレベル11の必殺のダメージをくらべる
    const redL = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];
    const action = { hero: 'aries' as const, rotations: [{ row: 3, col: 3, direction: 'clockwise' as const }] };
    const special = (level: number) => {
      const s = stateWith(createBattle(1, 'shadow', [m('aries', level), m('sagittarius'), m('virgo')]), redL);
      const ev = resolveTurn(s, action).events.find((e) => e.type === 'special');
      return ev && ev.type === 'special' ? ev.damage : -1;
    };
    expect(special(1)).toBe(HEROES.aries.special.power);
    expect(special(11)).toBe(Math.round(HEROES.aries.special.power * 1.5));
  });
});

describe('経験値とレベルアップ', () => {
  it('勝てばステージの経験値、負ければ4分の1', () => {
    expect(battleExp(80, true)).toBe(80);
    expect(battleExp(80, false)).toBe(20);
    expect(battleExp(30, false)).toBe(7);
  });

  it('次のレベルに要る量をためると上がり、あまりは持ち越す（一度に何段も上がれる）', () => {
    expect(gainExp({ level: 1, exp: 0 }, expToNext(1) - 1)).toEqual({ level: 1, exp: expToNext(1) - 1, levelsGained: 0 });
    expect(gainExp({ level: 1, exp: 0 }, expToNext(1) + 5)).toEqual({ level: 2, exp: 5, levelsGained: 1 });
    const big = gainExp({ level: 1, exp: 0 }, expToNext(1) + expToNext(2) + expToNext(3));
    expect(big).toEqual({ level: 4, exp: 0, levelsGained: 3 });
  });

  it('最大レベルで止まり、それ以上は経験値をためない', () => {
    expect(gainExp({ level: 1, exp: 0 }, 1_000_000)).toEqual({ level: MAX_LEVEL, exp: 0, levelsGained: MAX_LEVEL - 1 });
    expect(gainExp({ level: MAX_LEVEL, exp: 0 }, 500)).toEqual({ level: MAX_LEVEL, exp: 0, levelsGained: 0 });
  });

  it('どのステージにも経験値があり、先のステージほど多い', () => {
    const exps = ALL_STAGES.map((s) => s.exp);
    exps.forEach((e, i) => i > 0 && expect(e).toBeGreaterThan(exps[i - 1]));
  });
});

describe('編成とレベルの保存', () => {
  it('最初は おひつじ座・いて座・おとめ座、全員レベル1', () => {
    expect(partyMembers(emptyProgress())).toEqual(DEFAULT_PARTY.map((x) => ({ ...x })));
  });

  it('保存した編成とレベルを読み戻せる', () => {
    const p = { ...emptyProgress(), party: ['leo', 'scorpio', 'pisces'] as HeroId[], heroes: { leo: { level: 5, exp: 12 } } };
    const back = parseProgress(JSON.stringify(p));
    expect(back.party).toEqual(['leo', 'scorpio', 'pisces']);
    // うお座は第2章で加入するので、仲間として扱ったときの3人を見る（加入の判定は join.test.ts）
    expect(partyMembers(back, () => true)).toEqual([m('leo', 5), m('scorpio'), m('pisces')]);
  });

  it('ルールに合わない編成やおかしいレベルは、読むときに直す', () => {
    const read = (o: object) => parseProgress(JSON.stringify({ ...emptyProgress(), ...o }));
    expect(read({ party: ['cancer', 'virgo'] }).party).toEqual(emptyProgress().party); // 2人しかいない
    expect(read({ party: ['aries', 'leo', 'taurus'] }).party).toEqual(['aries', 'leo', 'taurus']); // 攻撃3人は組める
    expect(read({ party: ['aries', 'aries', 'virgo'] }).party).toEqual(emptyProgress().party);
    expect(read({ party: ['aries', 'nobody', 'virgo'] }).party).toEqual(emptyProgress().party);
    expect(read({ heroes: { leo: { level: 0, exp: 0 } } }).heroes).toEqual({});
    expect(read({ heroes: { leo: { level: MAX_LEVEL + 1, exp: 0 } } }).heroes).toEqual({});
    expect(read({ heroes: { nobody: { level: 3, exp: 0 } } }).heroes).toEqual({});
    // 経験値が次のレベルの量以上なら 0 に戻す
    expect(read({ heroes: { leo: { level: 2, exp: expToNext(2) } } }).heroes).toEqual({ leo: { level: 2, exp: 0 } });
  });
});

describe('キャラ名の確かめ', () => {
  it('Object の持ち物の名前はキャラ名として通さない', async () => {
    const { isHeroId } = await import('../src/data/heroes');
    const { partyProblem } = await import('../src/game/party');
    expect(isHeroId('leo')).toBe(true);
    for (const bad of ['constructor', 'toString', '__proto__', 'ophiuchus', 3, null]) expect(isHeroId(bad)).toBe(false);
    expect(partyProblem([{ id: 'constructor' as never, level: 1 }, { id: 'leo', level: 1 }, { id: 'virgo', level: 1 }])).toBe('unknown');
  });
});

describe('12星座の性能の決まり（仕様書 12.3）', () => {
  it('攻撃キャラの必殺の威力は形の作りやすさで決まる（やさしい110・ふつう140・むずかしい160）', () => {
    const POWER = { easy: 110, normal: 140, hard: 160 } as const;
    for (const id of ALL_HEROES) {
      const h = HEROES[id];
      if (h.role === 'attacker') expect(h.special.power).toBe(POWER[h.special.difficulty]);
    }
  });

  it('回復役はピンクで回復し、必殺もピンク。攻撃キャラはピンクで直接効果を出さない', () => {
    for (const id of ALL_HEROES) {
      const h = HEROES[id];
      if (h.role === 'healer') {
        expect(Object.keys(h.actions)).toEqual(['pink']);
        expect(h.special.color).toBe('pink');
      } else {
        expect('pink' in h.actions).toBe(false);
        expect(h.special.color).not.toBe('pink');
      }
    }
  });

  it('12体の必殺の形はすべて違う', () => {
    expect(new Set(ALL_HEROES.map((id) => HEROES[id].special.shape)).size).toBe(12);
  });
});

describe('途中のバトルの編成', () => {
  const saved = (state: object, extra: object = {}) =>
    parseProgress(JSON.stringify({ ...emptyProgress(), ...extra, battle: { stageId: '1-1', state, pending: [] } })).battle;
  const base = () => createBattle(5, 'stardust', [m('leo', 7), m('scorpio'), m('pisces', 3)]);

  it('始めたときの編成とレベルのまま読み込める（今の編成やレベルが違っても）', () => {
    const state = { ...base(), selectedHero: 'scorpio' };
    const b = saved(state, { party: ['aries', 'sagittarius', 'virgo'], heroes: { leo: { level: 1, exp: 0 } } });
    expect(b?.state.party).toEqual([m('leo', 7), m('scorpio'), m('pisces', 3)]);
    expect(b?.state.partyMaxHp).toBe(partyMaxHp([m('leo', 7), m('scorpio'), m('pisces', 3)]));
  });

  it('同じキャラが2人いる・選んでいるキャラが編成にいない・壊れた編成は捨てる', () => {
    const s = base();
    expect(saved({ ...s, party: [m('cancer'), m('virgo'), m('virgo')], selectedHero: 'cancer', partyMaxHp: 330, partyHp: 330 })).toBeNull();
    // 攻撃3人の途中バトルは読み込める
    expect(saved({ ...s, party: [m('leo'), m('scorpio'), m('taurus')], selectedHero: 'leo', partyMaxHp: 300, partyHp: 300 })?.state.party).toHaveLength(3);
    expect(saved({ ...s, selectedHero: 'aries' })).toBeNull();
    expect(saved({ ...s, party: [null, m('scorpio'), m('pisces')] })).toBeNull();
    expect(saved({ ...s, party: 'leo' })).toBeNull();
  });

  it('M3 までの party の無い途中バトルは、最初の編成（レベル1）を補って続ける', () => {
    const { party: _drop, ...old } = createBattle(9, 'stardust');
    const b = saved(old);
    expect(b?.state.party).toEqual(DEFAULT_PARTY.map((x) => ({ ...x })));
    // 最初の編成にいないキャラを選んでいたものは捨てる
    expect(saved({ ...old, selectedHero: 'leo' })).toBeNull();
  });
});

describe('バトルの経験値の記録', () => {
  it('始めたときの3人に1回分だけ入り、今の編成の他のキャラには入らない', () => {
    const progress = { ...emptyProgress(), party: ['aries', 'sagittarius', 'virgo'] as HeroId[], heroes: { leo: { level: 1, exp: 35 } } };
    const { progress: next, growth } = applyBattleExp(progress, [m('leo'), m('scorpio'), m('cancer')], 30);
    expect(next.heroes.leo).toEqual({ level: 2, exp: 25 });
    expect(next.heroes.scorpio).toEqual({ level: 1, exp: 30 });
    expect(next.heroes.cancer).toEqual({ level: 1, exp: 30 });
    expect(next.heroes.aries).toBeFalsy();
    expect(growth).toEqual([
      { id: 'leo', before: 1, after: 2 },
      { id: 'scorpio', before: 1, after: 1 },
      { id: 'cancer', before: 1, after: 1 },
    ]);
    // 元の進行は書き換えない
    expect(progress.heroes).toEqual({ leo: { level: 1, exp: 35 } });
  });
});

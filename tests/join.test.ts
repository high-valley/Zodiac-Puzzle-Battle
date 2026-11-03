import { describe, expect, it } from 'vitest';
import { ALL_HEROES, DEFAULT_PARTY, HERO_JOIN_STAGE, HEROES } from '../src/data/heroes';
import { findStage } from '../src/data/stages';
import { partyProblem } from '../src/game/party';
import type { HeroId } from '../src/game/types';
import { hashToRoute, routeToHash, tabOf } from '../src/routes';
import {
  activeParty,
  emptyProgress,
  heroesJoinedBy,
  isHeroJoined,
  joinedHeroes,
  partyMembers,
  recordResult,
} from '../src/storage/progress';
import { parseSettings } from '../src/storage/settings';

describe('仲間の加入（仕様書 12.6）', () => {
  it('最初の仲間は最初の編成の3人で、その3人で編成のルールに合う', () => {
    const p = emptyProgress();
    expect(joinedHeroes(p)).toEqual(['aries', 'virgo', 'sagittarius']);
    expect(DEFAULT_PARTY.every((m) => HERO_JOIN_STAGE[m.id] === null)).toBe(true);
    expect(partyProblem(DEFAULT_PARTY)).toBeNull();
  });

  it('加入のステージは1人に1つで、1人ずつ違う。第1章のステージはすべて実在する', () => {
    const stages = ALL_HEROES.map((id) => HERO_JOIN_STAGE[id]).filter((s): s is string => s !== null);
    expect(new Set(stages).size).toBe(stages.length);
    for (const s of stages) expect(/^\d+-\d+$/.test(s)).toBe(true);
    expect(stages.filter((s) => s.startsWith('1-')).every((s) => findStage(s))).toBe(true);
  });

  it('ステージをクリアすると、そのステージの仲間が加わる（負けでは加わらない）', () => {
    let p = emptyProgress();
    expect(isHeroJoined(p, 'cancer')).toBe(false);
    p = recordResult(p, '1-1', 0, null);
    expect(isHeroJoined(p, 'cancer')).toBe(false);
    p = recordResult(p, '1-1', 2, 6);
    expect(isHeroJoined(p, 'cancer')).toBe(true);
    expect(joinedHeroes(p).includes('cancer')).toBe(true);
    expect(isHeroJoined(p, 'gemini')).toBe(false);
  });

  it('加入の知らせは初めてクリアしたときだけ', () => {
    const p = emptyProgress();
    expect(heroesJoinedBy(p, '1-3', true)).toEqual(['leo']);
    expect(heroesJoinedBy(p, '1-3', false)).toEqual([]);
    const cleared = recordResult(p, '1-3', 1, 12);
    expect(heroesJoinedBy(cleared, '1-3', true)).toEqual([]);
  });

  it('保存した編成にまだ仲間でないキャラがいれば、最初の編成で出撃する', () => {
    const p = { ...emptyProgress(), party: ['leo', 'scorpio', 'virgo'] as HeroId[] };
    expect(activeParty(p)).toEqual(['aries', 'sagittarius', 'virgo']);
    // 開発者モード（全員を仲間として扱う）なら、保存した編成のまま
    expect(activeParty(p, () => true)).toEqual(['leo', 'scorpio', 'virgo']);
    expect(partyMembers(p, () => true).map((m) => m.id)).toEqual(['leo', 'scorpio', 'virgo']);
  });

  it('負けたあとに初めて勝てば知らせが出て、2回目の勝ちでは出ない', () => {
    let p = recordResult(emptyProgress(), '1-2', 0, null);
    expect(heroesJoinedBy(p, '1-2', true)).toEqual(['gemini']);
    p = recordResult(p, '1-2', 1, 9);
    expect(heroesJoinedBy(p, '1-2', true)).toEqual([]);
  });

  it('加入した仲間で組んだ編成は、そのまま出撃する', () => {
    let p = { ...emptyProgress(), party: ['leo', 'cancer', 'virgo'] as HeroId[] };
    expect(activeParty(p)).toEqual(['aries', 'sagittarius', 'virgo']);
    p = recordResult(recordResult(p, '1-1', 1, 5), '1-3', 1, 9);
    expect(activeParty(p)).toEqual(['leo', 'cancer', 'virgo']);
    expect(HEROES.leo.role).toBe('attacker');
  });
});

describe('開発者モード', () => {
  it('開発者画面は #/dev で、メニューのタブを光らせる', () => {
    expect(hashToRoute('#/dev')).toEqual({ name: 'dev' });
    expect(routeToHash({ name: 'dev' })).toBe('#/dev');
    expect(tabOf({ name: 'dev' })).toBe('menu');
  });

  it('「すべて解放」は既定でオフ。壊れた値はオフ', () => {
    expect(parseSettings(null).devUnlockAll).toBe(false);
    expect(parseSettings(JSON.stringify({ devUnlockAll: true })).devUnlockAll).toBe(true);
    expect(parseSettings(JSON.stringify({ devUnlockAll: 'yes' })).devUnlockAll).toBe(false);
  });
});

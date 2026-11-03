import { describe, expect, it } from 'vitest';
import { ALL_HEROES, DEFAULT_PARTY, HERO_JOIN, HEROES, joinersOf, type HeroJoin } from '../src/data/heroes';
import { partyProblem } from '../src/game/party';
import { ALL_STAGES } from '../src/data/stages';
import { joinText } from '../src/components/heroCard';
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
  // 加入のしくみを確かめるための表（今の設定データとは別。今の設定は第1章では誰も加入しない）
  const TABLE: Record<HeroId, HeroJoin> = { ...HERO_JOIN, cancer: { stageId: '1-1' }, gemini: { stageId: '1-2' }, leo: { stageId: '1-3' } };
  const joined = (p: ReturnType<typeof emptyProgress>) => (id: HeroId) => isHeroJoined(p, id, TABLE);

  it('最初の仲間は最初の編成の3人で、その3人で編成のルールに合う', () => {
    const p = emptyProgress();
    expect(joinedHeroes(p)).toEqual(['aries', 'virgo', 'sagittarius']);
    expect(DEFAULT_PARTY.every((m) => HERO_JOIN[m.id] === 'start')).toBe(true);
    expect(partyProblem(DEFAULT_PARTY)).toBeNull();
  });

  it('今の設定：第1章では誰も加入せず、最初の新しい仲間は第2章の最後（しし座）。ほかは未定', () => {
    for (const s of ['1-1', '1-2', '1-3', '1-4', '1-5']) expect(joinersOf(s)).toEqual([]);
    expect(HERO_JOIN.leo).toEqual({ stageId: '2-5' });
    expect(heroesJoinedBy(emptyProgress(), '2-5', true)).toEqual(['leo']);
    expect(ALL_HEROES.filter((id) => HERO_JOIN[id] === 'later')).toHaveLength(8);
    // 第1章をすべてクリアしても仲間は3人のまま
    let p = emptyProgress();
    for (const s of ['1-1', '1-2', '1-3', '1-4', '1-5']) p = recordResult(p, s, 3, 5);
    expect(joinedHeroes(p)).toEqual(['aries', 'virgo', 'sagittarius']);
  });

  it('加入のステージは1人に1つで、1人ずつ違う', () => {
    const stages = ALL_HEROES.map((id) => HERO_JOIN[id]).flatMap((j) => (typeof j === 'object' ? [j.stageId] : []));
    expect(new Set(stages).size).toBe(stages.length);
    for (const s of stages) expect(/^\d+-\d+$/.test(s)).toBe(true);
  });

  it('「後で決める」のキャラは、何をクリアしても加入しない', () => {
    const later = ALL_HEROES.filter((id) => HERO_JOIN[id] === 'later');
    const stages = [...ALL_STAGES.map((s) => s.id), ...[...Array(9)].map((_, i) => `2-${i + 1}`)];
    let p = emptyProgress();
    for (const s of stages) {
      expect(joinersOf(s).some((id) => later.includes(id))).toBe(false);
      p = recordResult(p, s, 3, 5);
    }
    for (const id of later) expect(isHeroJoined(p, id)).toBe(false);
  });

  it('仲間になる条件の文', () => {
    expect(joinText('aries')).toBe('最初から仲間');
    expect(joinText('pisces')).toBe('ストーリーを進めると加入');
    expect(joinText('leo')).toBe('第2章で加入');
  });

  it('ステージをクリアすると、そのステージの仲間が加わる（負けでは加わらない）', () => {
    let p = emptyProgress();
    expect(isHeroJoined(p, 'cancer', TABLE)).toBe(false);
    p = recordResult(p, '1-1', 0, null);
    expect(isHeroJoined(p, 'cancer', TABLE)).toBe(false);
    p = recordResult(p, '1-1', 2, 6);
    expect(isHeroJoined(p, 'cancer', TABLE)).toBe(true);
    expect(joinedHeroes(p, joined(p)).includes('cancer')).toBe(true);
    expect(isHeroJoined(p, 'gemini', TABLE)).toBe(false);
  });

  it('加入の知らせは初めてクリアしたときだけ', () => {
    const p = emptyProgress();
    expect(heroesJoinedBy(p, '1-3', true, TABLE)).toEqual(['leo']);
    expect(heroesJoinedBy(p, '1-3', false, TABLE)).toEqual([]);
    const cleared = recordResult(p, '1-3', 1, 12);
    expect(heroesJoinedBy(cleared, '1-3', true, TABLE)).toEqual([]);
  });

  it('負けたあとに初めて勝てば知らせが出て、2回目の勝ちでは出ない', () => {
    let p = recordResult(emptyProgress(), '1-2', 0, null);
    expect(heroesJoinedBy(p, '1-2', true, TABLE)).toEqual(['gemini']);
    p = recordResult(p, '1-2', 1, 9);
    expect(heroesJoinedBy(p, '1-2', true, TABLE)).toEqual([]);
  });

  it('保存した編成にまだ仲間でないキャラがいれば、最初の編成で出撃する', () => {
    const p = { ...emptyProgress(), party: ['leo', 'scorpio', 'virgo'] as HeroId[] };
    expect(activeParty(p)).toEqual(['aries', 'sagittarius', 'virgo']);
    // 開発者モード（全員を仲間として扱う）なら、保存した編成のまま
    expect(activeParty(p, () => true)).toEqual(['leo', 'scorpio', 'virgo']);
    expect(partyMembers(p, () => true).map((m) => m.id)).toEqual(['leo', 'scorpio', 'virgo']);
  });

  it('加入した仲間で組んだ編成は、そのまま出撃する', () => {
    let p = { ...emptyProgress(), party: ['leo', 'cancer', 'virgo'] as HeroId[] };
    expect(activeParty(p, joined(p))).toEqual(['aries', 'sagittarius', 'virgo']);
    p = recordResult(recordResult(p, '1-1', 1, 5), '1-3', 1, 9);
    expect(activeParty(p, joined(p))).toEqual(['leo', 'cancer', 'virgo']);
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

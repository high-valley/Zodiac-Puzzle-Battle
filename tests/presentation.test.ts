import { describe, expect, it } from 'vitest';
import { cueForEvent } from '../src/audio/cues';
import { createBattle, resolveTurn } from '../src/game/combat';
import type { BattleEvent } from '../src/game/types';
import { DEFAULT_SETTINGS, parseSettings } from '../src/storage/settings';
import { stateWith } from './helpers';

describe('cueForEvent', () => {
  it('すべての種類の出来事に効果音がある', () => {
    const board = createBattle(1).board;
    const zero = { red: 0, blue: 0, green: 0, pink: 0 };
    const events: BattleEvent[] = [
      { type: 'rotate', row: 0, col: 0, direction: 'clockwise', board },
      { type: 'special', special: { heroId: 'virgo', shape: 'square', color: 'pink', cells: [] }, name: 'x', damage: 0, heal: 110 },
      { type: 'clear', chain: 2, cells: [], counts: zero, damage: 0, heal: 0, board },
      { type: 'heal', amount: 1, partyHp: 1 },
      { type: 'damage', amount: 1, enemyHp: 1 },
      { type: 'enemyAttack', amount: 1, partyHp: 1 },
      { type: 'end', status: 'victory' },
      { type: 'end', status: 'defeat' },
    ];
    expect(events.map((e) => cueForEvent(e, false)?.name)).toEqual([
      'rotate',
      'special',
      'clear',
      'heal',
      'hit',
      'hurt',
      'victory',
      'defeat',
    ]);
  });

  it('消去の音は連鎖の段数を持つ（必殺だけの消去は 0）', () => {
    const board = createBattle(1).board;
    const zero = { red: 0, blue: 0, green: 0, pink: 0 };
    expect(cueForEvent({ type: 'clear', chain: 3, cells: [], counts: zero, damage: 0, heal: 0, board }, false)).toEqual({
      name: 'clear',
      step: 3,
    });
    expect(cueForEvent({ type: 'clear', chain: 0, cells: [], counts: zero, damage: 0, heal: 0, board }, true)).toEqual({
      name: 'clear',
      step: 0,
    });
  });

  it('必殺が出たターンは、攻撃・回復の音が強くなる', () => {
    const rows = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];
    const { events } = resolveTurn(stateWith(createBattle(1), rows), { hero: 'aries', row: 3, col: 3, direction: 'clockwise' });
    const special = events.some((e) => e.type === 'special');
    const damage = events.find((e) => e.type === 'damage');
    expect(special).toBeTruthy();
    expect(damage && cueForEvent(damage, special)).toEqual({ name: 'hit', big: true });
    expect(damage && cueForEvent(damage, false)).toEqual({ name: 'hit', big: false });
  });
});

describe('parseSettings', () => {
  it('何も保存されていなければ既定値（音はオン、遊び方は未表示）', () => {
    expect(parseSettings(null)).toEqual({ soundOn: true, tutorialSeen: false });
    expect(DEFAULT_SETTINGS.soundOn).toBe(true);
  });

  it('保存された値を読む', () => {
    expect(parseSettings('{"soundOn":false,"tutorialSeen":true}')).toEqual({ soundOn: false, tutorialSeen: true });
  });

  it('壊れた値・型の違う値・足りない項目は既定値で補う', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"soundOn":"no"}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"tutorialSeen":true}')).toEqual({ soundOn: true, tutorialSeen: true });
  });
});

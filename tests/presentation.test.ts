import { describe, expect, it } from 'vitest';
import { cueForEvent, turnHasSpecial } from '../src/audio/cues';
import { createSoundPlayer } from '../src/audio/sound';
import { createBattle, resolveTurn } from '../src/game/combat';
import type { BattleEvent } from '../src/game/types';
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings } from '../src/storage/settings';
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

  it('必殺が出たターンだけ、攻撃・回復の音が強くなる', () => {
    const quiet = ['RBGPR', 'GPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
    const redL = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];
    const move = { hero: 'aries' as const, row: 3, col: 3, direction: 'clockwise' as const };
    const withSpecial = resolveTurn(stateWith(createBattle(1), redL), move).events;
    const withoutSpecial = resolveTurn(stateWith(createBattle(1), quiet), move).events;
    expect(turnHasSpecial(withSpecial)).toBeTruthy();
    expect(turnHasSpecial(withoutSpecial)).toBeFalsy();
    const damage = withSpecial.find((e) => e.type === 'damage');
    expect(damage && cueForEvent(damage, turnHasSpecial(withSpecial))).toEqual({ name: 'hit', big: true });
  });
});

describe('loadSettings / saveSettings', () => {
  const g = globalThis as unknown as { window?: unknown };
  const original = g.window;
  const withWindow = (w: unknown, fn: () => void) => {
    g.window = w;
    try {
      fn();
    } finally {
      g.window = original;
    }
  };

  it('localStorage が例外を投げても、既定値で読めて保存も失敗しない', () => {
    const broken = {
      get localStorage(): never {
        throw new Error('SecurityError');
      },
    };
    withWindow(broken, () => {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
      expect(() => saveSettings({ soundOn: false, tutorialSeen: true })).not.toThrow();
    });
    const throwing = {
      localStorage: {
        getItem: () => {
          throw new Error('x');
        },
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    };
    withWindow(throwing, () => {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
      expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    });
  });

  it('保存したものを読み戻せる', () => {
    const store = new Map<string, string>();
    const w = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } };
    withWindow(w, () => {
      saveSettings({ soundOn: false, tutorialSeen: true });
      expect(loadSettings()).toEqual({ soundOn: false, tutorialSeen: true });
    });
  });
});

describe('createSoundPlayer', () => {
  const g = globalThis as unknown as { window?: unknown };
  const original = g.window;

  it('オフのあいだは AudioContext を作らない', () => {
    let created = 0;
    g.window = {
      AudioContext: class {
        state = 'running';
        constructor() {
          created++;
        }
      },
    };
    try {
      const player = createSoundPlayer(false);
      player.unlock();
      player.play({ name: 'rotate' });
      expect(created).toBe(0);
      player.setEnabled(true);
      expect(created).toBe(1);
    } finally {
      g.window = original;
    }
  });

  it('AudioContext を作れない・音が使えない環境でも例外を出さない', () => {
    g.window = {
      AudioContext: class {
        constructor() {
          throw new Error('NotSupportedError');
        }
      },
    };
    try {
      const player = createSoundPlayer(true);
      expect(() => player.unlock()).not.toThrow();
      expect(() => player.play({ name: 'special' })).not.toThrow();
      expect(() => player.play({ name: 'hit', big: true })).not.toThrow();
    } finally {
      g.window = original;
    }
    g.window = {};
    try {
      expect(() => createSoundPlayer(true).play({ name: 'rotate' })).not.toThrow();
    } finally {
      g.window = original;
    }
  });

  it('再開（resume）が失敗しても例外を出さない', () => {
    g.window = {
      AudioContext: class {
        state = 'suspended';
        resume() {
          return Promise.reject(new Error('NotAllowedError'));
        }
      },
    };
    try {
      expect(() => createSoundPlayer(true).unlock()).not.toThrow();
    } finally {
      g.window = original;
    }
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

import { describe, expect, it } from 'vitest';
import { TRAITS, chainMultiplier, damageTaken } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { DEFAULT_PARTY, HEROES } from '../src/data/heroes';
import { colorMultiplier, createBattle, normalEffect, partyMaxHp, resolveTurn } from '../src/game/combat';
import { partyDefense } from '../src/game/party';
import { rotate2x2 } from '../src/game/board';
import { findMatches } from '../src/game/matching';
import { detectHeroSpecial } from '../src/game/specials';
import type { BattleState, Direction, TurnAction } from '../src/game/types';
import { QUIET_ROWS, boardToStrings, parseBoard, stateWith } from './helpers';

// 強攻撃のない敵で、ふつうの攻撃だけを確かめる
const base = createBattle(1, 'stardust');
const ENEMY = ENEMIES.stardust;
// 敵の攻撃で実際に減るHP（仲間の防御力で減らした量。仕様書 12.11）
const HIT = damageTaken(ENEMY.attack, partyDefense(base.party));
// この敵への赤の攻撃の倍率（星屑のかけらは赤が弱点）
const RED = colorMultiplier(ENEMY, 'red');

// QUIET_ROWS で交点(3,3)を回しても、マッチも必殺の形もできない
const quietMove = (direction: Direction = 'clockwise'): TurnAction => ({
  rotations: [{ row: 3, col: 3, direction }],
});
// おとめ座のいない編成（ピンク2×2があっても必殺は出ない）
const noVirgo = createBattle(1, 'stardust', [
  { id: 'aries', level: 1 },
  { id: 'sagittarius', level: 1 },
  { id: 'leo', level: 1 },
]);

// 左上にピンク2×2（どの縦横にも3個は並ばない）
const PINK_SQUARE = ['PPGPR', 'PPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
// 左上に赤L字（縦3＋横3、角を共有）
const RED_L = ['RRRPB', 'RPGBG', 'RBGPR', 'GPRBG', 'BBGPR'];

describe('戦闘の開始', () => {
  it('パーティー最大HPは3人の寄与値の合計で、共通HPは満タンから', () => {
    const expected = HEROES.aries.maxHpContribution + HEROES.sagittarius.maxHpContribution + HEROES.virgo.maxHpContribution;
    expect(partyMaxHp(DEFAULT_PARTY)).toBe(expected);
    expect(base.partyMaxHp).toBe(expected);
    expect(base.partyHp).toBe(expected);
    expect(base.enemyHp).toBe(ENEMY.maxHp);
    expect(base.status).toBe('playing');
    expect(base.turn).toBe(1);
  });
});

describe('resolveTurn', () => {
  it('マッチも必殺も無いターンは、回転と敵の攻撃だけ', () => {
    const state = stateWith(base, QUIET_ROWS);
    const { state: next, events } = resolveTurn(state, quietMove());
    expect(events.map((e) => e.type)).toEqual(['rotate', 'enemyAttack']);
    expect(next.enemyHp).toBe(state.enemyHp);
    expect(next.partyHp).toBe(state.partyHp - HIT);
    expect(next.turn).toBe(state.turn + 1);
    expect(next.rngSeed).toBe(state.rngSeed);
  });

  it('引数の状態は変更しない', () => {
    const state = stateWith(base, RED_L);
    const before = JSON.stringify(state);
    resolveTurn(state, quietMove());
    expect(JSON.stringify(state)).toBe(before);
  });

  it('おとめ座のピンク2×2は、通常マッチが無くても回復の必殺が出る', () => {
    const state = stateWith(base, PINK_SQUARE, { partyHp: 100 });
    const { state: next, events } = resolveTurn(state, quietMove());
    // 必殺 → 必殺に使った4個を消す（通常効果なし）→ 回復 → 敵の攻撃
    expect(events.map((e) => e.type)).toEqual(['rotate', 'special', 'clear', 'heal', 'enemyAttack']);
    const heal = HEROES.virgo.special.power;
    expect(next.partyHp).toBe(100 + heal - HIT);
    expect(next.enemyHp).toBe(state.enemyHp);
  });

  it('必殺の形があっても、編成にいないキャラの技は出ない', () => {
    const { events } = resolveTurn(stateWith(noVirgo, PINK_SQUARE), quietMove());
    expect(events.some((e) => e.type === 'special')).toBeFalsy();
  });

  it('必殺は回し終えた盤面で判定し、そのあと通常マッチを消す（必殺に使った赤も消える）', () => {
    const state = stateWith(base, RED_L);
    const { events } = resolveTurn(state, quietMove());
    const types = events.map((e) => e.type);
    expect(types.indexOf('special')).toBe(1);
    expect(types.indexOf('clear')).toBeGreaterThan(1);
    const special = events.find((e) => e.type === 'special');
    expect(special && special.type === 'special' && special.damage).toBe(Math.round(HEROES.aries.special.power * RED));
    const firstClear = events.find((e) => e.type === 'clear');
    expect(firstClear && firstClear.type === 'clear' && firstClear.counts.red).toBe(5);
  });

  it('必殺は1ターンに1回まで（ダメージは必殺1回分＋通常効果）', () => {
    // 赤L字が2つ
    const twoL = ['RRRPB', 'RPGBG', 'RBRRR', 'GPRBR', 'BBGPR'];
    // 交点(3,0)の回転はどちらのL字も崩さない
    const state = stateWith(base, twoL);
    const { state: next, events } = resolveTurn(state, { rotations: [{ row: 3, col: 0, direction: 'clockwise' }] });
    expect(events.filter((e) => e.type === 'special')).toHaveLength(1);
    const normal = events.reduce((sum, e) => (e.type === 'clear' ? sum + e.damage : sum), 0);
    expect(state.enemyHp - next.enemyHp).toBe(Math.min(state.enemyHp, Math.round(HEROES.aries.special.power * RED) + normal));
  });

  it('ダメージ合計は 必殺 ＋ 各連鎖の通常効果 で、敵HPに反映される', () => {
    const state = stateWith(base, RED_L);
    const { state: next, events } = resolveTurn(state, quietMove());
    let total = 0;
    for (const e of events) if (e.type === 'special' || e.type === 'clear') total += e.damage;
    const dmg = events.find((e) => e.type === 'damage');
    expect(dmg && dmg.type === 'damage' && dmg.amount).toBe(total);
    expect(next.enemyHp).toBe(state.enemyHp - total);
  });

  it('回復は敵の攻撃より先に入り、最大HPを超えない', () => {
    const state = stateWith(base, PINK_SQUARE, { partyHp: base.partyMaxHp - 10 });
    const { state: next, events } = resolveTurn(state, quietMove());
    const heal = events.find((e) => e.type === 'heal');
    expect(heal && heal.type === 'heal' && heal.partyHp).toBe(base.partyMaxHp);
    // 回復量は実際に増えた分だけ
    expect(heal && heal.type === 'heal' && heal.amount).toBe(10);
    expect(next.partyHp).toBe(base.partyMaxHp - HIT);
  });

  it('HPが満タンなら回復の出来事は出ない（必殺の演出は出る）', () => {
    const { events } = resolveTurn(stateWith(base, PINK_SQUARE), quietMove());
    expect(events.map((e) => e.type)).toEqual(['rotate', 'special', 'clear', 'enemyAttack']);
  });

  it('敵HPが0になったら勝利し、敵は攻撃しない', () => {
    const state = stateWith(base, RED_L, { enemyHp: 1 });
    const { state: next, events } = resolveTurn(state, quietMove());
    expect(next.enemyHp).toBe(0);
    expect(next.status).toBe('victory');
    expect(events.some((e) => e.type === 'enemyAttack')).toBeFalsy();
    expect(next.partyHp).toBe(state.partyHp);
    expect(events[events.length - 1]).toEqual({ type: 'end', status: 'victory' });
  });

  it('共通HPが0になったら敗北し、0未満にはならない', () => {
    const state = stateWith(base, QUIET_ROWS, { partyHp: 5 });
    const { state: next, events } = resolveTurn(state, quietMove());
    expect(next.partyHp).toBe(0);
    expect(next.status).toBe('defeat');
    expect(events[events.length - 1]).toEqual({ type: 'end', status: 'defeat' });
  });

  it('終わった戦闘や不正な操作は受け付けない', () => {
    const quiet = stateWith(base, QUIET_ROWS);
    expect(() => resolveTurn({ ...quiet, status: 'victory' }, quietMove())).toThrow();
    // 回転は1〜3回
    expect(() => resolveTurn(quiet, { rotations: [] })).toThrow();
    const r = { row: 3, col: 3, direction: 'clockwise' as const };
    expect(() => resolveTurn(quiet, { rotations: [r, r, r, r] })).toThrow();
    expect(() => resolveTurn(quiet, { rotations: [r, { row: 4, col: 0, direction: 'clockwise' }] })).toThrow();
    expect(() => resolveTurn(quiet, { rotations: [{ row: 4, col: 0, direction: 'clockwise' }] })).toThrow();
    expect(() => resolveTurn(quiet, { rotations: [{ row: 0, col: -1, direction: 'clockwise' }] })).toThrow();
    expect(() => resolveTurn(quiet, { rotations: [{ row: 0, col: 0, direction: 'up' as Direction }] })).toThrow();
  });

  it('連鎖は8段まで。各段の盤面は消去・落下・補充の後のもの', () => {
    const state = stateWith(base, RED_L);
    const { state: next, events } = resolveTurn(state, quietMove());
    const clears = events.filter((e) => e.type === 'clear');
    expect(clears.length).toBeGreaterThan(0);
    expect(clears.length).toBeLessThan(9);
    clears.forEach((e, i) => e.type === 'clear' && expect(e.chain).toBe(i + 1));
    const last = clears[clears.length - 1];
    if (last.type === 'clear') expect(boardToStrings(last.board)).toEqual(boardToStrings(next.board));
  });
});

describe('必殺に使ったオーブを消す', () => {
  const at = (cells: { row: number; col: number }[], r: number, c: number) =>
    cells.some((p) => p.row === r && p.col === c);

  it('ピンク2×2は通常マッチが無くても消え、通常の回復は出ない（連鎖にも数えない）', () => {
    const state = stateWith(base, PINK_SQUARE, { partyHp: 100 });
    const { events } = resolveTurn(state, quietMove());
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.chain).toBe(0);
    expect(first.cells).toHaveLength(4);
    for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]]) expect(at(first.cells, r, c)).toBeTruthy();
    expect(first.counts).toEqual({ red: 0, blue: 0, green: 0, pink: 0 });
    expect(first.heal).toBe(0);
  });

  const chains = (rngSeed: number) =>
    resolveTurn(stateWith(base, PINK_SQUARE, { rngSeed }), quietMove())
      .events.flatMap((e) => (e.type === 'clear' ? [e.chain] : []));

  it('必殺だけの消去のあと、落ちてきたオーブの通常マッチは1連鎖目から数える', () => {
    // rngSeed 1315 では、必殺の消去のあとに通常マッチが7段続く
    expect(chains(1315)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('必殺だけの消去は連鎖の上限（8段）に数えない', () => {
    // rngSeed 17538 では、必殺の消去のあとに通常マッチが8段に達し、マッチが残る
    const state = stateWith(base, PINK_SQUARE, { rngSeed: 17538 });
    const result = resolveTurn(state, quietMove());
    expect(result.events.flatMap((e) => (e.type === 'clear' ? [e.chain] : []))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(findMatches(result.state.board).length).toBeGreaterThan(0);
  });

  it('形の一部だけが通常マッチと重なるとき、同時に1回で消し、通常効果は通常マッチの分だけ', () => {
    // 上の行のピンク3個（横並び）が通常マッチ、うち2個がピンク2×2の上の辺と重なる
    const rows = ['PPPGR', 'PPRBG', 'RBGPR', 'GPRBG', 'RBGPR'];
    const { events } = resolveTurn(stateWith(base, rows, { partyHp: 100 }), quietMove());
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.chain).toBe(1);
    // 2×2 の4個 ＋ (0,2) の5個。重なった (0,0)(0,1) は1回だけ
    expect(first.cells).toHaveLength(5);
    for (const [r, c] of [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]]) expect(at(first.cells, r, c)).toBeTruthy();
    // 必殺だけで消えた (1,0)(1,1) は通常効果に入らない
    expect(first.counts.pink).toBe(3);
    expect(first.heal).toBe(HEROES.virgo.actions.pink!.coef * 3);
  });

  it('編成にいないキャラの形は消さない', () => {
    const { events } = resolveTurn(stateWith(noVirgo, PINK_SQUARE), quietMove());
    expect(events.some((e) => e.type === 'clear')).toBeFalsy();
  });

  it('同じ形は盤面に残らない（毎ターン必殺が出続けない）', () => {
    // 以前はピンク2×2が残り続け、離れた交点を回すだけで毎ターン回復の必殺が出ていた
    const { state: next } = resolveTurn(stateWith(base, PINK_SQUARE), quietMove());
    const found = detectHeroSpecial(next.board, 'virgo');
    // 補充でたまたま新しい2×2ができることはあるが、元の位置（左上）の形は消えている
    expect(found !== null && found.cells[0].row === 0 && found.cells[0].col === 0).toBeFalsy();
  });
});

describe('1ターンに3回まで回して「攻撃」で確定', () => {
  // 1回目の回転で縦か横に3個並ぶが、そのまま2回目で崩せる盤面
  const BOARD = ['GRGPP', 'BGGBP', 'BBRBR', 'RBRGP', 'BRBBG'];

  it('回している途中に3個並んでも消えない。回し終えた盤面だけで判定する', () => {
    const state = stateWith(base, BOARD);
    // 1回目（左回転）で3個並ぶ → 2回目（同じ交点を右回転）で元に戻す
    const { state: next, events } = resolveTurn(state, {
      rotations: [
        { row: 0, col: 0, direction: 'counterclockwise' },
        { row: 0, col: 0, direction: 'clockwise' },
      ],
    });
    expect(findMatches(rotate2x2(parseBoard(BOARD), 0, 0, 'counterclockwise')).length).toBeGreaterThan(0);
    expect(events.map((e) => e.type)).toEqual(['rotate', 'rotate', 'enemyAttack']);
    expect(boardToStrings(next.board)).toEqual(BOARD);
    // 回した回数に関係なく1ターン
    expect(next.turn).toBe(state.turn + 1);
  });

  it('1回では作れない十字も、途中で3個並べながら2回で作れる', () => {
    const state = stateWith(base, BOARD);
    const { events } = resolveTurn(state, {
      rotations: [
        { row: 0, col: 0, direction: 'counterclockwise' },
        { row: 1, col: 2, direction: 'clockwise' },
      ],
    });
    const special = events.find((e) => e.type === 'special');
    if (special?.type !== 'special') throw new Error('必殺が出ない');
    expect(special.special.shape).toBe('cross');
    expect(special.damage).toBe(HEROES.sagittarius.special.power);
    // 十字は縦3＋横3の通常マッチでもあるので、1段目に一緒に消える（連鎖1。この盤面では隣の青で横が4個並び、青は6個）
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.chain).toBe(1);
    expect(first.counts.blue).toBe(6);
    expect(first.cells).toHaveLength(6);
    for (const p of special.special.cells) {
      expect(first.cells.some((c) => c.row === p.row && c.col === p.col)).toBeTruthy();
    }
  });

  it('回す前や途中にあった必殺の形も、最後の回転で崩れれば出ない', () => {
    // 回す前から赤L字がある。1回目は関係ない所を回し（形は残る）、2回目でL字の角を崩す
    const state = stateWith(base, RED_L);
    expect(detectHeroSpecial(parseBoard(RED_L), 'aries')).not.toBeNull();
    const { events } = resolveTurn(state, {
      rotations: [
        { row: 3, col: 3, direction: 'clockwise' },
        { row: 0, col: 0, direction: 'clockwise' },
      ],
    });
    expect(events.some((e) => e.type === 'special')).toBeFalsy();
  });

  it('回転の出来事は回した回数だけ並び、それぞれの盤面は回したあとのもの', () => {
    const rotations = [
      { row: 0, col: 0, direction: 'counterclockwise' as const },
      { row: 1, col: 2, direction: 'clockwise' as const },
      { row: 3, col: 3, direction: 'clockwise' as const },
    ];
    const { events } = resolveTurn(stateWith(base, BOARD), { rotations });
    const rotates = events.filter((e) => e.type === 'rotate');
    expect(rotates).toHaveLength(3);
    let b = parseBoard(BOARD);
    rotates.forEach((e, i) => {
      b = rotate2x2(b, rotations[i].row, rotations[i].col, rotations[i].direction);
      if (e.type === 'rotate') expect(boardToStrings(e.board)).toEqual(boardToStrings(b));
    });
  });
});

describe('連鎖の上限', () => {
  // seed 47 で下の操作列を流すと、6ターン目（t = 5）で連鎖が8段に達し、マッチが残る
  const scripted = (t: number): TurnAction => ({
    rotations: [{ row: (t * 7) % 4, col: (t * 3) % 4, direction: t % 2 === 0 ? 'clockwise' : 'counterclockwise' }],
  });

  it('8段で止め、残ったマッチは次の回転のあとに消える', () => {
    let state = createBattle(47);
    for (let t = 0; t < 5; t++) state = resolveTurn(state, scripted(t)).state;
    const capped = resolveTurn(state, scripted(5));
    expect(capped.events.filter((e) => e.type === 'clear')).toHaveLength(8);
    expect(findMatches(capped.state.board).length).toBeGreaterThan(0);

    // 次のターンは、残っていたマッチから消える（1段目に clear が出る）
    expect(capped.state.status).toBe('playing');
    const next = resolveTurn(capped.state, scripted(6));
    expect(next.events.some((e) => e.type === 'clear' && e.chain === 1)).toBeTruthy();
  });
});

describe('通常効果（形ボーナスなし。自分の色だけ）', () => {
  it('自分の色の個数と連鎖段数だけで決まる', () => {
    const blue5 = { red: 0, blue: 5, green: 0, pink: 0 };
    expect(normalEffect('sagittarius', blue5, 1)).toEqual({ damage: HEROES.sagittarius.actions.blue!.coef * 5, heal: 0 });
    expect(normalEffect('sagittarius', blue5, 3).damage).toBe(Math.round(HEROES.sagittarius.actions.blue!.coef * 5 * chainMultiplier(3)));
  });

  it('自分の色でないオーブでは何もしない（攻撃キャラのほかの色・ピンク、回復役の赤青緑）', () => {
    expect(normalEffect('sagittarius', { red: 5, blue: 0, green: 5, pink: 5 }, 1)).toEqual({ damage: 0, heal: 0 });
    expect(normalEffect('aries', { red: 0, blue: 6, green: 0, pink: 6 }, 1)).toEqual({ damage: 0, heal: 0 });
    expect(normalEffect('virgo', { red: 3, blue: 3, green: 3, pink: 0 }, 1)).toEqual({ damage: 0, heal: 0 });
    expect(normalEffect('virgo', { red: 0, blue: 0, green: 0, pink: 3 }, 1).heal).toBe(HEROES.virgo.actions.pink!.coef * 3);
  });

  it('連鎖倍率は 1 + 0.25 × (段数 - 1)', () => {
    expect(chainMultiplier(1)).toBe(1);
    expect(chainMultiplier(2)).toBe(1.25);
    expect(chainMultiplier(5)).toBe(2);
  });
});

describe('仲間全員が同時に行動する（仕様書 12.7）', () => {
  // 1段目で 赤3・ピンク3 が消える盤面（上の行に赤3、2行目にピンク3）
  const RED_PINK = ['RRRGB', 'PPPBG', 'GBGBR', 'BGBGB', 'GBGBG'];

  it('自分の色が消えた仲間が、同じ段で一緒に動く（攻撃と回復が両方起きる）', () => {
    const state = stateWith(base, RED_PINK, { partyHp: 100 });
    const { events } = resolveTurn(state, quietMove());
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    const ids = first.actors.map((a) => a.heroId);
    expect(ids.includes('aries')).toBe(true);
    expect(ids.includes('virgo')).toBe(true);
    // 動いたのは、その段で自分の色が消えた仲間だけ
    for (const m of state.party) {
      expect(ids.includes(m.id)).toBe(first.counts[HEROES[m.id].special.color] > 0);
    }
    expect(first.damage).toBe(first.actors.reduce((s, a) => s + a.damage, 0));
    expect(first.heal).toBeGreaterThan(0);
  });

  it('同じ色の仲間が3人いれば、その色で3人とも攻撃する', () => {
    const reds = createBattle(1, 'stardust', [
      { id: 'aries', level: 1 },
      { id: 'taurus', level: 1 },
      { id: 'leo', level: 1 },
    ]);
    const { events } = resolveTurn(stateWith(reds, RED_PINK), quietMove());
    const first = events.find((e) => e.type === 'clear');
    if (first?.type !== 'clear') throw new Error('clear がない');
    expect(first.actors.map((a) => a.heroId).sort()).toEqual(['aries', 'leo', 'taurus']);
    // ピンクが消えても回復はしない（回復役がいない）
    expect(first.heal).toBe(0);
  });

  it('同じターンに、ほかの仲間の必殺も一緒に出る', () => {
    // 左上に赤L字、右下にピンク2×2
    const both = ['RRRGB', 'RBGBG', 'RGBPP', 'GBGPP', 'BGBGB'];
    const { events } = resolveTurn(stateWith(base, both), { rotations: [{ row: 3, col: 0, direction: 'clockwise' }] });
    const specials = events.flatMap((e) => (e.type === 'special' ? [e.special.heroId] : []));
    expect(specials.sort()).toEqual(['aries', 'virgo']);
  });
});

describe('キャラ特性（仕様書 12.8）', () => {
  const red = (n: number) => ({ red: n, blue: 0, green: 0, pink: 0 });
  // キャラごとの係数（2026-11-04 から防御力とのつり合いで 11〜13）
  const coef = (id: 'aries' | 'taurus' | 'leo') => HEROES[id].actions.red!.coef;
  const plain = (id: 'aries' | 'taurus' | 'leo', n: number, chain: number) => Math.round(coef(id) * n * chainMultiplier(chain));

  it('先陣（おひつじ座）：そのターン最初の消去だけ大きくなる', () => {
    expect(normalEffect('aries', red(3), 1).damage).toBe(Math.round(coef('aries') * 3 * TRAITS.vanguardMultiplier));
    expect(normalEffect('aries', red(3), 2).damage).toBe(plain('aries', 3, 2));
  });

  it('先陣：必殺だけの消去のあとに落ちてきた赤も、連鎖1段目なので大きくなる', () => {
    const { events } = resolveTurn({ ...stateWith(base, PINK_SQUARE), rngSeed: 7 }, quietMove());
    const clears = events.flatMap((e) => (e.type === 'clear' ? [e] : []));
    expect(clears[0].chain).toBe(0);
    expect(clears[1].chain).toBe(1);
    const aries = clears[1].actors.find((a) => a.heroId === 'aries');
    expect(aries?.damage).toBe(Math.round(coef('aries') * clears[1].counts.red * TRAITS.vanguardMultiplier * RED));
  });

  it('量（おうし座）：同じ段で離れて消えた赤も合わせて数える', () => {
    expect(normalEffect('taurus', red(6), 1).damage).toBe(Math.round(coef('taurus') * 6 * (1 + TRAITS.massPerExtra * 3)));
  });

  it('特性はレベルの倍率と重なる', () => {
    expect(normalEffect('leo', red(3), 3, 6).damage).toBe(Math.round(coef('leo') * 3 * (1 + TRAITS.chainStep * 2) * 1.5));
  });

  it('量（おうし座）：一度に多く消すほど伸びる（3個までは同じ）', () => {
    expect(normalEffect('taurus', red(3), 1).damage).toBe(plain('taurus', 3, 1));
    expect(normalEffect('taurus', red(5), 1).damage).toBe(Math.round(coef('taurus') * 5 * (1 + TRAITS.massPerExtra * 2)));
  });

  it('連鎖（しし座）：連鎖が深いほど大きく伸びる', () => {
    expect(normalEffect('leo', red(3), 1).damage).toBe(plain('leo', 3, 1));
    expect(normalEffect('leo', red(3), 3).damage).toBe(Math.round(coef('leo') * 3 * (1 + TRAITS.chainStep * 2)));
    expect(normalEffect('leo', red(3), 3).damage).toBeGreaterThan(plain('leo', 3, 3));
  });
});

describe('防御力と色の弱点（仕様書 12.11。2026-11-04）', () => {
  const red3 = { red: 3, blue: 0, green: 0, pink: 0 };
  it('弱点の色は ×1.5、耐性の色は ×0.7、ほかは ×1（回復にはかからない）', () => {
    const foe = { weak: 'red' as const, resist: 'blue' as const };
    const c = HEROES.aries.actions.red!.coef;
    expect(normalEffect('aries', red3, 2, 1, foe).damage).toBe(Math.round(c * 3 * chainMultiplier(2) * 1.5));
    expect(normalEffect('sagittarius', { red: 0, blue: 3, green: 0, pink: 0 }, 1, 1, foe).damage).toBe(Math.round(HEROES.sagittarius.actions.blue!.coef * 3 * 0.7));
    expect(normalEffect('libra', { red: 0, blue: 0, green: 3, pink: 0 }, 1, 1, foe).damage).toBe(HEROES.libra.actions.green!.coef * 3);
    expect(normalEffect('virgo', { red: 0, blue: 0, green: 0, pink: 3 }, 1, 1, { weak: 'pink' }).heal).toBe(HEROES.virgo.actions.pink!.coef * 3);
  });

  it('必殺にも弱点がかかる', () => {
    const { events } = resolveTurn(stateWith(base, RED_L), quietMove());
    const sp = events.find((e) => e.type === 'special');
    expect(sp && sp.type === 'special' && sp.damage).toBe(Math.round(HEROES.aries.special.power * 1.5));
  });

  it('敵の攻撃は、仲間の防御力の合計で割合で減る（最低1）', () => {
    expect(damageTaken(100, 0)).toBe(100);
    expect(damageTaken(100, 50)).toBe(67);
    expect(damageTaken(1, 500)).toBe(1);
    const { state: next } = resolveTurn(stateWith(base, QUIET_ROWS), quietMove());
    expect(base.partyHp - next.partyHp).toBe(damageTaken(ENEMY.attack, partyDefense(base.party)));
  });

  it('防御力の高い壁役は攻撃が低め、低いキャラは高め', () => {
    expect(HEROES.taurus.defense).toBeGreaterThan(HEROES.leo.defense);
    expect(HEROES.taurus.actions.red!.coef).toBeLessThan(HEROES.leo.actions.red!.coef);
  });
});

describe('再現性', () => {
  // seed から決まる操作列で、終わるまで（最大60ターン）進める
  function play(seed: number): { final: BattleState; log: string[] } {
    let state = createBattle(seed);
    const log: string[] = [];
    for (let t = 0; t < 60 && state.status === 'playing'; t++) {
      // 1〜3回の回転をまぜる
      const count = 1 + (t % 3);
      const action: TurnAction = {
        rotations: [...Array(count)].map((_, k) => ({
          row: (t * 7 + k * 3) % 4,
          col: (t * 3 + k) % 4,
          direction: (t + k) % 2 === 0 ? ('clockwise' as const) : ('counterclockwise' as const),
        })),
      };
      const result = resolveTurn(state, action);
      log.push(JSON.stringify(result.events));
      state = result.state;
    }
    return { final: state, log };
  }

  it('同じ seed と同じ操作列なら、出来事も最終状態も同じ', () => {
    expect(play(2026)).toEqual(play(2026));
  });

  it('seed が違えば結果も変わる', () => {
    expect(play(2026).final.board).not.toEqual(play(2027).final.board);
  });
});

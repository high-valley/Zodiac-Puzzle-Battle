// 戦闘の開始と1ターンの解決
// 処理順：回転 → 固有形判定 → 通常マッチ／連鎖 → 回復 → 攻撃 → 敵行動 → ターン更新
import { ENEMY, MAX_CHAIN, ORB_COLORS, chainMultiplier } from '../data/balance';
import { HEROES, PARTY } from '../data/heroes';
import { collapseAndRefill, createInitialBoard, isValidIntersection, rotate2x2 } from './board';
import { findMatches, matchedMask, maskToCells } from './matching';
import { detectHeroSpecial } from './specials';
import type { BattleEvent, BattleState, HeroId, OrbColor, TurnAction, TurnResult } from './types';

/** パーティー最大HP = 編成キャラの寄与値の合計 */
export function partyMaxHp(party: readonly HeroId[] = PARTY): number {
  return party.reduce((sum, id) => sum + HEROES[id].maxHpContribution, 0);
}

export function createBattle(seed: number): BattleState {
  const initial = createInitialBoard(seed >>> 0);
  const maxHp = partyMaxHp();
  return {
    board: initial.board,
    selectedHero: PARTY[0],
    turn: 1,
    partyHp: maxHp,
    partyMaxHp: maxHp,
    enemyHp: ENEMY.maxHp,
    enemyMaxHp: ENEMY.maxHp,
    rngSeed: initial.seed,
    status: 'playing',
  };
}

function emptyCounts(): Record<OrbColor, number> {
  return { red: 0, blue: 0, green: 0, pink: 0 };
}

/** 消した色ごとの個数から、選択キャラの通常効果（ダメージ・回復）を計算する */
export function normalEffect(
  heroId: HeroId,
  counts: Record<OrbColor, number>,
  chain: number,
): { damage: number; heal: number } {
  const hero = HEROES[heroId];
  let amount = 0;
  for (const color of ORB_COLORS) {
    const action = hero.actions[color];
    if (action) amount += action.coef * counts[color] * chainMultiplier(chain);
  }
  const rounded = Math.round(amount);
  return hero.role === 'healer' ? { damage: 0, heal: rounded } : { damage: rounded, heal: 0 };
}

export function resolveTurn(state: BattleState, action: TurnAction): TurnResult {
  if (state.status !== 'playing') {
    throw new Error('戦闘は終わっています');
  }
  if (!PARTY.includes(action.hero)) {
    throw new RangeError(`編成にいないキャラです: ${action.hero}`);
  }
  if (!isValidIntersection(action.row, action.col)) {
    throw new RangeError(`交点が範囲外です: (${action.row}, ${action.col})`);
  }
  if (action.direction !== 'clockwise' && action.direction !== 'counterclockwise') {
    throw new RangeError(`回転方向が不正です: ${String(action.direction)}`);
  }

  const events: BattleEvent[] = [];
  let board = rotate2x2(state.board, action.row, action.col, action.direction);
  let seed = state.rngSeed;
  events.push({ type: 'rotate', row: action.row, col: action.col, direction: action.direction, board });

  let damage = 0;
  let heal = 0;

  // 必殺は回転直後、通常マッチを消す前に判定する。選んだキャラだけ、1ターン1回
  const hero = HEROES[action.hero];
  const special = detectHeroSpecial(board, action.hero);
  if (special) {
    const sDamage = hero.role === 'attacker' ? hero.special.power : 0;
    const sHeal = hero.role === 'healer' ? hero.special.power : 0;
    damage += sDamage;
    heal += sHeal;
    events.push({ type: 'special', special, name: hero.special.name, damage: sDamage, heal: sHeal });
  }

  for (let chain = 1; chain <= MAX_CHAIN; chain++) {
    const groups = findMatches(board);
    if (groups.length === 0) break;
    const mask = matchedMask(groups);
    const cells = maskToCells(mask);
    const counts = emptyCounts();
    for (const p of cells) counts[board[p.row][p.col]]++;
    const effect = normalEffect(action.hero, counts, chain);
    damage += effect.damage;
    heal += effect.heal;
    const refilled = collapseAndRefill(board, mask, seed);
    board = refilled.board;
    seed = refilled.seed;
    events.push({ type: 'clear', chain, cells, counts, damage: effect.damage, heal: effect.heal, board });
  }

  // 味方の回復 → 敵へのダメージ → 敵の攻撃
  let partyHp = state.partyHp;
  let enemyHp = state.enemyHp;
  if (heal > 0) {
    partyHp = Math.min(state.partyMaxHp, partyHp + heal);
    events.push({ type: 'heal', amount: heal, partyHp });
  }
  if (damage > 0) {
    enemyHp = Math.max(0, enemyHp - damage);
    events.push({ type: 'damage', amount: damage, enemyHp });
  }

  let status: BattleState['status'] = 'playing';
  if (enemyHp === 0) {
    status = 'victory';
  } else {
    partyHp = Math.max(0, partyHp - ENEMY.attack);
    events.push({ type: 'enemyAttack', amount: ENEMY.attack, partyHp });
    if (partyHp === 0) status = 'defeat';
  }
  if (status !== 'playing') events.push({ type: 'end', status });

  return {
    state: {
      ...state,
      board,
      selectedHero: action.hero,
      turn: state.turn + 1,
      partyHp,
      enemyHp,
      rngSeed: seed,
      status,
    },
    events,
  };
}

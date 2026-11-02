// 戦闘の開始と1ターンの解決
// 処理順：回転 → 固有形判定 → 通常マッチ／連鎖 → 回復 → 攻撃 → 敵行動 → ターン更新
import { MAX_CHAIN, ORB_COLORS, chainMultiplier } from '../data/balance';
import { DEFAULT_ENEMY_ID, ENEMIES, type EnemyDef } from '../data/enemies';
import { HEROES, PARTY } from '../data/heroes';
import { collapseAndRefill, createInitialBoard, isValidIntersection, rotate2x2 } from './board';
import { findMatches, matchedMask, maskToCells } from './matching';
import { detectHeroSpecial } from './specials';
import type { BattleEvent, BattleState, HeroId, OrbColor, TurnAction, TurnResult } from './types';

/** パーティー最大HP = 編成キャラの寄与値の合計 */
export function partyMaxHp(party: readonly HeroId[] = PARTY): number {
  return party.reduce((sum, id) => sum + HEROES[id].maxHpContribution, 0);
}

export function enemyOf(state: Pick<BattleState, 'enemyId'>): EnemyDef {
  const enemy = ENEMIES[state.enemyId];
  if (!enemy) throw new RangeError(`敵が見つかりません: ${state.enemyId}`);
  return enemy;
}

export function createBattle(seed: number, enemyId: string = DEFAULT_ENEMY_ID): BattleState {
  const enemy = enemyOf({ enemyId });
  const initial = createInitialBoard(seed >>> 0);
  const maxHp = partyMaxHp();
  return {
    board: initial.board,
    selectedHero: PARTY[0],
    turn: 1,
    partyHp: maxHp,
    partyMaxHp: maxHp,
    enemyId,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    enemyChargeIn: enemy.heavy ? enemy.heavy.every : null,
    rngSeed: initial.seed,
    status: 'playing',
    stats: { maxChain: 0, specials: 0, damageDealt: 0, healed: 0 },
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

  // 必殺に使ったオーブは、最初の消去で通常マッチと一緒に消す。
  // 必殺だけで消えたオーブは通常効果を出さず、連鎖の段数にも数えない（通常マッチの段だけ数える）
  let specialCells = special ? special.cells : [];
  let chain = 0;
  for (;;) {
    const groups = findMatches(board);
    if (groups.length === 0 && specialCells.length === 0) break;
    if (groups.length > 0) {
      if (chain >= MAX_CHAIN) break;
      chain++;
    }
    const matched = matchedMask(groups);
    const counts = emptyCounts();
    for (const p of maskToCells(matched)) counts[board[p.row][p.col]]++;
    const effect = groups.length > 0 ? normalEffect(action.hero, counts, chain) : { damage: 0, heal: 0 };
    damage += effect.damage;
    heal += effect.heal;
    const mask = matched.map((line) => line.slice());
    for (const p of specialCells) mask[p.row][p.col] = true;
    specialCells = [];
    const refilled = collapseAndRefill(board, mask, seed);
    board = refilled.board;
    seed = refilled.seed;
    events.push({
      type: 'clear',
      chain: groups.length > 0 ? chain : 0,
      cells: maskToCells(mask),
      counts,
      damage: effect.damage,
      heal: effect.heal,
      board,
    });
  }

  // 味方の回復 → 敵へのダメージ → 敵の攻撃
  let partyHp = state.partyHp;
  let enemyHp = state.enemyHp;
  if (heal > 0) {
    partyHp = Math.min(state.partyMaxHp, partyHp + heal);
    // amount は実際に増えた量（最大HPで頭打ちになった分は含めない）。満タンなら出さない
    const healed = partyHp - state.partyHp;
    if (healed > 0) events.push({ type: 'heal', amount: healed, partyHp });
  }
  if (damage > 0) {
    enemyHp = Math.max(0, enemyHp - damage);
    events.push({ type: 'damage', amount: damage, enemyHp });
  }

  // 敵の行動：強攻撃のある敵は、残りターンが 0 になったら強攻撃して数え直す
  let status: BattleState['status'] = 'playing';
  let chargeIn = state.enemyChargeIn;
  if (enemyHp === 0) {
    status = 'victory';
  } else {
    const enemy = enemyOf(state);
    let amount = enemy.attack;
    let heavy = false;
    if (enemy.heavy && chargeIn !== null) {
      chargeIn -= 1;
      if (chargeIn <= 0) {
        amount = enemy.heavy.attack;
        heavy = true;
        chargeIn = enemy.heavy.every;
      }
    }
    partyHp = Math.max(0, partyHp - amount);
    events.push({ type: 'enemyAttack', amount, partyHp, heavy });
    if (partyHp === 0) status = 'defeat';
  }
  if (status !== 'playing') events.push({ type: 'end', status });

  const maxChainThisTurn = events.reduce((m, e) => (e.type === 'clear' ? Math.max(m, e.chain) : m), 0);
  const healedThisTurn = events.reduce((sum, e) => (e.type === 'heal' ? sum + e.amount : sum), 0);
  return {
    state: {
      ...state,
      board,
      selectedHero: action.hero,
      turn: state.turn + 1,
      partyHp,
      enemyHp,
      enemyChargeIn: chargeIn,
      rngSeed: seed,
      status,
      stats: {
        maxChain: Math.max(state.stats.maxChain, maxChainThisTurn),
        specials: state.stats.specials + (special ? 1 : 0),
        damageDealt: state.stats.damageDealt + (state.enemyHp - enemyHp),
        healed: state.stats.healed + healedThisTurn,
      },
    },
    events,
  };
}

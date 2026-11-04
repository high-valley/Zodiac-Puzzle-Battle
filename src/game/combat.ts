// 戦闘の開始と1ターンの解決
// 処理順：回転（1〜3回。この間は何も消えない）→ 攻撃で確定 → 固有形判定（仲間全員）→ 通常マッチ／連鎖 → 回復 → 攻撃 → 敵行動 → ターン更新
// 出撃した仲間は全員が同時に行動し、各キャラは自分の色のオーブが消えたときだけ動く（仕様書 12.7）
import { MAX_CHAIN, MAX_ROTATIONS_PER_TURN, TRAITS, WEAKNESS, chainMultiplier, damageTaken } from '../data/balance';
import { DEFAULT_ENEMY_ID, ENEMIES, type EnemyDef } from '../data/enemies';
import { DEFAULT_PARTY, HEROES } from '../data/heroes';
import { levelPercent } from '../data/growth';
import { partyDefense, partyMaxHp, partyProblem, scaled } from './party';
import { collapseAndRefill, createInitialBoard, isValidIntersection, rotate2x2 } from './board';
import { findMatches, matchedMask, maskToCells } from './matching';
import { detectHeroSpecial } from './specials';
import type { Actor, BattleEvent, BattleState, HeroId, OrbColor, PartyMember, SpecialResult, TurnAction, TurnResult } from './types';

export { partyMaxHp } from './party';

/** 敵の色の弱点・耐性による、その色の攻撃の倍率（仕様書 12.11）。敵がいなければ 1 */
export function colorMultiplier(enemy: Pick<EnemyDef, 'weak' | 'resist'> | undefined, color: OrbColor): number {
  if (!enemy) return 1;
  if (enemy.weak === color) return WEAKNESS.weak;
  if (enemy.resist === color) return WEAKNESS.resist;
  return 1;
}

/**
 * 必殺の効果（攻撃キャラはダメージ、回復役は回復）。ダメージには敵の色の弱点・耐性がかかる（2026-11-04 ユーザーの決定）。
 * 丸めは最後に1回だけ（レベルと弱点をかけてから）
 */
export function specialEffect(heroId: HeroId, level: number, enemy?: Pick<EnemyDef, 'weak' | 'resist'>): { damage: number; heal: number } {
  const hero = HEROES[heroId];
  if (hero.role === 'healer') return { damage: 0, heal: scaled(hero.special.power, level) };
  return { damage: Math.round((hero.special.power * levelPercent(level) * colorMultiplier(enemy, hero.special.color)) / 100 + 1e-9), heal: 0 };
}

export function enemyOf(state: Pick<BattleState, 'enemyId'>): EnemyDef {
  const enemy = ENEMIES[state.enemyId];
  if (!enemy) throw new RangeError(`敵が見つかりません: ${state.enemyId}`);
  return enemy;
}

export function createBattle(
  seed: number,
  enemyId: string = DEFAULT_ENEMY_ID,
  party: readonly PartyMember[] = DEFAULT_PARTY,
): BattleState {
  const enemy = enemyOf({ enemyId });
  const problem = partyProblem(party);
  if (problem) throw new RangeError(`編成が不正です: ${problem}`);
  const initial = createInitialBoard(seed >>> 0);
  const maxHp = partyMaxHp(party);
  return {
    board: initial.board,
    party: party.map((m) => ({ ...m })),
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

/**
 * 1段の消去での、1人の通常効果（ダメージ・回復）。自分の色の個数だけを使う（仕様書 12.7）。
 * chain はその段の連鎖段数（1〜）。特性（12.8）もここでかける。
 * 先陣は連鎖1段目（そのターン最初の通常消去）に付く。必殺だけの消去は連鎖に数えない（9.3）ので、その次の段が1段目
 */
export function normalEffect(
  heroId: HeroId,
  counts: Record<OrbColor, number>,
  chain: number,
  level = 1,
  /** 敵の色の弱点・耐性（攻撃だけにかける。仕様書 12.11）。省けば倍率なし */
  enemy?: Pick<EnemyDef, 'weak' | 'resist'>,
): { damage: number; heal: number } {
  const hero = HEROES[heroId];
  let amount = 0;
  for (const [color, action] of Object.entries(hero.actions) as [OrbColor, { coef: number }][]) {
    const n = counts[color];
    if (n <= 0) continue;
    let mult = chainMultiplier(chain);
    if (hero.trait === 'chain') mult = 1 + TRAITS.chainStep * (chain - 1);
    if (hero.trait === 'vanguard' && chain === 1) mult *= TRAITS.vanguardMultiplier;
    if (hero.trait === 'mass') mult *= 1 + TRAITS.massPerExtra * Math.max(0, n - 3);
    if (hero.role === 'attacker') mult *= colorMultiplier(enemy, color);
    amount += action.coef * n * mult * (levelPercent(level) / 100);
  }
  // 小数の誤差で .5 が切り捨てにならないように、ごく小さな値を足してから丸める（仕様書 12.4「.5 は切り上げ」）
  const rounded = Math.round(amount + 1e-9);
  return hero.role === 'healer' ? { damage: 0, heal: rounded } : { damage: rounded, heal: 0 };
}

export function resolveTurn(state: BattleState, action: TurnAction): TurnResult {
  if (state.status !== 'playing') {
    throw new Error('戦闘は終わっています');
  }
  const rotations = action.rotations;
  if (!Array.isArray(rotations) || rotations.length < 1 || rotations.length > MAX_ROTATIONS_PER_TURN) {
    throw new RangeError(`回転は1〜${MAX_ROTATIONS_PER_TURN}回です`);
  }
  for (const r of rotations) {
    if (typeof r !== 'object' || r === null) throw new RangeError('回転の指定が不正です');
    if (!isValidIntersection(r.row, r.col)) {
      throw new RangeError(`交点が範囲外です: (${r.row}, ${r.col})`);
    }
    if (r.direction !== 'clockwise' && r.direction !== 'counterclockwise') {
      throw new RangeError(`回転方向が不正です: ${String(r.direction)}`);
    }
  }

  // 回している間は何も消えない。回し終えた盤面で、必殺と消去を判定する
  const events: BattleEvent[] = [];
  let board = state.board;
  for (const r of rotations) {
    board = rotate2x2(board, r.row, r.col, r.direction);
    events.push({ type: 'rotate', row: r.row, col: r.col, direction: r.direction, board });
  }
  let seed = state.rngSeed;

  let damage = 0;
  let heal = 0;
  // 敵の色の弱点・耐性（攻撃にかける）
  const foe = enemyOf(state);

  // 必殺は回し終えた盤面で、通常マッチを消す前に判定する。仲間それぞれ、1ターン1回（同じターンに何人出てもよい）
  const specials: SpecialResult[] = [];
  for (const m of state.party) {
    const special = detectHeroSpecial(board, m.id);
    if (!special) continue;
    const hero = HEROES[m.id];
    const { damage: sDamage, heal: sHeal } = specialEffect(m.id, m.level, foe);
    damage += sDamage;
    heal += sHeal;
    specials.push(special);
    events.push({ type: 'special', special, name: hero.special.name, damage: sDamage, heal: sHeal });
  }

  // 必殺に使ったオーブは、最初の消去で通常マッチと一緒に消す。
  // 必殺だけで消えたオーブは通常効果を出さず、連鎖の段数にも数えない（通常マッチの段だけ数える）
  let specialCells = specials.flatMap((sp) => sp.cells);
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
    // 仲間全員が同時に行動する。自分の色が消えたキャラだけ動く
    const actors: Actor[] = [];
    if (groups.length > 0) {
      for (const m of state.party) {
        const e = normalEffect(m.id, counts, chain, m.level, foe);
        if (e.damage > 0 || e.heal > 0) actors.push({ heroId: m.id, damage: e.damage, heal: e.heal });
      }
    }
    const stepDamage = actors.reduce((sum, a) => sum + a.damage, 0);
    const stepHeal = actors.reduce((sum, a) => sum + a.heal, 0);
    damage += stepDamage;
    heal += stepHeal;
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
      actors,
      damage: stepDamage,
      heal: stepHeal,
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
    // 仲間の防御力の合計で、受けるダメージを割合で減らす（仕様書 12.11）
    amount = damageTaken(amount, partyDefense(state.party));
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
      turn: state.turn + 1,
      partyHp,
      enemyHp,
      enemyChargeIn: chargeIn,
      rngSeed: seed,
      status,
      stats: {
        maxChain: Math.max(state.stats.maxChain, maxChainThisTurn),
        specials: state.stats.specials + specials.length,
        damageDealt: state.stats.damageDealt + (state.enemyHp - enemyHp),
        healed: state.stats.healed + healedThisTurn,
      },
    },
    events,
  };
}

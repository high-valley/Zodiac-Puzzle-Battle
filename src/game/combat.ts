// 戦闘の開始と1ターンの解決
// 処理順：回転（1〜3回。この間は何も消えない）→ 攻撃で確定 → 固有形判定（仲間全員）→ 通常マッチ／連鎖 → 回復 → 攻撃 → 敵行動 → ターン更新
// 出撃した仲間は全員が同時に行動し、各キャラは自分の色のオーブが消えたときだけ動く（仕様書 12.7）
import { MAX_CHAIN, MAX_ROTATIONS_PER_TURN, ROCK, TRAITS, WEAKNESS, chainMultiplier, damageTaken } from '../data/balance';
import { DEFAULT_ENEMY_ID, ENEMIES, type EnemyDef } from '../data/enemies';
import { DEFAULT_PARTY, HEROES } from '../data/heroes';
import { levelPercent } from '../data/growth';
import { partyDefense, partyMaxHp, partyProblem, scaled } from './party';
import { breakAndDropRocks, cloneBoard, collapseAndRefill, createInitialBoard, freeIntersections, isRockBlocked, isValidIntersection, rotate2x2, sortPos } from './board';
import { nextInt } from './rng';
import { countJunk, findMatches, junkBeside, matchedMask, maskToCells } from './matching';
import { detectHeroSpecial } from './specials';
import type { Actor, BattleEvent, Board, BattleState, HeroId, OrbColor, PartyMember, Pos, SpecialResult, TraitState, TurnAction, TurnResult } from './types';

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
    ...(enemy.junk ? { enemyJunkIn: enemy.junk.every } : {}),
    ...(enemy.rock ? { enemyRockIn: enemy.rock.every, rocks: [] } : {}),
    rngSeed: initial.seed,
    status: 'playing',
    stats: { maxChain: 0, specials: 0, damageDealt: 0, healed: 0 },
  };
}

/**
 * 星屑でないマスから count 個を乱数で選び、星屑に変える（仕様書 12.12）。
 * 星屑はそろわないので、まぜても新しいマッチはできない。選んだマスは上の行から順に返す
 */
export function mixJunk(board: Board, count: number, seed: number, rocks: readonly Pos[] = []): { board: Board; cells: Pos[]; seed: number } {
  let s = seed;
  const free: Pos[] = [];
  // 岩で固まったオーブは星屑にしない
  const rocked = (row: number, col: number) => rocks.some((p) => p.row === row && p.col === col);
  board.forEach((line, row) => line.forEach((x, col) => x !== 'junk' && !rocked(row, col) && free.push({ row, col })));
  const picked: Pos[] = [];
  for (let i = 0; i < count && free.length > 0; i++) {
    const pick = nextInt(s, free.length);
    s = pick.seed;
    picked.push(free.splice(pick.value, 1)[0]);
  }
  if (picked.length === 0) return { board, cells: [], seed: s };
  const next = cloneBoard(board);
  for (const p of picked) next[p.row][p.col] = 'junk';
  picked.sort((a, b) => a.row - b.row || a.col - b.col);
  return { board: next, cells: picked, seed: s };
}

/**
 * 星屑でも岩でもないオーブから count 個を乱数で選び、岩で固める（仕様書 12.14）。
 * 回せる 2×2 が ROCK.minFreeIntersections より少なくなるマスは選ばない。返す rocks は固めた後のすべての岩
 */
export function placeRocks(board: Board, rocks: readonly Pos[], count: number, seed: number): { rocks: Pos[]; cells: Pos[]; seed: number } {
  let s = seed;
  const all = rocks.map((p) => ({ ...p }));
  const picked: Pos[] = [];
  for (let i = 0; i < count; i++) {
    const free: Pos[] = [];
    board.forEach((line, row) =>
      line.forEach((x, col) => {
        if (x === 'junk' || all.some((p) => p.row === row && p.col === col)) return;
        if (freeIntersections([...all, { row, col }]) < ROCK.minFreeIntersections) return;
        free.push({ row, col });
      }),
    );
    if (free.length === 0) break;
    const pick = nextInt(s, free.length);
    s = pick.seed;
    picked.push(free[pick.value]);
    all.push(free[pick.value]);
  }
  return { rocks: sortPos(all), cells: sortPos(picked), seed: s };
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
  /** 特性に使う、その段のようす（遠距離：上の段で消えた色ごとの個数、均衡：消えた色の数、溜め：溜まった数） */
  step: { top?: Record<OrbColor, number>; colors?: number; charge?: number } = {},
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
    if (hero.trait === 'twin') mult *= TRAITS.twinTotal;
    // 遠距離：上の段で消えた分だけ、1個あたり farBonus ぶん強く（全体の個数に対する割合でかける）
    if (hero.trait === 'far') mult *= 1 + (TRAITS.farBonus * Math.min(n, step.top?.[color] ?? 0)) / n;
    if (hero.trait === 'balance') mult *= 1 + TRAITS.balancePerColor * Math.max(0, (step.colors ?? 1) - 1);
    if (hero.trait === 'charge') mult *= 1 + TRAITS.chargeStep * Math.min(TRAITS.chargeMax, step.charge ?? 0);
    if (hero.trait === 'bigHeal' && n >= TRAITS.bigHealMin) mult *= TRAITS.bigHealMultiplier;
    if (hero.role === 'attacker') mult *= colorMultiplier(enemy, color);
    amount += action.coef * n * mult * (levelPercent(level) / 100);
  }
  // 小数の誤差で .5 が切り捨てにならないように、ごく小さな値を足してから丸める（仕様書 12.4「.5 は切り上げ」）
  const rounded = Math.round(amount + 1e-9);
  if (hero.role === 'healer') return { damage: 0, heal: rounded };
  // 渦（うお座）：2段目からの連鎖で攻撃したら、そのダメージの一部だけ回復もする
  const vortex = hero.trait === 'vortex' && chain >= 2 ? Math.round(rounded * TRAITS.vortexHeal + 1e-9) : 0;
  return { damage: rounded, heal: vortex };
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
    // 岩で固まったオーブを含む 2×2 は回せない（仕様書 12.14。岩は回している間は動かない）
    if (isRockBlocked(state.rocks, r.row, r.col)) {
      throw new RangeError(`岩で固まったオーブは回せません: (${r.row}, ${r.col})`);
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
  // 特性で続くもの（仕様書 12.8）
  const prevTraits = state.traits ?? {};
  let charge = prevTraits.charge ?? 0;
  let chargeUsed = false;
  let poisonFrom = 0;
  let rainFrom = 0;
  let shielded = false;
  // 敵の色の弱点・耐性（攻撃にかける）
  const foe = enemyOf(state);

  // 必殺は回し終えた盤面で、通常マッチを消す前に判定する。仲間それぞれ、1ターン1回（同じターンに何人出てもよい）
  const specials: SpecialResult[] = [];
  for (const m of state.party) {
    const special = detectHeroSpecial(board, m.id);
    if (!special) continue;
    const hero = HEROES[m.id];
    const { damage: sDamage, heal: sHeal } = specialEffect(m.id, m.level, foe);
    if (hero.trait === 'shield' && sHeal > 0) shielded = true;
    if (hero.trait === 'rain') rainFrom += sHeal;
    if (hero.trait === 'poison') poisonFrom += sDamage;
    // 必殺で攻撃したターンも、溜めは溜まらない（溜めた力は通常の攻撃で使う）
    if (hero.trait === 'charge' && sDamage > 0) chargeUsed = true;
    damage += sDamage;
    heal += sHeal;
    specials.push(special);
    events.push({ type: 'special', special, name: hero.special.name, damage: sDamage, heal: sHeal });
  }

  // 必殺に使ったオーブは、最初の消去で通常マッチと一緒に消す。
  // 必殺だけで消えたオーブは通常効果を出さず、連鎖の段数にも数えない（通常マッチの段だけ数える）
  let specialCells = specials.flatMap((sp) => sp.cells);
  let chain = 0;
  // ぶつかり岩（固める敵だけ）
  let rocks = state.rocks;
  for (;;) {
    const groups = findMatches(board);
    if (groups.length === 0 && specialCells.length === 0) break;
    if (groups.length > 0) {
      if (chain >= MAX_CHAIN) break;
      chain++;
    }
    const matched = matchedMask(groups);
    const counts = emptyCounts();
    const top = emptyCounts();
    for (const p of maskToCells(matched)) {
      // 通常マッチのマスは星屑ではない（星屑はそろわない）
      const color = board[p.row][p.col] as OrbColor;
      counts[color]++;
      if (p.row < TRAITS.farRows) top[color]++;
    }
    const colors = (Object.values(counts) as number[]).filter((n) => n > 0).length;
    // 仲間全員が同時に行動する。自分の色が消えたキャラだけ動く
    const actors: Actor[] = [];
    if (groups.length > 0) {
      for (const m of state.party) {
        const hero = HEROES[m.id];
        const e = normalEffect(m.id, counts, chain, m.level, foe, { top, colors, charge });
        if (e.damage > 0 || e.heal > 0) {
          actors.push({ heroId: m.id, damage: e.damage, heal: e.heal, ...(hero.trait === 'twin' && e.damage > 0 ? { hits: 2 } : {}) });
          if (hero.trait === 'charge') {
            // 溜めた力は、攻撃した段で使い切る
            charge = 0;
            chargeUsed = true;
          }
          if (hero.trait === 'poison') poisonFrom += e.damage;
          if (hero.trait === 'shield') shielded = true;
          if (hero.trait === 'rain') rainFrom += e.heal;
        }
      }
    }
    const stepDamage = actors.reduce((sum, a) => sum + a.damage, 0);
    const stepHeal = actors.reduce((sum, a) => sum + a.heal, 0);
    damage += stepDamage;
    heal += stepHeal;
    const mask = matched.map((line) => line.slice());
    for (const p of specialCells) mask[p.row][p.col] = true;
    specialCells = [];
    // 消えるマスの上下左右にある星屑は、一緒に消える（効果は出さない。仕様書 12.12）
    const junk = junkBeside(board, mask);
    for (const p of junk) mask[p.row][p.col] = true;
    // 消えるマスとその上下左右の岩は割れ、残った岩はオーブと一緒に落ちる（仕様書 12.14）
    let rockInfo: { broken?: Pos[]; rocks?: Pos[] } = {};
    if (rocks) {
      const after = breakAndDropRocks(rocks, mask);
      rocks = after.rocks;
      rockInfo = { rocks, ...(after.broken.length > 0 ? { broken: after.broken } : {}) };
    }
    const refilled = collapseAndRefill(board, mask, seed);
    board = refilled.board;
    seed = refilled.seed;
    events.push({
      ...rockInfo,
      type: 'clear',
      chain: groups.length > 0 ? chain : 0,
      cells: maskToCells(mask),
      counts,
      actors,
      damage: stepDamage,
      heal: stepHeal,
      board,
      ...(junk.length > 0 ? { junk } : {}),
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

  // 恵みの雨（前のターンから続く分）：このターンの回復のあとに入る
  let rain = prevTraits.rain && prevTraits.rain.turns > 0 ? { ...prevTraits.rain } : undefined;
  if (rain) {
    const before = partyHp;
    partyHp = Math.min(state.partyMaxHp, partyHp + rain.amount);
    if (partyHp > before) events.push({ type: 'rain', amount: partyHp - before, partyHp });
    rain.turns -= 1;
  }
  // 新しい雨は、残っている雨より強いときだけ上書きする（毒と同じ）
  const newRain = Math.max(1, Math.round(rainFrom * TRAITS.rainRatio + 1e-9));
  if (rainFrom > 0 && (!rain || rain.turns <= 0 || newRain > rain.amount)) rain = { amount: newRain, turns: TRAITS.rainTurns };
  if (rain && rain.turns <= 0) rain = undefined;

  // 毒：このターンの攻撃で新しくかかった毒は強い方で上書きし、ターンの終わりにダメージを与える
  let poison = prevTraits.poison && prevTraits.poison.turns > 0 ? { ...prevTraits.poison } : undefined;
  const newPoison = Math.round(poisonFrom * TRAITS.poisonRatio + 1e-9);
  if (newPoison > 0 && (!poison || newPoison > poison.amount)) poison = { amount: newPoison, turns: TRAITS.poisonTurns };
  if (poison && enemyHp > 0) {
    // amount は実際に減った量
    const before = enemyHp;
    enemyHp = Math.max(0, enemyHp - poison.amount);
    events.push({ type: 'poison', amount: before - enemyHp, enemyHp });
    poison.turns -= 1;
  }
  if (poison && poison.turns <= 0) poison = undefined;

  // 溜め：やぎ座が出撃していて、このターン攻撃しなかったら1つ溜まる
  if (!chargeUsed && state.party.some((m) => HEROES[m.id].trait === 'charge')) charge = Math.min(TRAITS.chargeMax, charge + 1);

  // 敵の行動：強攻撃のある敵は、残りターンが 0 になったら強攻撃して数え直す
  let status: BattleState['status'] = 'playing';
  let chargeIn = state.enemyChargeIn;
  let junkIn = state.enemyJunkIn;
  let rockIn = state.enemyRockIn;
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
    // 盾（かに座）：回復したターンは、敵の攻撃を軽くする
    if (shielded) amount = Math.max(1, Math.round(amount * (1 - TRAITS.shieldCut) + 1e-9));
    partyHp = Math.max(0, partyHp - amount);
    events.push({ type: 'enemyAttack', amount, partyHp, heavy, ...(shielded ? { shield: true } : {}) });
    if (partyHp === 0) status = 'defeat';
    // お邪魔の星屑：残りターンが 0 になったら、盤面のオーブを星屑に変えて数え直す
    if (status === 'playing' && enemy.junk && junkIn !== undefined) {
      junkIn -= 1;
      if (junkIn <= 0) {
        junkIn = enemy.junk.every;
        const mixed = mixJunk(board, Math.min(enemy.junk.count, enemy.junk.max - countJunk(board)), seed, rocks);
        seed = mixed.seed;
        if (mixed.cells.length > 0) {
          board = mixed.board;
          events.push({ type: 'junk', cells: mixed.cells, board });
        }
      }
    }
    // ぶつかり岩：残りターンが 0 になったら、盤面のオーブを岩で固めて数え直す
    if (status === 'playing' && enemy.rock && rockIn !== undefined) {
      rockIn -= 1;
      if (rockIn <= 0) {
        rockIn = enemy.rock.every;
        const placed = placeRocks(board, rocks ?? [], Math.max(0, Math.min(enemy.rock.count, enemy.rock.max - (rocks?.length ?? 0))), seed);
        seed = placed.seed;
        if (placed.cells.length > 0) {
          rocks = placed.rocks;
          events.push({ type: 'rock', cells: placed.cells, rocks });
        }
      }
    }
  }
  if (status !== 'playing') events.push({ type: 'end', status });

  const maxChainThisTurn = events.reduce((m, e) => (e.type === 'clear' ? Math.max(m, e.chain) : m), 0);
  const healedThisTurn = events.reduce((sum, e) => (e.type === 'heal' || e.type === 'rain' ? sum + e.amount : sum), 0);
  const traits: TraitState = {};
  if (poison) traits.poison = poison;
  if (rain) traits.rain = rain;
  if (charge > 0) traits.charge = charge;
  return {
    state: {
      ...state,
      board,
      turn: state.turn + 1,
      partyHp,
      enemyHp,
      enemyChargeIn: chargeIn,
      ...(junkIn !== undefined ? { enemyJunkIn: junkIn } : {}),
      ...(rockIn !== undefined ? { enemyRockIn: rockIn } : {}),
      ...(rocks ? { rocks } : {}),
      rngSeed: seed,
      status,
      traits,
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

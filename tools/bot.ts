// 計測用の自動プレイヤー（ゲームには入れない）。
// 見えている盤面だけで判断する：回したあとの盤面は見るが、補充で何が落ちてくるか（seed の先）は見ない
import { MAX_ROTATIONS_PER_TURN } from '../src/data/balance';
import { HEROES } from '../src/data/heroes';
import { MAX_INTERSECTION, rotate2x2 } from '../src/game/board';
import { enemyOf, normalEffect } from '../src/game/combat';
import { scaled } from '../src/game/party';
import { findMatches, matchedMask, maskToCells } from '../src/game/matching';
import { nextInt } from '../src/game/rng';
import { SHAPES, detectHeroSpecial } from '../src/game/specials';
import type { BattleState, Board, Direction, HeroId, OrbColor, PartyMember, Rotation, TurnAction } from '../src/game/types';

/**
 * random：1〜3回でたらめに回す（初めて遊ぶ人の下限の目安）
 * skilled：1回ずつ、いちばん良くなる回し方を選ぶ。必殺の形があと少しなら、そこへ近づける（上手な人の目安）
 * expert：3回までのすべての回し方を調べる（上限の目安。遅い）
 */
export type BotLevel = 'random' | 'skilled' | 'expert';

const DIRECTIONS: Direction[] = ['clockwise', 'counterclockwise'];

export function allRotations(): Rotation[] {
  const list: Rotation[] = [];
  for (let row = 0; row <= MAX_INTERSECTION; row++) {
    for (let col = 0; col <= MAX_INTERSECTION; col++) {
      for (const direction of DIRECTIONS) list.push({ row, col, direction });
    }
  }
  return list;
}

const ROTATIONS = allRotations();

/** 次のターンの終わりに受ける敵の攻撃（強攻撃が来るならその量）。画面にも出ている公開情報 */
export function nextEnemyAttack(state: BattleState): number {
  const enemy = enemyOf(state);
  return enemy.heavy && state.enemyChargeIn === 1 ? enemy.heavy.attack : enemy.attack;
}

/** 回し終えた盤面で「攻撃」したときの、仲間全員の効果の見積もり（連鎖は数えない。全員が同時に行動する。仕様書 12.7） */
export function estimate(board: Board, party: readonly PartyMember[]): { damage: number; heal: number; special: boolean } {
  const counts: Record<OrbColor, number> = { red: 0, blue: 0, green: 0, pink: 0 };
  for (const p of maskToCells(matchedMask(findMatches(board)))) counts[board[p.row][p.col]]++;
  let damage = 0;
  let heal = 0;
  let special = false;
  for (const m of party) {
    const def = HEROES[m.id];
    const e = normalEffect(m.id, counts, 1, m.level);
    const sp = detectHeroSpecial(board, m.id) !== null ? scaled(def.special.power, m.level) : 0;
    if (sp > 0) special = true;
    damage += e.damage + (def.role === 'attacker' ? sp : 0);
    heal += e.heal + (def.role === 'healer' ? sp : 0);
  }
  return { damage, heal, special };
}

/** 必殺の形に、そのキャラの色が最大で何個そろっているか */
export function shapeProgress(board: Board, hero: HeroId): { count: number; size: number } {
  const { color, shape } = HEROES[hero].special;
  let best = 0;
  let size = 0;
  for (const o of SHAPES[shape]) {
    size = o.length;
    const h = Math.max(...o.map(([r]) => r)) + 1;
    const w = Math.max(...o.map(([, c]) => c)) + 1;
    for (let r = 0; r + h <= board.length; r++) {
      for (let c = 0; c + w <= board.length; c++) {
        const n = o.reduce((k, [dr, dc]) => k + (board[r + dr][c + dc] === color ? 1 : 0), 0);
        if (n > best) best = n;
      }
    }
  }
  return { count: best, size };
}

export function chooseAction(state: BattleState, level: BotLevel, seed: number): { action: TurnAction; seed: number } {
  let s = seed;
  const rand = (n: number) => {
    const r = nextInt(s, n);
    s = r.seed;
    return r.value;
  };

  const party = state.party.map((m) => m.id);
  if (level === 'random') {
    const count = 1 + rand(MAX_ROTATIONS_PER_TURN);
    const rotations = [...Array(count)].map(() => ROTATIONS[rand(ROTATIONS.length)]);
    return { action: { rotations }, seed: s };
  }

  const missing = state.partyMaxHp - state.partyHp;
  const attack = nextEnemyAttack(state);
  // 次の敵の攻撃を受けたあとに残るHPの割合が低いほど、回復の価値を上げる
  const afterHit = (state.partyHp - attack) / state.partyMaxHp;
  const healWeight = afterHit < 0.25 ? 3 : afterHit < 0.5 ? 1.5 : 0.6;
  const value = (board: Board) => {
    const e = estimate(board, state.party);
    const finishing = e.damage >= state.enemyHp ? 10_000 : 0;
    return finishing + e.damage + Math.min(e.heal, missing) * healWeight;
  };
  // だれかの形があと1〜2個でそろうなら、その盤面を少し高く見る（次の回転・次のターンで必殺を狙う）
  const withProgress = (board: Board) => {
    let bonus = 0;
    for (const hero of party) {
      const p = shapeProgress(board, hero);
      bonus += p.count >= p.size ? 0 : p.count === p.size - 1 ? 40 : p.count === p.size - 2 ? 12 : 0;
    }
    return value(board) + bonus;
  };

  let plan: { rotations: Rotation[]; board: Board };
  if (level === 'skilled') {
    plan = { rotations: [], board: state.board };
    let current = -Infinity;
    for (let step = 0; step < MAX_ROTATIONS_PER_TURN; step++) {
      let stepBest: { r: Rotation; board: Board; score: number } | null = null;
      for (const r of ROTATIONS) {
        const board = rotate2x2(plan.board, r.row, r.col, r.direction);
        const score = withProgress(board) + rand(1000) / 100_000;
        if (!stepBest || score > stepBest.score) stepBest = { r, board, score };
      }
      // 1回目は必ず回す。2回目からは良くなるときだけ回す
      if (step > 0 && stepBest!.score <= current) break;
      plan = { rotations: [...plan.rotations, stepBest!.r], board: stepBest!.board };
      current = stepBest!.score;
    }
  } else {
    // expert：3回までの回し方を幅優先で調べる（同じ盤面は1度だけ）
    const key = (b: Board) => b.map((row) => row.map((c) => c[0]).join('')).join('');
    let layer = [{ rotations: [] as Rotation[], board: state.board }];
    const seen = new Set([key(state.board)]);
    plan = layer[0];
    let bestScore = -Infinity;
    for (let depth = 0; depth < MAX_ROTATIONS_PER_TURN; depth++) {
      const next: typeof layer = [];
      for (const node of layer) {
        for (const r of ROTATIONS) {
          const board = rotate2x2(node.board, r.row, r.col, r.direction);
          const k = key(board);
          if (seen.has(k)) continue;
          seen.add(k);
          const item = { rotations: [...node.rotations, r], board };
          next.push(item);
          const score = withProgress(board);
          if (score > bestScore) {
            bestScore = score;
            plan = item;
          }
        }
      }
      layer = next;
    }
  }
  return { action: { rotations: plan.rotations }, seed: s };
}

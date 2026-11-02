// 計測用の自動プレイヤー（ゲームには入れない）。
// 見えている盤面だけで判断する：回したあとの盤面は見るが、補充で何が落ちてくるか（seed の先）は見ない
import { MAX_INTERSECTION, rotate2x2 } from '../src/game/board';
import { enemyOf, normalEffect } from '../src/game/combat';
import { findMatches, matchedMask, maskToCells } from '../src/game/matching';
import { detectHeroSpecial } from '../src/game/specials';
import { HEROES, PARTY } from '../src/data/heroes';
import { nextInt } from '../src/game/rng';
import type { BattleState, Direction, HeroId, OrbColor, TurnAction } from '../src/game/types';

/**
 * random：でたらめに回す（初めて遊ぶ人の下限の目安）
 * skilled：1手先だけ見て、いちばん効果の大きい手を選ぶ
 * planner：2手先まで見る。1手目で何も消えない手なら盤面が確定するので、2手目で形を完成させる準備ができる
 */
export type BotLevel = 'random' | 'skilled' | 'planner';

const DIRECTIONS: Direction[] = ['clockwise', 'counterclockwise'];

export function allActions(): TurnAction[] {
  const actions: TurnAction[] = [];
  for (const hero of PARTY) {
    for (let row = 0; row <= MAX_INTERSECTION; row++) {
      for (let col = 0; col <= MAX_INTERSECTION; col++) {
        for (const direction of DIRECTIONS) actions.push({ hero, row, col, direction });
      }
    }
  }
  return actions;
}

/** 回した直後の盤面だけで見積もった、その手の効果（連鎖は数えない） */
export function estimate(state: BattleState, action: TurnAction): { damage: number; heal: number; special: boolean } {
  const board = rotate2x2(state.board, action.row, action.col, action.direction);
  const hero = HEROES[action.hero];
  const special = detectHeroSpecial(board, action.hero) !== null;
  const counts: Record<OrbColor, number> = { red: 0, blue: 0, green: 0, pink: 0 };
  for (const p of maskToCells(matchedMask(findMatches(board)))) counts[board[p.row][p.col]]++;
  const effect = normalEffect(action.hero, counts, 1);
  const sp = special ? hero.special.power : 0;
  return {
    damage: effect.damage + (hero.role === 'attacker' ? sp : 0),
    heal: effect.heal + (hero.role === 'healer' ? sp : 0),
    special,
  };
}

/**
 * 手を選ぶ。random は全部の手から等しく選ぶ。
 * skilled は「与えるダメージ」と「足りないHPを埋める回復」を比べ、HPが危ないときほど回復を重く見る
 */
/** 次のターンの終わりに受ける敵の攻撃（強攻撃が来るならその量）。画面にも出ている公開情報 */
export function nextEnemyAttack(state: BattleState): number {
  const enemy = enemyOf(state);
  return enemy.heavy && state.enemyChargeIn === 1 ? enemy.heavy.attack : enemy.attack;
}

export function chooseAction(state: BattleState, level: BotLevel, seed: number): { action: TurnAction; seed: number } {
  const enemyAttack = nextEnemyAttack(state);
  const actions = allActions();
  if (level === 'random') {
    const pick = nextInt(seed, actions.length);
    return { action: actions[pick.value], seed: pick.seed };
  }
  const missing = state.partyMaxHp - state.partyHp;
  // 次の敵の攻撃を受けたあとに残るHPの割合が低いほど、回復の価値を上げる
  const afterHit = (state.partyHp - enemyAttack) / state.partyMaxHp;
  const healWeight = afterHit < 0.25 ? 3 : afterHit < 0.5 ? 1.5 : 0.6;
  const value = (s: BattleState, a: TurnAction) => {
    const e = estimate(s, a);
    const finishing = e.damage >= s.enemyHp ? 10_000 : 0;
    return finishing + e.damage + Math.min(e.heal, missing) * healWeight;
  };
  let best = actions[0];
  let bestScore = -Infinity;
  let s = seed;
  for (const action of actions) {
    let score = value(state, action);
    if (level === 'planner' && score === 0 && afterHit >= 0.25) {
      // 何も起きない手：盤面が確定するので、次の手の最善を割り引いて足す（1ターン分の被弾を差し引く）
      const board = rotate2x2(state.board, action.row, action.col, action.direction);
      const after = { ...state, board };
      let next = 0;
      for (const a2 of actions) next = Math.max(next, value(after, a2));
      score = next * 0.8 - enemyAttack * 0.5;
    }
    // 同点はランダムに（いつも左上を選ばないように）
    const tie = nextInt(s, 1000);
    s = tie.seed;
    const jitter = tie.value / 100_000;
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      best = action;
    }
  }
  return { action: best, seed: s };
}

export const BOT_HEROES: readonly HeroId[] = PARTY;

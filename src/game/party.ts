// 編成のルールとレベルによる強さ（純粋な関数）
import { MAX_LEVEL, levelPercent } from '../data/growth';
import { HEROES, PARTY_SIZE, isHeroId } from '../data/heroes';
import type { HeroId, PartyMember } from './types';

export type PartyProblem = 'size' | 'duplicate' | 'unknown' | 'level' | 'noAttacker';

/** キャラの役割（ふつうは設定データから引く） */
export type RoleOf = (id: HeroId) => 'attacker' | 'healer';

/**
 * 編成のルール：3人、同じキャラは1人まで、攻撃キャラが1人以上（1回の編成に入れる回復役は0〜2人。仕様書 12.5）。
 * 問題がなければ null。roleOf はテストで役割を差し替えるためのもの
 */
export function partyProblem(
  party: readonly PartyMember[],
  roleOf: RoleOf = (id) => HEROES[id].role,
): PartyProblem | null {
  if (party.length !== PARTY_SIZE) return 'size';
  if (party.some((m) => typeof m !== 'object' || m === null)) return 'unknown';
  if (party.some((m) => !isHeroId(m.id))) return 'unknown';
  if (new Set(party.map((m) => m.id)).size !== party.length) return 'duplicate';
  if (party.some((m) => !Number.isInteger(m.level) || m.level < 1 || m.level > MAX_LEVEL)) return 'level';
  if (!party.some((m) => roleOf(m.id) === 'attacker')) return 'noAttacker';
  return null;
}

export const PARTY_PROBLEM_TEXT: Record<PartyProblem, string> = {
  size: `${PARTY_SIZE}人選んでください`,
  duplicate: '同じキャラは1人までです',
  unknown: '知らないキャラがいます',
  level: 'レベルがおかしいキャラがいます',
  noAttacker: '攻撃キャラを1人以上入れてください（回復役だけでは敵にダメージを与えられません）',
};

/** レベルをかけた値（小数は四捨五入。.5 がそろって切り上がるよう整数で計算する） */
export function scaled(base: number, level: number): number {
  return Math.round((base * levelPercent(level)) / 100);
}

/** そのキャラのパーティー最大HPへの寄与（レベル込み） */
export function heroMaxHp(id: HeroId, level: number): number {
  return scaled(HEROES[id].maxHpContribution, level);
}

/** パーティー最大HP = 3人の寄与値（レベル込み）の合計 */
export function partyMaxHp(party: readonly PartyMember[]): number {
  return party.reduce((sum, m) => sum + heroMaxHp(m.id, m.level), 0);
}

export function memberLevel(party: readonly PartyMember[], id: HeroId): number {
  return party.find((m) => m.id === id)?.level ?? 1;
}

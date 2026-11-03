// キャラのカード（編成・育成・図鑑で使う）
import { HERO_JOIN, HEROES } from '../data/heroes';
import { findStage } from '../data/stages';
import type { HeroId } from '../game/types';

export const ROLE_TEXT = { attacker: '自分の色で攻撃', healer: 'ピンクで回復' } as const;
export const ROLE_SHORT = { attacker: 'アタッカー', healer: 'ヒーラー' } as const;
/** 狭い所（ホームの名前の札）での呼び方 */
export const ROLE_PLATE = { attacker: '攻撃役', healer: '回復役' } as const;

/** 仲間になる条件の文（今あるステージは「1-3 クリアで加入」、まだ無い章は「第2章で加入」、未定は「ストーリーを進めると加入」） */
export function joinText(id: HeroId): string {
  const j = HERO_JOIN[id];
  if (j === 'start') return '最初から仲間';
  if (j === 'later') return 'ストーリーを進めると加入';
  return findStage(j.stageId) ? `${j.stageId} クリアで加入` : `第${j.stageId.split('-')[0]}章で加入`;
}

/** まだ仲間でないキャラのカードの中身（名前と条件だけ。性能は見せない） */
export function lockedCardInner(id: HeroId): string {
  const h = HEROES[id];
  return `
    <span class="hc-symbol locked" aria-hidden="true">${h.symbol}</span>
    <span class="hc-name">${h.name}</span>
    <span class="hc-lock">${joinText(id)}</span>`;
}

export function heroCardInner(id: HeroId, level: number | null): string {
  const h = HEROES[id];
  return `
    <span class="hc-symbol role-${h.role}" aria-hidden="true">${h.symbol}</span>
    <span class="hc-name">${h.name}</span>
    <span class="hc-role">${ROLE_SHORT[h.role]}</span>
    ${level === null ? '' : `<span class="hc-level">Lv.${level}</span>`}`;
}

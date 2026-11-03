// キャラのカード（編成・育成・図鑑で使う）
import { HERO_JOIN_STAGE, HEROES } from '../data/heroes';
import { findStage } from '../data/stages';
import type { HeroId } from '../game/types';

export const ROLE_TEXT = { attacker: '赤・青・緑で攻撃', healer: 'ピンクで回復' } as const;
export const ROLE_SHORT = { attacker: 'アタッカー', healer: 'ヒーラー' } as const;

/** 仲間になる条件の文（まだ無い章は「準備中」） */
export function joinText(id: HeroId): string {
  const stageId = HERO_JOIN_STAGE[id];
  if (stageId === null) return '最初から仲間';
  return findStage(stageId) ? `${stageId} クリアで加入` : `第${stageId.split('-')[0]}章で加入`;
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

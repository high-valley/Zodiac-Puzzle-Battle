// キャラのカード（編成・育成・図鑑で使う）
import { assetUrl } from './assets';
import { HERO_ART } from '../data/heroArt';
import { HERO_JOIN, HEROES } from '../data/heroes';
import { heroStats } from '../game/party';
import { findStage } from '../data/stages';
import type { HeroId } from '../game/types';

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

/**
 * 立ち絵の上半身（顔から胸あたり）を切り出した絵。メインオーブ（必殺の色）の小さな絵を右下に重ねる（2026-11-04）。
 * 絵は立ち絵そのもの（data/heroArt の頭の位置で合わせる）。locked なら影だけ
 */
export function heroPortrait(id: HeroId, locked = false): string {
  const h = HEROES[id];
  const a = HERO_ART[id];
  return `
    <span class="hc-portrait main-${h.special.color}${locked ? ' locked' : ''}" aria-hidden="true">
      <img src="${assetUrl(a.file)}" alt="" loading="lazy" decoding="async" draggable="false" style="--hx:${a.headX};--ht:${a.headTop}" />
      ${locked ? '' : `<span class="hc-orb orb-${h.special.color}"></span>`}
    </span>`;
}

/** まだ仲間でないキャラのカードの中身（影と名前と条件だけ。性能は見せない） */
export function lockedCardInner(id: HeroId): string {
  const h = HEROES[id];
  return `
    ${heroPortrait(id, true)}
    <span class="hc-name">${h.name}</span>
    <span class="hc-lock">${joinText(id)}</span>`;
}

/** キャラのカードの中身：上半身の絵・名前・レベルとステータス（HP と攻撃力、回復役は回復力） */
export function heroCardInner(id: HeroId, level: number | null): string {
  const h = HEROES[id];
  const st = heroStats(id, level ?? 1);
  return `
    ${heroPortrait(id)}
    <span class="hc-name">${h.name}</span>
    ${level === null ? '' : `<span class="hc-level">Lv.${level}</span>`}
    <span class="hc-stats"><span>HP <b>${st.hp}</b></span><span>${h.role === 'healer' ? '回復' : '攻撃'} <b>${st.power}</b></span></span>`;
}

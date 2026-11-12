// キャラのカード（編成・育成・図鑑で使う）
import { assetUrl } from './assets';
import { HERO_ART } from '../data/heroArt';
import { HERO_JOIN, HEROES, STAT_TYPE_LABEL, heroNameHtml } from '../data/heroes';
import { heroStats, statText } from '../game/party';
import { findStage } from '../data/stages';
import type { HeroId, OrbColor } from '../game/types';
import { ORB_LABEL } from './board';
import { PORTRAIT_ART } from '../data/story';

/** 会話用の上半身の絵（ふつうの表情）。バトルの仲間のカードで使う（2026-11-12 ユーザーの要望）。無ければ立ち絵 */
export function heroFaceUrl(id: HeroId): string {
  return assetUrl(PORTRAIT_ART[id]?.normal ?? HERO_ART[id].file);
}

export function heroFaceImg(id: HeroId): string {
  return `<img src="${heroFaceUrl(id)}" alt="" decoding="async" draggable="false" />`;
}

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
  return `
    ${heroPortrait(id, true)}
    <span class="hc-name">${heroNameHtml(id)}</span>
    <span class="hc-lock">${joinText(id)}</span>`;
}

/** キャラのカードの中身：上半身の絵・名前・レベル・タイプとステータス（HP と攻撃力、回復役は回復力） */
export function heroCardInner(id: HeroId, level: number | null): string {
  const h = HEROES[id];
  const st = heroStats(id, level ?? 1);
  return `
    ${heroPortrait(id)}
    <span class="hc-name">${heroNameHtml(id)}</span>
    ${level === null ? '' : `<span class="hc-level">Lv.${level}</span>`}
    <span class="hc-type">${STAT_TYPE_LABEL[h.statType]}</span>
    <span class="hc-stats"><span>HP <b>${st.hp}</b></span><span>${h.role === 'healer' ? '回復' : '攻撃'} <b>${statText(st.power)}</b></span><span>防御 <b>${st.defense}</b></span></span>`;
}

/** 敵の色の弱点・耐性の印（オーブの絵つき。仕様書 12.11） */
export function affinityHtml(enemy: { weak?: OrbColor; resist?: OrbColor }): string {
  const chip = (kind: 'weak' | 'resist', color: OrbColor | undefined) =>
    color
      ? `<span class="aff aff-${kind}"><span class="aff-orb orb-${color}" aria-hidden="true"></span>${kind === 'weak' ? '弱点' : '耐性'}<span class="visually-hidden">：${ORB_LABEL[color]}</span></span>`
      : '';
  return `${chip('weak', enemy.weak)}${chip('resist', enemy.resist)}`;
}

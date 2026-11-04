// 攻撃・回復・必殺の演出（仕様書 11.15.1）。12人それぞれの通常攻撃と必殺技の見せ方。
// 今はアプリ側で線・光・粒を描く（components/effects）。絵の部品ができたら、ここの指定を差し替える
import type { HeroId } from '../game/types';

/** 演出の部品。delay は演出の始まりからの待ち（ms、演出 ×1 のとき） */
export type FxStep = { delay?: number; color?: string } & (
  /** 斬撃。angle は度（0＝水平、正で右下がり）。count 本を spread 度ずつずらす */
  | { kind: 'slash'; angle: number; count?: number; spread?: number; size?: number; width?: number }
  /** 平行な3本の爪あと */
  | { kind: 'claws'; angle: number; size?: number }
  /** 仲間のカード（または画面の端）から的へ飛ぶもの。arc は弧の高さ（px、正で上にふくらむ） */
  | { kind: 'projectile'; shape: 'arrow' | 'orb' | 'needle' | 'star'; from?: 'hero' | 'left' | 'right' | 'top'; arc?: number; size?: number }
  /** 的の位置で広がる輪 */
  | { kind: 'ring'; count?: number; size?: number }
  /** 的の位置の光 */
  | { kind: 'burst'; size?: number }
  /** 渦 */
  | { kind: 'spiral'; size?: number }
  /** 上から差す光の柱 */
  | { kind: 'beam'; width?: number }
  /** 的に降るもの */
  | { kind: 'rain'; drops?: number; shape?: 'drop' | 'arrow' }
  /** 立ちのぼる光の粒 */
  | { kind: 'sparkles'; count?: number }
  /** 的を包む盾 */
  | { kind: 'dome' }
  /** 仲間のカードから的への突進の筋 */
  | { kind: 'streak'; width?: number }
);

export interface HeroFx {
  /** 演出の主な色（必殺の色に合わせる） */
  color: string;
  /** 差し色 */
  accent: string;
  normal: FxStep[];
  special: FxStep[];
}

const RED = '#ff5a4e';
const BLUE = '#5aa8ff';
const GREEN = '#4fd18f';
const PINK = '#ff8fcf';
const GOLD = '#ffd37a';
const WATER = '#8fd8ff';
const POISON = '#b07cff';

export const HERO_FX: Record<HeroId, HeroFx> = {
  // 紅蓮の一撃：斜めの太い一太刀 ／ 炎角・紅蓮衝：十字に斬り、炎が弾ける
  aries: {
    color: RED,
    accent: GOLD,
    normal: [{ kind: 'slash', angle: -35, size: 150, width: 12 }, { kind: 'burst', delay: 160, size: 70 }],
    special: [
      { kind: 'slash', angle: -40, size: 240, width: 18 },
      { kind: 'slash', angle: 40, size: 240, width: 18, delay: 140 },
      { kind: 'burst', delay: 300, size: 180 },
      { kind: 'ring', delay: 300, count: 2, size: 150, color: GOLD },
      { kind: 'sparkles', delay: 360, count: 14, color: GOLD },
    ],
  },
  // 猛進：カードから敵へ突進 ／ 金牛の猛進：太い突進と、何重もの衝撃
  taurus: {
    color: RED,
    accent: GOLD,
    normal: [{ kind: 'streak', width: 14 }, { kind: 'ring', delay: 200, size: 90 }],
    special: [
      { kind: 'streak', width: 34 },
      { kind: 'burst', delay: 220, size: 200 },
      { kind: 'ring', delay: 220, count: 3, size: 190, color: GOLD },
    ],
  },
  // 獅子の爪：3本の爪あと ／ 獅子王の咆哮：咆哮の輪と、大きな爪あと
  leo: {
    color: RED,
    accent: GOLD,
    normal: [{ kind: 'claws', angle: 60, size: 130 }],
    special: [
      { kind: 'ring', count: 3, size: 220, color: GOLD },
      { kind: 'claws', angle: 60, size: 230, delay: 260 },
      { kind: 'burst', delay: 420, size: 170 },
    ],
  },
  // 鏡の閃き：鏡写しの2本 ／ 双つ星の共鳴：左右から星が来てぶつかる
  gemini: {
    color: BLUE,
    accent: GOLD,
    normal: [
      { kind: 'slash', angle: -30, size: 120, width: 8 },
      { kind: 'slash', angle: 30, size: 120, width: 8, delay: 110 },
    ],
    special: [
      { kind: 'projectile', shape: 'star', from: 'left', arc: 60, size: 30, color: GOLD },
      { kind: 'projectile', shape: 'star', from: 'right', arc: 60, size: 30 },
      { kind: 'burst', delay: 380, size: 200 },
      { kind: 'ring', delay: 380, count: 2, size: 180, color: GOLD },
    ],
  },
  // 闇の一刺し：細い針の一突きと毒 ／ 蠍毒の尾撃：上から尾が刺さり、毒が広がる
  scorpio: {
    color: BLUE,
    accent: POISON,
    normal: [{ kind: 'projectile', shape: 'needle', size: 40 }, { kind: 'sparkles', delay: 200, count: 6, color: POISON }],
    special: [
      { kind: 'slash', angle: 70, size: 260, width: 16 },
      { kind: 'burst', delay: 200, size: 150, color: POISON },
      { kind: 'ring', delay: 260, count: 2, size: 170, color: POISON },
      { kind: 'sparkles', delay: 300, count: 16, color: POISON },
    ],
  },
  // 貫通射撃：矢が飛ぶ ／ 天穿つ星矢：星の矢が降りそそぐ
  sagittarius: {
    color: BLUE,
    accent: GOLD,
    normal: [{ kind: 'projectile', shape: 'arrow', arc: 30, size: 34 }, { kind: 'burst', delay: 260, size: 60 }],
    special: [
      { kind: 'rain', drops: 14, shape: 'arrow' },
      { kind: 'burst', delay: 420, size: 200, color: GOLD },
      { kind: 'ring', delay: 420, count: 2, size: 170 },
    ],
  },
  // 天秤の一閃：まっすぐ横に一閃 ／ 天秤の審判：光の柱と、左右に広がる一閃
  libra: {
    color: GREEN,
    accent: GOLD,
    normal: [{ kind: 'slash', angle: 0, size: 160, width: 9 }],
    special: [
      { kind: 'beam', width: 70, color: GOLD },
      { kind: 'slash', angle: 0, size: 300, width: 14, delay: 280 },
      { kind: 'ring', delay: 340, count: 2, size: 180 },
    ],
  },
  // 山羊の跳撃：弧を描いて跳び、上から打つ ／ 山嶺の双角：2本の角の弧と、山なりの衝撃
  capricorn: {
    color: GREEN,
    accent: GOLD,
    normal: [{ kind: 'projectile', shape: 'orb', arc: 140, size: 22 }, { kind: 'slash', angle: 80, size: 110, width: 10, delay: 260 }],
    special: [
      { kind: 'slash', angle: -60, size: 240, width: 16 },
      { kind: 'slash', angle: 60, size: 240, width: 16 },
      { kind: 'burst', delay: 240, size: 190 },
      { kind: 'ring', delay: 260, count: 3, size: 200, color: GOLD },
    ],
  },
  // 潮の渦：敵の上に渦 ／ 双魚の渦潮：2匹の魚が回り込み、大きな渦になる
  pisces: {
    color: GREEN,
    accent: WATER,
    normal: [{ kind: 'spiral', size: 110 }],
    special: [
      { kind: 'projectile', shape: 'orb', from: 'left', arc: -80, size: 24, color: WATER },
      { kind: 'projectile', shape: 'orb', from: 'right', arc: 80, size: 24 },
      { kind: 'spiral', delay: 320, size: 230 },
      { kind: 'ring', delay: 420, count: 2, size: 180, color: WATER },
    ],
  },
  // 月潮の癒やし：仲間を包む小さな盾 ／ 蟹甲の加護：大きな盾と光
  cancer: {
    color: PINK,
    accent: '#ffffff',
    normal: [{ kind: 'dome' }, { kind: 'sparkles', delay: 120, count: 6 }],
    special: [{ kind: 'dome' }, { kind: 'ring', delay: 120, count: 2, size: 220 }, { kind: 'sparkles', delay: 200, count: 18, color: '#ffffff' }],
  },
  // 癒やしの光：光の粒 ／ 聖女の祝福：光の柱と、たくさんの光
  virgo: {
    color: PINK,
    accent: GOLD,
    normal: [{ kind: 'sparkles', count: 10 }],
    special: [{ kind: 'beam', width: 160, color: GOLD }, { kind: 'sparkles', delay: 200, count: 22 }, { kind: 'sparkles', delay: 320, count: 10, color: GOLD }],
  },
  // 命の水：しずくが降る ／ 宝瓶の慈雨：たくさんの雨と光
  aquarius: {
    color: PINK,
    accent: WATER,
    normal: [{ kind: 'rain', drops: 8, color: WATER }, { kind: 'sparkles', delay: 240, count: 5 }],
    special: [{ kind: 'rain', drops: 26, color: WATER }, { kind: 'sparkles', delay: 300, count: 16 }, { kind: 'ring', delay: 360, size: 200, color: WATER }],
  },
};

/** 演出の長さ（ms、演出 ×1 のとき）。1人の通常攻撃・必殺のカットイン・必殺の技 */
export const FX_TIMING = {
  normal: 460,
  /** 次の仲間の攻撃を始めるまで（前の仲間の演出と少し重ねる） */
  nextMember: 360,
  cutIn: 900,
  special: 820,
  constellation: 700,
};

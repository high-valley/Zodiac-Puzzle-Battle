// キャラの立ち絵と背丈（仕様書 18.3・18.4、docs/character-design.md「背丈と仕上げの絵柄」）。
// 今の立ち絵は仮：docs/character-art の確認用の絵から背景を抜いたもの（public/art/heroes）。仕上げの絵ができたら差し替える
import type { HeroId } from '../game/types';

/** 背丈（cm。頭のてっぺんから足の裏まで）。2026-11-03 決定 */
export const HERO_HEIGHT_CM: Record<HeroId, number> = {
  leo: 186,
  capricorn: 180,
  scorpio: 178,
  aquarius: 177,
  aries: 175,
  gemini: 168,
  taurus: 166,
  libra: 164,
  sagittarius: 162,
  virgo: 160,
  pisces: 159,
  cancer: 157,
};

export interface HeroArt {
  /** public からの場所 */
  file: string;
  /** 画像の幅と高さ（px）。画像の下の端が足の裏 */
  width: number;
  height: number;
  /** 画像の上の端から頭のてっぺんまで（高さに対する割合）。角・武器が頭より上に出ている分 */
  headTop: number;
  /** 頭の中心の横の位置（幅に対する割合）。並べるときの中心にする */
  headX: number;
  /** 立ったときの背丈に対する絵の高さ（身を低くしたポーズは 1 より小さい） */
  pose: number;
}

const art = (id: HeroId, width: number, headTop: number, headX: number, pose = 1): HeroArt => ({
  file: `art/heroes/${id}.webp`,
  width,
  height: 900,
  headTop,
  headX,
  pose,
});

/** 仮の立ち絵（確認用の絵を切り抜いたもの） */
export const HERO_ART_TENTATIVE = true;

export const HERO_ART: Record<HeroId, HeroArt> = {
  aries: art('aries', 472, 0.01, 0.445),
  taurus: art('taurus', 469, 0.049, 0.571),
  gemini: art('gemini', 578, 0.008, 0.469),
  cancer: art('cancer', 556, 0.011, 0.482),
  leo: art('leo', 542, 0.009, 0.569),
  virgo: art('virgo', 368, 0.02, 0.589),
  libra: art('libra', 264, 0.003, 0.515),
  scorpio: art('scorpio', 500, 0.007, 0.413, 0.9),
  sagittarius: art('sagittarius', 547, 0.033, 0.568),
  capricorn: art('capricorn', 385, 0.034, 0.388),
  aquarius: art('aquarius', 389, 0.002, 0.586),
  pisces: art('pisces', 470, 0.009, 0.549),
};

/** いちばん背の高いキャラの背丈。並べたときの高さの基準 */
export const TALLEST_CM = Math.max(...Object.values(HERO_HEIGHT_CM));

/**
 * 並べたときの絵の高さ（いちばん背の高いキャラの背丈を 1 とした割合）。
 * 絵には頭より上に出た角や武器の分（headTop）もあるので、その分だけ高くする
 */
export function artHeightRatio(id: HeroId): number {
  const a = HERO_ART[id];
  return (HERO_HEIGHT_CM[id] * a.pose) / TALLEST_CM / (1 - a.headTop);
}

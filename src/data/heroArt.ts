// キャラの立ち絵と背丈（仕様書 18.3・18.4、docs/character-design.md「背丈と仕上げの絵柄」）。
// 立ち絵は仕上げの絵（2026-11-04、public/art/heroes）。docs/character-art の見本の絵をもとに描き直したもの
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
  // 絵を差し替えたら v を上げる（端末や Pages に古い絵が残らないように）
  file: `art/heroes/${id}.webp?v=4`,
  width,
  height: 1500,
  headTop,
  headX,
  pose,
});

/** 仕上げの立ち絵（2026-11-04。ユーザーが画像生成で作った透過の絵を、足先から頭まで切りそろえて高さ1500pxにしたもの） */
export const HERO_ART_TENTATIVE = false;

export const HERO_ART: Record<HeroId, HeroArt> = {
  aries: art('aries', 794, 0.01, 0.42),
  taurus: art('taurus', 713, 0.06, 0.46),
  gemini: art('gemini', 947, 0.005, 0.5),
  cancer: art('cancer', 852, 0.01, 0.46),
  leo: art('leo', 869, 0.01, 0.35),
  virgo: art('virgo', 644, 0.02, 0.5),
  libra: art('libra', 474, 0.005, 0.5),
  scorpio: art('scorpio', 849, 0.005, 0.42, 0.9),
  sagittarius: art('sagittarius', 893, 0.035, 0.48),
  capricorn: art('capricorn', 666, 0.03, 0.46),
  aquarius: art('aquarius', 765, 0.005, 0.54),
  pisces: art('pisces', 794, 0.01, 0.47),
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

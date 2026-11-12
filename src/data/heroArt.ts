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
  file: `art/heroes/${id}.webp?v=5`,
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
  taurus: art('taurus', 781, 0.045, 0.53),
  gemini: art('gemini', 947, 0.005, 0.5),
  cancer: art('cancer', 854, 0.004, 0.43),
  leo: art('leo', 869, 0.01, 0.35),
  virgo: art('virgo', 639, 0.01, 0.47),
  libra: art('libra', 469, 0.003, 0.5),
  scorpio: art('scorpio', 849, 0.005, 0.42, 0.9),
  sagittarius: art('sagittarius', 896, 0.025, 0.5),
  capricorn: art('capricorn', 666, 0.03, 0.46),
  aquarius: art('aquarius', 765, 0.005, 0.54),
  pisces: art('pisces', 790, 0.015, 0.5),
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

/**
 * バトルの仲間のカード用の小さな絵（2026-11-12）。会話用の上半身の絵（ふつう）の上 6 割を幅 330px に縮めたもの（1枚 13〜26KB）。
 * 上半身の絵を差し替えたら `python3 tools/make-face-thumbs.py` で作り直し、?v= の数字を上げる
 */
export const HERO_FACE_VERSION = 1;
export function heroFaceFile(id: HeroId): string {
  return `art/faces/${id}.webp?v=${HERO_FACE_VERSION}`;
}

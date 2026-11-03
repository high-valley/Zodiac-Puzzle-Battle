// 経験値とレベル（純粋な関数）。経験値をどこに保存するかは画面側（いまは端末、課金を入れる段階でサーバー）
import { DEFEAT_EXP_RATIO, MAX_LEVEL, expToNext } from '../data/growth';

export interface HeroGrowth {
  level: number;
  /** いまのレベルの中でためた経験値（0 以上、次のレベルまでの量より少ない） */
  exp: number;
}

export const NEW_HERO: HeroGrowth = { level: 1, exp: 0 };

/** 1戦でもらえる経験値（出撃した仲間それぞれに入る） */
export function battleExp(stageExp: number, victory: boolean): number {
  return victory ? stageExp : Math.floor(stageExp * DEFEAT_EXP_RATIO);
}

/** 経験値を足して、上がったレベルを返す。最大レベルでは経験値をためない */
export function gainExp(growth: HeroGrowth, amount: number): HeroGrowth & { levelsGained: number } {
  let { level, exp } = growth;
  const start = level;
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, exp: 0, levelsGained: 0 };
  exp += Math.max(0, Math.floor(amount));
  while (level < MAX_LEVEL && exp >= expToNext(level)) {
    exp -= expToNext(level);
    level++;
  }
  if (level >= MAX_LEVEL) exp = 0;
  return { level, exp, levelsGained: level - start };
}

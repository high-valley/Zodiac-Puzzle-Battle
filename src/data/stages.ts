// ステージ構成（第1章）と、★の条件
import { ENEMIES } from './enemies';

export interface StageDef {
  /** '1-1' など */
  id: string;
  chapter: number;
  enemyId: string;
  /** ★2：このターン数以内で勝つ */
  targetTurns: number;
  /** 勝ったときに出撃した仲間それぞれがもらう経験値（負けると一部だけ。src/data/growth.ts） */
  exp: number;
}

export interface ChapterDef {
  number: number;
  name: string;
  tagline: string;
  stages: StageDef[];
}

/** ★3：勝ったときにパーティーHPがこの割合以上残っている */
export const STAR3_HP_RATIO = 0.5;

export const CHAPTERS: ChapterDef[] = [
  {
    number: 1,
    name: '星降る神殿',
    tagline: '星の導きが、再び世界を結ぶ',
    stages: [
      { id: '1-1', chapter: 1, enemyId: 'stardust', targetTurns: 5, exp: 30 },
      { id: '1-2', chapter: 1, enemyId: 'mistbeast', targetTurns: 7, exp: 40 },
      { id: '1-3', chapter: 1, enemyId: 'moonwarden', targetTurns: 9, exp: 50 },
      { id: '1-4', chapter: 1, enemyId: 'hunter', targetTurns: 12, exp: 60 },
      { id: '1-5', chapter: 1, enemyId: 'shadow', targetTurns: 14, exp: 80 },
    ],
  },
];

export const ALL_STAGES: StageDef[] = CHAPTERS.flatMap((c) => c.stages);

export function findStage(id: string): StageDef | undefined {
  return ALL_STAGES.find((s) => s.id === id);
}

/** ひとつ前のステージ（最初のステージは null） */
export function previousStage(id: string): StageDef | null {
  const i = ALL_STAGES.findIndex((s) => s.id === id);
  return i > 0 ? ALL_STAGES[i - 1] : null;
}

/** 勝ったときの★（負けたら 0） */
export function starsFor(
  stage: StageDef,
  result: { victory: boolean; turns: number; partyHp: number; partyMaxHp: number },
): 0 | 1 | 2 | 3 {
  if (!result.victory) return 0;
  let stars: 1 | 2 | 3 = 1;
  if (result.turns <= stage.targetTurns) stars = 2;
  if (stars === 2 && result.partyHp >= result.partyMaxHp * STAR3_HP_RATIO) stars = 3;
  return stars;
}

export function stageEnemyName(stage: StageDef): string {
  return ENEMIES[stage.enemyId]?.name ?? '';
}

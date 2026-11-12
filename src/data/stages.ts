// ステージ構成（第1章〜第3章）と、★の条件
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
  {
    // 2026-11-07。どの敵もお邪魔の星屑をまぜる（仕様書 12.12）。2-5 の初クリアでてんびん座が加わる（12.6）
    number: 2,
    name: '天秤の審判',
    tagline: '傾いた天秤を、星の並びで正す',
    stages: [
      { id: '2-1', chapter: 2, enemyId: 'falsescale', targetTurns: 13, exp: 90 },
      { id: '2-2', chapter: 2, enemyId: 'brokenverdict', targetTurns: 14, exp: 100 },
      { id: '2-3', chapter: 2, enemyId: 'chainwarden', targetTurns: 17, exp: 110 },
      { id: '2-4', chapter: 2, enemyId: 'irongiant', targetTurns: 16, exp: 120 },
      { id: '2-5', chapter: 2, enemyId: 'scaleeater', targetTurns: 17, exp: 150 },
    ],
  },
  {
    // 2026-11-12。どの敵もぶつかり岩でオーブを固める（仕様書 12.14）。3-3 でふたご座、3-5 でおうし座が加わる（12.6）
    number: 3,
    name: '金牛と双子の海',
    tagline: 'ぶつかる岩の向こうへ、星の船を進める',
    stages: [
      { id: '3-1', chapter: 3, enemyId: 'stormshade', targetTurns: 13, exp: 170 },
      { id: '3-2', chapter: 3, enemyId: 'ghostargo', targetTurns: 14, exp: 180 },
      { id: '3-3', chapter: 3, enemyId: 'clashrocks', targetTurns: 15, exp: 190 },
      { id: '3-4', chapter: 3, enemyId: 'thornveil', targetTurns: 16, exp: 200 },
      { id: '3-5', chapter: 3, enemyId: 'bulleater', targetTurns: 19, exp: 240 },
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

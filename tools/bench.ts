// バランスの計測：自動プレイヤーで何戦も遊び、勝率・ターン数・必殺の発生率などを出す
// 使い方：npm run bench -- [戦闘数]
import { ENEMIES } from '../src/data/enemies';
import { ALL_STAGES } from '../src/data/stages';
import { rotate2x2 } from '../src/game/board';
import { createBattle, resolveTurn } from '../src/game/combat';
import { detectHeroSpecial } from '../src/game/specials';
import type { HeroId } from '../src/game/types';
import { allActions, chooseAction, type BotLevel } from './bot';

// Node の型定義を入れずに済むよう、使う分だけ宣言する（このファイルは Node で動かす）
declare const process: { argv: string[] };

const MAX_TURNS = 200;

export interface BenchResult {
  level: BotLevel;
  battles: number;
  winRate: number;
  avgTurnsWin: number;
  avgTurns: number;
  specialsPerBattle: Record<HeroId, number>;
  specialRatePerTurn: Record<HeroId, number>;
  avgDamagePerTurn: number;
  maxChainHistogram: number[];
  heroShare: Record<HeroId, number>;
}

export function runBench(level: BotLevel, battles: number, enemyId: string): BenchResult {
  let wins = 0;
  let turnsWin = 0;
  let turnsAll = 0;
  let damage = 0;
  const specials: Record<HeroId, number> = { aries: 0, sagittarius: 0, virgo: 0 };
  const picked: Record<HeroId, number> = { aries: 0, sagittarius: 0, virgo: 0 };
  const chainHist = Array<number>(10).fill(0);
  for (let b = 0; b < battles; b++) {
    let state = createBattle(1_000_003 * (b + 1), enemyId);
    let botSeed = 77 + b;
    let turns = 0;
    while (state.status === 'playing' && turns < MAX_TURNS) {
      const choice = chooseAction(state, level, botSeed);
      botSeed = choice.seed;
      const before = state.enemyHp;
      const { state: next, events } = resolveTurn(state, choice.action);
      picked[choice.action.hero]++;
      if (events.some((e) => e.type === 'special')) specials[choice.action.hero]++;
      const chains = events.flatMap((e) => (e.type === 'clear' ? [e.chain] : []));
      chainHist[Math.max(0, ...chains)]++;
      damage += before - next.enemyHp;
      state = next;
      turns++;
    }
    turnsAll += turns;
    if (state.status === 'victory') {
      wins++;
      turnsWin += turns;
    }
  }
  const total = picked.aries + picked.sagittarius + picked.virgo;
  const per = (r: Record<HeroId, number>, d: number) =>
    ({ aries: r.aries / d, sagittarius: r.sagittarius / d, virgo: r.virgo / d }) as Record<HeroId, number>;
  return {
    level,
    battles,
    winRate: wins / battles,
    avgTurnsWin: wins ? turnsWin / wins : 0,
    avgTurns: turnsAll / battles,
    specialsPerBattle: per(specials, battles),
    specialRatePerTurn: {
      aries: picked.aries ? specials.aries / picked.aries : 0,
      sagittarius: picked.sagittarius ? specials.sagittarius / picked.sagittarius : 0,
      virgo: picked.virgo ? specials.virgo / picked.virgo : 0,
    },
    avgDamagePerTurn: damage / turnsAll,
    maxChainHistogram: chainHist,
    heroShare: per(picked, total),
  };
}

/**
 * 必殺の形の作りやすさ：skilled で進めた実戦に近い盤面で、1回の回転でそのキャラの必殺の形を作れる割合
 */
export function shapeAvailability(battles: number, turnsPerBattle = 12): { boards: number; rate: Record<HeroId, number> } {
  const found: Record<HeroId, number> = { aries: 0, sagittarius: 0, virgo: 0 };
  let boards = 0;
  const actions = allActions();
  for (let b = 0; b < battles; b++) {
    let state = createBattle(9_000_011 * (b + 1), 'shadow');
    let botSeed = b;
    for (let t = 0; t < turnsPerBattle && state.status === 'playing'; t++) {
      boards++;
      for (const hero of Object.keys(found) as HeroId[]) {
        const ok = actions.some(
          (a) => a.hero === hero && detectHeroSpecial(rotate2x2(state.board, a.row, a.col, a.direction), hero) !== null,
        );
        if (ok) found[hero]++;
      }
      const c = chooseAction(state, 'skilled', botSeed);
      botSeed = c.seed;
      state = resolveTurn(state, c.action).state;
    }
  }
  return {
    boards,
    rate: { aries: found.aries / boards, sagittarius: found.sagittarius / boards, virgo: found.virgo / boards },
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 300);
  const only = process.argv[3];
  for (const stage of ALL_STAGES.filter((s) => !only || s.id === only))
  for (const level of ['random', 'skilled'] as BotLevel[]) {
    const r = runBench(level, n, stage.enemyId);
    console.log(`\n== ${stage.id} ${ENEMIES[stage.enemyId].name}（★2の目標 ${stage.targetTurns}ターン）／${level}（${n}戦）`);
    console.log(`勝率 ${pct(r.winRate)}／平均ターン（勝ち） ${r.avgTurnsWin.toFixed(1)}／平均ターン（全体） ${r.avgTurns.toFixed(1)}／1ターンの平均ダメージ ${r.avgDamagePerTurn.toFixed(1)}`);
    console.log(`キャラを選んだ割合 おひつじ ${pct(r.heroShare.aries)} いて ${pct(r.heroShare.sagittarius)} おとめ ${pct(r.heroShare.virgo)}`);
    console.log(`必殺（1戦あたり） おひつじ ${r.specialsPerBattle.aries.toFixed(2)} いて ${r.specialsPerBattle.sagittarius.toFixed(2)} おとめ ${r.specialsPerBattle.virgo.toFixed(2)}`);
    console.log(`必殺（そのキャラを選んだターンのうち） おひつじ ${pct(r.specialRatePerTurn.aries)} いて ${pct(r.specialRatePerTurn.sagittarius)} おとめ ${pct(r.specialRatePerTurn.virgo)}`);
    console.log(`最大連鎖の分布（0〜8） ${r.maxChainHistogram.slice(0, 9).join(' / ')}`);
  }
  const a = shapeAvailability(400);
  console.log(`\n== 必殺の形の作りやすさ（実戦に近い盤面 ${a.boards} 面で、1回の回転で作れる割合）`);
  console.log(`おひつじ座（赤の角） ${pct(a.rate.aries)}／いて座（青の×字） ${pct(a.rate.sagittarius)}／おとめ座（ピンク2×2） ${pct(a.rate.virgo)}`);
}

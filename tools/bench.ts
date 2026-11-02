// バランスの計測：自動プレイヤーで何戦も遊び、勝率・ターン数・必殺の発生率などを出す
// 使い方：npm run bench -- [戦闘数]
import { ENEMIES } from '../src/data/enemies';
import { ALL_HEROES, DEFAULT_PARTY, HEROES } from '../src/data/heroes';
import { ALL_STAGES } from '../src/data/stages';
import { MAX_ROTATIONS_PER_TURN } from '../src/data/balance';
import { rotate2x2 } from '../src/game/board';
import { createBattle, resolveTurn } from '../src/game/combat';
import { detectHeroSpecial } from '../src/game/specials';
import type { Board, HeroId, PartyMember } from '../src/game/types';
import { allRotations, chooseAction, type BotLevel } from './bot';

// Node の型定義を入れずに済むよう、使う分だけ宣言する（このファイルは Node で動かす）
declare const process: { argv: string[] };

const MAX_TURNS = 200;

function mapHeroes<T>(f: (h: HeroId) => T): Record<HeroId, T> {
  return Object.fromEntries(ALL_HEROES.map((h) => [h, f(h)])) as Record<HeroId, T>;
}
const zeros = () => mapHeroes(() => 0);

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

export function runBench(
  level: BotLevel,
  battles: number,
  enemyId: string,
  party: readonly PartyMember[] = DEFAULT_PARTY,
): BenchResult {
  let wins = 0;
  let turnsWin = 0;
  let turnsAll = 0;
  let damage = 0;
  const specials = zeros();
  const picked = zeros();
  const chainHist = Array<number>(10).fill(0);
  for (let b = 0; b < battles; b++) {
    let state = createBattle(1_000_003 * (b + 1), enemyId, party);
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
  const total = ALL_HEROES.reduce((sum, h) => sum + picked[h], 0);
  const per = (r: Record<HeroId, number>, d: number) => mapHeroes((h) => (d ? r[h] / d : 0));
  return {
    level,
    battles,
    winRate: wins / battles,
    avgTurnsWin: wins ? turnsWin / wins : 0,
    avgTurns: turnsAll / battles,
    specialsPerBattle: per(specials, battles),
    specialRatePerTurn: mapHeroes((h) => (picked[h] ? specials[h] / picked[h] : 0)),
    avgDamagePerTurn: damage / turnsAll,
    maxChainHistogram: chainHist,
    heroShare: per(picked, total),
  };
}

/**
 * 必殺の形の作りやすさ：skilled で進めた実戦に近い盤面で、1ターン（3回まで回す）でそのキャラの必殺の形を作れる割合。
 * 回数ごと（1回・2回以内・3回以内）に出す。3回まで全部の回し方を調べるので時間がかかる
 */
export function shapeAvailability(battles: number, turnsPerBattle = 5): { boards: number; rate: Record<HeroId, number[]> } {
  const heroes: readonly HeroId[] = ALL_HEROES;
  const found = mapHeroes(() => [0, 0, 0]);
  const rotations = allRotations();
  const key = (b: Board) => b.map((row) => row.map((c) => c[0]).join('')).join('');
  let boards = 0;
  for (let b = 0; b < battles; b++) {
    let state = createBattle(9_000_011 * (b + 1), 'shadow');
    let botSeed = b;
    for (let t = 0; t < turnsPerBattle && state.status === 'playing'; t++) {
      boards++;
      const first: Partial<Record<HeroId, number>> = {};
      let layer = [state.board];
      const seen = new Set([key(state.board)]);
      for (let depth = 1; depth <= MAX_ROTATIONS_PER_TURN; depth++) {
        const next: Board[] = [];
        for (const board of layer) {
          for (const r of rotations) {
            const nb = rotate2x2(board, r.row, r.col, r.direction);
            const k = key(nb);
            if (seen.has(k)) continue;
            seen.add(k);
            next.push(nb);
          }
        }
        for (const hero of heroes) {
          if (first[hero] === undefined && next.some((nb) => detectHeroSpecial(nb, hero) !== null)) first[hero] = depth;
        }
        layer = next;
      }
      for (const hero of heroes) {
        const d = first[hero];
        if (d !== undefined) for (let k = d - 1; k < MAX_ROTATIONS_PER_TURN; k++) found[hero][k]++;
      }
      const c = chooseAction(state, 'skilled', botSeed);
      botSeed = c.seed;
      state = resolveTurn(state, c.action).state;
    }
  }
  return { boards, rate: mapHeroes((h) => found[h].map((n) => n / boards)) };
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
    const ids = DEFAULT_PARTY.map((m) => m.id);
    const line = (f: (h: HeroId) => string) => ids.map((h) => `${HEROES[h].name} ${f(h)}`).join(' ');
    console.log(`キャラを選んだ割合 ${line((h) => pct(r.heroShare[h]))}`);
    console.log(`必殺（1戦あたり） ${line((h) => r.specialsPerBattle[h].toFixed(2))}`);
    console.log(`必殺（そのキャラを選んだターンのうち） ${line((h) => pct(r.specialRatePerTurn[h]))}`);
    console.log(`最大連鎖の分布（0〜8） ${r.maxChainHistogram.slice(0, 9).join(' / ')}`);
  }
  if (!only) {
    const a = shapeAvailability(40);
    const show = (r: number[]) => r.map((x) => pct(x)).join(' → ');
    console.log(`\n== 必殺の形の作りやすさ（実戦に近い盤面 ${a.boards} 面で、1回 → 2回以内 → 3回以内に作れる割合）`);
    for (const h of ALL_HEROES) {
      const sp = HEROES[h].special;
      console.log(`${HEROES[h].name}（${sp.color} ${sp.shape}・威力 ${sp.power}） ${show(a.rate[h])}`);
    }
  }
}

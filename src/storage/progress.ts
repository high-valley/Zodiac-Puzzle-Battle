// 進行の保存（クリアしたステージと★、途中のバトル）。端末の localStorage に置く
// 報酬や通貨はここに置かない（課金を入れる段階でサーバーに持つ。仕様書 19章）
import { BOARD_SIZE, ORB_COLORS } from '../data/balance';
import { ENEMIES } from '../data/enemies';
import { PARTY } from '../data/heroes';
import { ALL_STAGES, findStage, previousStage } from '../data/stages';
import type { BattleState } from '../game/types';

export interface StageRecord {
  /** いちばん良かった★（0〜3） */
  stars: number;
  /** 勝ったときのいちばん少ないターン数 */
  bestTurns: number | null;
}

export interface SavedBattle {
  stageId: string;
  state: BattleState;
}

export interface Progress {
  version: 1;
  stages: Record<string, StageRecord>;
  /** 途中のバトル（なければ null） */
  battle: SavedBattle | null;
}

const KEY = 'zodiac-puzzle-battle:progress';

export function emptyProgress(): Progress {
  return { version: 1, stages: {}, battle: null };
}

const isInt = (v: unknown, min = -Infinity, max = Infinity): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** 保存されていたバトルの状態が、いまのゲームで続けられる形かを確かめる */
export function isBattleState(v: unknown): v is BattleState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  const board = s.board;
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) return false;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) return false;
    if (!row.every((c) => (ORB_COLORS as readonly unknown[]).includes(c))) return false;
  }
  if (!(PARTY as readonly unknown[]).includes(s.selectedHero)) return false;
  if (typeof s.enemyId !== 'string' || !ENEMIES[s.enemyId]) return false;
  if (!isInt(s.turn, 1)) return false;
  if (!isInt(s.partyMaxHp, 1) || !isInt(s.partyHp, 0, s.partyMaxHp as number)) return false;
  if (!isInt(s.enemyMaxHp, 1) || !isInt(s.enemyHp, 0, s.enemyMaxHp as number)) return false;
  if (!(s.enemyChargeIn === null || isInt(s.enemyChargeIn, 1))) return false;
  if (!isInt(s.rngSeed, 0, 0xffffffff)) return false;
  if (s.status !== 'playing') return false;
  const st = s.stats as Record<string, unknown> | null;
  if (typeof st !== 'object' || st === null) return false;
  return isInt(st.maxChain, 0) && isInt(st.specials, 0) && isInt(st.damageDealt, 0) && isInt(st.healed, 0);
}

/** 保存されていた文字列を読む。壊れた部分は捨て、読める部分だけ残す */
export function parseProgress(raw: string | null): Progress {
  const progress = emptyProgress();
  if (!raw) return progress;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return progress;
  }
  if (typeof data !== 'object' || data === null) return progress;
  const d = data as Record<string, unknown>;
  if (typeof d.stages === 'object' && d.stages !== null) {
    for (const [id, rec] of Object.entries(d.stages as Record<string, unknown>)) {
      if (!findStage(id) || typeof rec !== 'object' || rec === null) continue;
      const r = rec as Record<string, unknown>;
      if (!isInt(r.stars, 0, 3)) continue;
      progress.stages[id] = { stars: r.stars, bestTurns: isInt(r.bestTurns, 1) ? r.bestTurns : null };
    }
  }
  const b = d.battle as Record<string, unknown> | null | undefined;
  if (b && typeof b.stageId === 'string' && findStage(b.stageId) && isBattleState(b.state)) {
    const stage = findStage(b.stageId)!;
    if (stage.enemyId === (b.state as BattleState).enemyId) {
      progress.battle = { stageId: b.stageId, state: b.state as BattleState };
    }
  }
  return progress;
}

/** 勝ち負けを記録した新しい進行を返す（★とターン数は良いほうを残す）。途中のバトルは消す */
export function recordResult(progress: Progress, stageId: string, stars: number, turns: number | null): Progress {
  const prev = progress.stages[stageId] ?? { stars: 0, bestTurns: null };
  const bestTurns =
    turns === null ? prev.bestTurns : prev.bestTurns === null ? turns : Math.min(prev.bestTurns, turns);
  return {
    ...progress,
    stages: { ...progress.stages, [stageId]: { stars: Math.max(prev.stars, stars), bestTurns } },
    battle: null,
  };
}

/** 遊べるステージか：最初のステージと、ひとつ前を★1以上でクリアしたステージ */
export function isUnlocked(progress: Progress, stageId: string): boolean {
  if (!findStage(stageId)) return false;
  const prev = previousStage(stageId);
  return prev === null || (progress.stages[prev.id]?.stars ?? 0) > 0;
}

/** まだクリアしていない最初のステージ（全部クリア済みなら最後のステージ） */
export function nextStageId(progress: Progress): string {
  const next = ALL_STAGES.find((s) => !(progress.stages[s.id]?.stars ?? 0));
  return (next ?? ALL_STAGES[ALL_STAGES.length - 1]).id;
}

export function loadProgress(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(KEY));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // 保存できなくてもゲームは続ける
  }
}

export function clearAllData(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem('zodiac-puzzle-battle:settings');
  } catch {
    // 消せなくても続ける
  }
}

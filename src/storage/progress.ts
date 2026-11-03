// 進行の保存（クリアしたステージと★、途中のバトル）。端末の localStorage に置く
// 報酬や通貨はここに置かない（課金を入れる段階でサーバーに持つ。仕様書 19章）
import { BOARD_SIZE, ORB_COLORS } from '../data/balance';
import { ENEMIES } from '../data/enemies';
import { MAX_LEVEL, expToNext } from '../data/growth';
import { ALL_HEROES, DEFAULT_PARTY, HERO_JOIN, isHeroId, joinersOf, type HeroJoin } from '../data/heroes';
import { NEW_HERO, gainExp, type HeroGrowth } from '../game/growth';
import { partyMaxHp, partyProblem } from '../game/party';
import { ALL_STAGES, findStage, previousStage } from '../data/stages';
import type { BattleState, HeroId, PartyMember, Rotation } from '../game/types';
import { isValidIntersection } from '../game/board';
import { MAX_ROTATIONS_PER_TURN } from '../data/balance';

export interface StageRecord {
  /** いちばん良かった★（0〜3） */
  stars: number;
  /** 勝ったときのいちばん少ないターン数 */
  bestTurns: number | null;
}

export interface SavedBattle {
  stageId: string;
  state: BattleState;
  /** このターンにすでに回した分（「攻撃」を押す前に閉じたとき用） */
  pending: Rotation[];
}

export interface Progress {
  version: 1;
  stages: Record<string, StageRecord>;
  /** 途中のバトル（なければ null） */
  battle: SavedBattle | null;
  /** 次に出撃する仲間（編成画面で決める） */
  party: HeroId[];
  /** キャラごとのレベルと経験値（無いキャラはレベル1） */
  heroes: Partial<Record<HeroId, HeroGrowth>>;
}

const KEY = 'zodiac-puzzle-battle:progress';

export function emptyProgress(): Progress {
  return { version: 1, stages: {}, battle: null, party: DEFAULT_PARTY.map((m) => m.id), heroes: {} };
}

export function heroGrowth(progress: Progress, id: HeroId): HeroGrowth {
  return progress.heroes[id] ?? NEW_HERO;
}

/** 仲間になっているか：最初からいるか、加入のステージをクリアしているか（仕様書 12.6） */
export function isHeroJoined(progress: Progress, id: HeroId, table: Record<HeroId, HeroJoin> = HERO_JOIN): boolean {
  const j = table[id];
  if (j === 'start') return true;
  if (j === 'later') return false;
  return (progress.stages[j.stageId]?.stars ?? 0) > 0;
}

/** 仲間の一覧（星座の順） */
export function joinedHeroes(progress: Progress, joined = (id: HeroId) => isHeroJoined(progress, id)): HeroId[] {
  return ALL_HEROES.filter(joined);
}

/**
 * 出撃する仲間。保存した編成にまだ仲間でないキャラがいれば（開発者モードで組んだ編成を、モードを切ったあとなど）、最初の編成にする。
 * joined は開発者モードのときに差し替える
 */
export function activeParty(progress: Progress, joined = (id: HeroId) => isHeroJoined(progress, id)): HeroId[] {
  return progress.party.every(joined) ? [...progress.party] : DEFAULT_PARTY.map((m) => m.id);
}

/** 出撃する仲間を、それぞれのレベルつきで */
export function partyMembers(progress: Progress, joined = (id: HeroId) => isHeroJoined(progress, id)): PartyMember[] {
  return activeParty(progress, joined).map((id) => ({ id, level: heroGrowth(progress, id).level }));
}

/** そのステージを初めてクリアしたことで加入するキャラ（before はクリアを記録する前の進行） */
export function heroesJoinedBy(
  before: Progress,
  stageId: string,
  victory: boolean,
  table: Record<HeroId, HeroJoin> = HERO_JOIN,
): HeroId[] {
  if (!victory || (before.stages[stageId]?.stars ?? 0) > 0) return [];
  return joinersOf(stageId, table);
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
  // 出撃した仲間が編成のルールに合うこと（前の版の selectedHero は使わない。仕様書 12.7）
  if (!Array.isArray(s.party) || s.party.some((m) => typeof m !== 'object' || m === null)) return false;
  const party = s.party as PartyMember[];
  if (partyProblem(party) !== null) return false;
  if (typeof s.enemyId !== 'string' || !ENEMIES[s.enemyId]) return false;
  const enemy = ENEMIES[s.enemyId];
  if (!isInt(s.turn, 1)) return false;
  // 最大HPは今の設定データと同じであること（数値を調整したあとの古い途中バトルは続けず、はじめからにする）
  if (s.partyMaxHp !== partyMaxHp(party) || s.enemyMaxHp !== enemy.maxHp) return false;
  // 戦闘中なので、どちらのHPも1以上
  if (!isInt(s.partyHp, 1, s.partyMaxHp as number) || !isInt(s.enemyHp, 1, s.enemyMaxHp as number)) return false;
  // 強攻撃の残りターンは、その敵の強攻撃の間隔の中に収まっていること
  if (enemy.heavy ? !isInt(s.enemyChargeIn, 1, enemy.heavy.every) : s.enemyChargeIn !== null) return false;
  if (!isInt(s.rngSeed, 0, 0xffffffff)) return false;
  if (s.status !== 'playing') return false;
  const st = s.stats as Record<string, unknown> | null;
  if (typeof st !== 'object' || st === null) return false;
  return isInt(st.maxChain, 0) && isInt(st.specials, 0) && isInt(st.damageDealt, 0) && isInt(st.healed, 0);
}

/** 回した途中の分を読む。おかしければ回していないことにする（盤面は保存した状態のまま） */
export function parsePending(v: unknown): Rotation[] {
  if (!Array.isArray(v) || v.length > MAX_ROTATIONS_PER_TURN) return [];
  const ok = v.every(
    (r) =>
      typeof r === 'object' &&
      r !== null &&
      isValidIntersection((r as Rotation).row, (r as Rotation).col) &&
      ((r as Rotation).direction === 'clockwise' || (r as Rotation).direction === 'counterclockwise'),
  );
  return ok ? v.map((r: Rotation) => ({ row: r.row, col: r.col, direction: r.direction })) : [];
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
  // キャラのレベルと経験値
  if (typeof d.heroes === 'object' && d.heroes !== null) {
    for (const [id, rec] of Object.entries(d.heroes as Record<string, unknown>)) {
      if (!isHeroId(id) || typeof rec !== 'object' || rec === null) continue;
      const r = rec as Record<string, unknown>;
      if (!isInt(r.level, 1, MAX_LEVEL)) continue;
      const level = r.level as number;
      const exp = level >= MAX_LEVEL ? 0 : isInt(r.exp, 0, expToNext(level) - 1) ? (r.exp as number) : 0;
      progress.heroes[id as HeroId] = { level, exp };
    }
  }
  // 編成（ルールに合わなければ最初の編成に戻す）
  if (Array.isArray(d.party) && d.party.every(isHeroId)) {
    const ids = d.party as HeroId[];
    if (partyProblem(ids.map((id) => ({ id, level: 1 }))) === null) progress.party = [...ids];
  }
  // 途中のバトルは、まだ開いていないステージのものなら捨てる
  const b = d.battle as Record<string, unknown> | null | undefined;
  // M3 までの途中バトルには party が無い。そのころは最初の編成（レベル1）だけだったので補って続ける
  if (b && typeof b.state === 'object' && b.state !== null && !('party' in b.state)) {
    b.state = { ...(b.state as object), party: DEFAULT_PARTY.map((m) => ({ ...m })) };
  }
  if (b && typeof b.stageId === 'string' && isUnlocked(progress, b.stageId) && isBattleState(b.state)) {
    const stage = findStage(b.stageId)!;
    if (stage.enemyId === (b.state as BattleState).enemyId) {
      progress.battle = { stageId: b.stageId, state: b.state as BattleState, pending: parsePending(b.pending) };
    }
  }
  return progress;
}

/** レベルの変化（リザルトの表示用） */
export interface GrowthChange {
  id: HeroId;
  before: number;
  after: number;
}

/**
 * 出撃した仲間（バトルを始めたときの編成。今の編成ではない）それぞれに経験値を足した新しい進行を返す。
 * 端末に保存する。報酬をサーバーで確定させる段階で、この処理はサーバーへ移す（仕様書 12.4）
 */
export function applyBattleExp(
  progress: Progress,
  party: readonly PartyMember[],
  exp: number,
): { progress: Progress; growth: GrowthChange[] } {
  const heroes = { ...progress.heroes };
  const growth: GrowthChange[] = [];
  for (const m of party) {
    const before = heroGrowth(progress, m.id);
    const after = gainExp(before, exp);
    heroes[m.id] = { level: after.level, exp: after.exp };
    growth.push({ id: m.id, before: before.level, after: after.level });
  }
  return { progress: { ...progress, heroes }, growth };
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

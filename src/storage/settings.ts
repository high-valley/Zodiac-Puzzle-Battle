// 端末に保存する設定（効果音・演出の速さ・遊び方を見たか）。
// 「回転ボタンを出すか」は 2026-11-04 にボタンをなくしたので外した（保存されていても読み飛ばす）
// 保存できない環境（プライベートブラウズなど）でも動くよう、失敗は無視して既定値を使う
import { DEFAULT_ROTATE_TUNING, ROTATE_TUNING_RANGE, type RotateTuning } from '../data/balance';
import { DEV_TOOLS } from '../data/devTools';

export interface Settings {
  soundOn: boolean;
  tutorialSeen: boolean;
  /** 演出の速さ（1：ふつう、2：はやい） */
  speed: 1 | 2;
  /** 開発者モード：キャラとステージをすべて解放して見る（保存した進行は書き換えない） */
  devUnlockAll: boolean;
  /** 開発者モード：回す動きの速さを試すための値（null なら設定データの値） */
  devRotate: RotateTuning | null;
}

export const DEFAULT_SETTINGS: Settings = { soundOn: true, tutorialSeen: false, speed: 1, devUnlockAll: false, devRotate: null };
const KEY = 'zodiac-puzzle-battle:settings';

/** 保存されていた文字列を読み、壊れていたり足りない項目は既定値で補う */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_SETTINGS };
    const d = data as Record<string, unknown>;
    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
    return {
      soundOn: bool(d.soundOn, DEFAULT_SETTINGS.soundOn),
      tutorialSeen: bool(d.tutorialSeen, DEFAULT_SETTINGS.tutorialSeen),
      speed: d.speed === 1 || d.speed === 2 ? d.speed : DEFAULT_SETTINGS.speed,
      // 開発者の機能を外した版では、保存されていても使わない
      devUnlockAll: DEV_TOOLS && bool(d.devUnlockAll, DEFAULT_SETTINGS.devUnlockAll),
      devRotate: DEV_TOOLS ? parseRotateTuning(d.devRotate) : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 回す動きの速さの値。項目が足りない・範囲の外のときは、その項目だけ設定データの値にする */
export function parseRotateTuning(v: unknown): RotateTuning | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const out = { ...DEFAULT_ROTATE_TUNING };
  for (const key of Object.keys(ROTATE_TUNING_RANGE) as (keyof RotateTuning)[]) {
    const x = o[key];
    const r = ROTATE_TUNING_RANGE[key];
    if (typeof x === 'number' && Number.isFinite(x) && x >= r.min && x <= r.max) out[key] = x;
  }
  return out;
}

/** 今使う回す動きの速さ（開発者画面で変えていればその値） */
export function rotateTuningOf(settings: Settings): RotateTuning {
  return settings.devRotate ?? DEFAULT_ROTATE_TUNING;
}

export function loadSettings(): Settings {
  try {
    return parseSettings(window.localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくてもゲームは続ける
  }
}

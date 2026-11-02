// 端末に保存する設定（効果音・演出の速さ・回転ボタン・遊び方を見たか）
// 保存できない環境（プライベートブラウズなど）でも動くよう、失敗は無視して既定値を使う

export interface Settings {
  soundOn: boolean;
  tutorialSeen: boolean;
  /** 演出の速さ（1：ふつう、2：はやい） */
  speed: 1 | 2;
  /** バトルの「左回転」「右回転」ボタンを出すか */
  rotateButtons: boolean;
}

export const DEFAULT_SETTINGS: Settings = { soundOn: true, tutorialSeen: false, speed: 1, rotateButtons: true };
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
      rotateButtons: bool(d.rotateButtons, DEFAULT_SETTINGS.rotateButtons),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
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

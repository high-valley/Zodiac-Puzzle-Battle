// 端末に保存する設定（効果音のオン/オフ、遊び方を見たか）
// 保存できない環境（プライベートブラウズなど）でも動くよう、失敗は無視して既定値を使う

export interface Settings {
  soundOn: boolean;
  tutorialSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = { soundOn: true, tutorialSeen: false };
const KEY = 'zodiac-puzzle-battle:settings';

/** 保存されていた文字列を読み、壊れていたり足りない項目は既定値で補う */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_SETTINGS };
    const d = data as Record<string, unknown>;
    return {
      soundOn: typeof d.soundOn === 'boolean' ? d.soundOn : DEFAULT_SETTINGS.soundOn,
      tutorialSeen: typeof d.tutorialSeen === 'boolean' ? d.tutorialSeen : DEFAULT_SETTINGS.tutorialSeen,
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

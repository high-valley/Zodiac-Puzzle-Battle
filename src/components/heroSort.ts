// キャラ一覧（編成・育成）の並び替え（2026-11-07 ユーザーの要望）。
// 並べ替えはカードの要素を動かすだけで作り直さない（押したときの処理や選んだ状態をそのまま残し、ちらつかせない）
import { ALL_HEROES, HEROES } from '../data/heroes';
import { heroStats } from '../game/party';
import type { HeroId, OrbColor } from '../game/types';

export type HeroSortKey = 'zodiac' | 'level' | 'hp' | 'power' | 'defense' | 'special' | 'color';

const SORT_LABEL: Record<HeroSortKey, string> = {
  zodiac: '星座順',
  level: 'レベル',
  hp: 'HP',
  power: '攻撃・回復',
  defense: '防御',
  special: '必殺の威力',
  color: '色',
};

const COLOR_ORDER: Record<OrbColor, number> = { red: 0, blue: 1, green: 2, pink: 3 };
const STORE_KEY = 'zodiac-puzzle-battle:heroSort';

/** 前に選んだ並べ方（見る人ごとの覚え書き。読めなければ星座順） */
function loadKey(): HeroSortKey {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v && v in SORT_LABEL) return v as HeroSortKey;
  } catch {
    // 読めない環境（プライベートブラウズなど）は星座順
  }
  return 'zodiac';
}

function saveKey(key: HeroSortKey) {
  try {
    localStorage.setItem(STORE_KEY, key);
  } catch {
    // 保存できなくても並べ替えはできる
  }
}

/**
 * 並べた順のキャラ。数値は大きい順（同じなら星座順）。まだ仲間でないキャラは最後（星座順）。
 * level はそのキャラのレベル
 */
export function sortHeroes(key: HeroSortKey, joined: (id: HeroId) => boolean, level: (id: HeroId) => number): HeroId[] {
  const zodiac = (id: HeroId) => ALL_HEROES.indexOf(id);
  const value = (id: HeroId): number => {
    const st = heroStats(id, level(id));
    switch (key) {
      case 'level':
        return level(id);
      case 'hp':
        return st.hp;
      case 'power':
        return st.power;
      case 'defense':
        return st.defense;
      case 'special':
        return st.special;
      case 'color':
        // 色の順（赤・青・緑・ピンク）。小さいほど先なので負にする
        return -COLOR_ORDER[HEROES[id].special.color];
      default:
        return 0;
    }
  };
  return [...ALL_HEROES].sort((a, b) => {
    const ja = joined(a) ? 0 : 1;
    const jb = joined(b) ? 0 : 1;
    if (ja !== jb) return ja - jb;
    if (ja === 0 && key !== 'zodiac') {
      const d = value(b) - value(a);
      if (d !== 0) return d;
    }
    return zodiac(a) - zodiac(b);
  });
}

/**
 * 並び替えの選択欄を作り、一覧（roster）のカードを並べ直す。カードは data-id か data-hero を持つ要素。
 * 返す関数は、レベルなどが変わったときに並べ直すためのもの
 */
export function mountHeroSort(
  host: HTMLElement,
  roster: HTMLElement,
  joined: (id: HeroId) => boolean,
  level: (id: HeroId) => number,
): () => void {
  const id = `hero-sort-${Math.random().toString(36).slice(2, 8)}`;
  host.innerHTML = `
    <label class="hero-sort" for="${id}">
      <span>並び替え</span>
      <select id="${id}">
        ${(Object.keys(SORT_LABEL) as HeroSortKey[]).map((k) => `<option value="${k}">${SORT_LABEL[k]}</option>`).join('')}
      </select>
    </label>`;
  const select = host.querySelector('select') as HTMLSelectElement;
  select.value = loadKey();

  const apply = () => {
    const order = sortHeroes(select.value as HeroSortKey, joined, level);
    const cards = new Map<string, HTMLElement>();
    for (const el of roster.children) {
      const key = (el as HTMLElement).dataset.id ?? (el as HTMLElement).dataset.hero;
      if (key) cards.set(key, el as HTMLElement);
    }
    // いまの並びと同じなら動かさない（読み上げの位置やフォーカスを乱さない）
    const now = [...roster.children].map((el) => (el as HTMLElement).dataset.id ?? (el as HTMLElement).dataset.hero);
    if (order.every((h, i) => now[i] === h)) return;
    for (const h of order) {
      const el = cards.get(h);
      if (el) roster.append(el);
    }
  };
  select.addEventListener('change', () => {
    saveKey(select.value as HeroSortKey);
    apply();
  });
  apply();
  return apply;
}

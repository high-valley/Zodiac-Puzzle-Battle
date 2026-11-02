// キャラのカード（編成・育成・図鑑で使う）
import { HEROES } from '../data/heroes';
import type { HeroId } from '../game/types';

export const ROLE_TEXT = { attacker: '赤・青・緑で攻撃', healer: 'ピンクで回復' } as const;
export const ROLE_SHORT = { attacker: 'アタッカー', healer: 'ヒーラー' } as const;

export function heroCardInner(id: HeroId, level: number | null): string {
  const h = HEROES[id];
  return `
    <span class="hc-symbol role-${h.role}" aria-hidden="true">${h.symbol}</span>
    <span class="hc-name">${h.name}</span>
    <span class="hc-role">${ROLE_SHORT[h.role]}</span>
    ${level === null ? '' : `<span class="hc-level">Lv.${level}</span>`}`;
}

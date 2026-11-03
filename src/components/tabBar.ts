// 下のタブバー：ホーム／クエスト／編成／育成／メニュー（仕様書 11.4）
import type { Tab } from '../routes';

export const TAB_ICON: Record<Tab, string> = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  quest: '<path d="M5 19L19 5M14 5h5v5M5 14l5 5"/>',
  party: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5"/>',
  heroes: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
const LABELS: Record<Tab, string> = { home: 'ホーム', quest: 'クエスト', party: '編成', heroes: '育成', menu: 'メニュー' };

export function tabBarHtml(active: Tab): string {
  const tabs: Tab[] = ['home', 'quest', 'party', 'heroes', 'menu'];
  return `
  <nav class="tab-bar" aria-label="画面の切り替え">
    ${tabs
      .map(
        (t) => `
      <button type="button" class="tab${t === active ? ' active' : ''}" data-tab="${t}" ${t === active ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICON[t]}</svg>
        <span>${LABELS[t]}</span>
      </button>`,
      )
      .join('')}
  </nav>`;
}

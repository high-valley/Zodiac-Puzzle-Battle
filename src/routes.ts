// 画面の行き先と URL の # の対応（純粋な関数）
import { isHeroId } from './data/heroes';
import type { HeroId } from './game/types';

export type Route =
  | { name: 'home' }
  | { name: 'quest'; stageId?: string }
  | { name: 'battle'; stageId: string }
  | { name: 'result' }
  | { name: 'party' }
  | { name: 'heroes'; heroId?: HeroId }
  | { name: 'book' };

/** 下のタブバー（仕様書 11.4）。メニューは画面ではなくシート */
export type Tab = 'home' | 'quest' | 'party' | 'heroes' | 'menu';

/** その画面で光らせるタブ（タブバーを出さない画面は null） */
export function tabOf(route: Route): Tab | null {
  switch (route.name) {
    case 'home':
      return 'home';
    case 'book':
      // 図鑑はメニューから開く
      return 'menu';
    case 'quest':
      return 'quest';
    case 'party':
      return 'party';
    case 'heroes':
      return 'heroes';
    case 'battle':
    case 'result':
      return null;
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'quest':
      return route.stageId ? `#/quest/${route.stageId}` : '#/quest';
    case 'battle':
      return `#/battle/${route.stageId}`;
    case 'result':
      return '#/result';
    case 'party':
      return '#/party';
    case 'heroes':
      return route.heroId ? `#/heroes/${route.heroId}` : '#/heroes';
    case 'book':
      return '#/book';
  }
}

export function hashToRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'quest') return parts[1] ? { name: 'quest', stageId: parts[1] } : { name: 'quest' };
  if (parts[0] === 'battle' && parts[1]) return { name: 'battle', stageId: parts[1] };
  if (parts[0] === 'result') return { name: 'result' };
  if (parts[0] === 'party') return { name: 'party' };
  if (parts[0] === 'heroes') {
    return isHeroId(parts[1]) ? { name: 'heroes', heroId: parts[1] } : { name: 'heroes' };
  }
  if (parts[0] === 'book') return { name: 'book' };
  return { name: 'home' };
}

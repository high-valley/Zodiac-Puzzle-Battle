// 画面の行き先と URL の # の対応（純粋な関数）

export type Route =
  | { name: 'home' }
  | { name: 'quest'; stageId?: string }
  | { name: 'battle'; stageId: string }
  | { name: 'result' };

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
  }
}

export function hashToRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'quest') return parts[1] ? { name: 'quest', stageId: parts[1] } : { name: 'quest' };
  if (parts[0] === 'battle' && parts[1]) return { name: 'battle', stageId: parts[1] };
  if (parts[0] === 'result') return { name: 'result' };
  return { name: 'home' };
}

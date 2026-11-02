// 図鑑：12星座のキャラと、倒した敵（仕様書 11.3）
import type { AppContext } from '../app';
import { enemySvg } from '../components/enemyArt';
import { heroCardInner } from '../components/heroCard';
import { ENEMIES } from '../data/enemies';
import { ALL_HEROES } from '../data/heroes';
import { ALL_STAGES } from '../data/stages';
import type { HeroId } from '../game/types';
import { heroGrowth } from '../storage/progress';

export function mountBook(container: HTMLElement, ctx: AppContext): () => void {
  const defeated = new Set(ALL_STAGES.filter((s) => (ctx.progress.stages[s.id]?.stars ?? 0) > 0).map((s) => s.enemyId));
  const enemies = ALL_STAGES.map((s) => ({ stage: s, enemy: ENEMIES[s.enemyId] }));

  container.innerHTML = `
  <main class="book-screen">
    <header class="bar-top">
      <button type="button" class="text-btn back">‹ ホーム</button>
      <h1 class="screen-title">図鑑</h1>
    </header>
    <h2 class="section-title">星座のキャラ <small>${ALL_HEROES.length}</small></h2>
    <div class="roster" role="list">
      ${ALL_HEROES.map(
        (id) => `
        <button type="button" role="listitem" class="hero-card" data-id="${id}">
          ${heroCardInner(id, heroGrowth(ctx.progress, id).level)}
        </button>`,
      ).join('')}
    </div>
    <h2 class="section-title">敵 <small>${defeated.size} / ${enemies.length}</small></h2>
    <ul class="enemy-list">
      ${enemies
        .map(({ stage, enemy }) => {
          const known = defeated.has(enemy.id);
          return `
          <li class="enemy-entry${known ? '' : ' unknown'}">
            <div class="ee-art">${enemySvg(known ? enemy.tint : '#3a3466')}</div>
            <div>
              <p class="ee-name">${known ? enemy.name : '？？？'}</p>
              <p class="ee-meta">${stage.id}　${
                known
                  ? `HP ${enemy.maxHp.toLocaleString('ja-JP')}・攻撃 ${enemy.attack}${enemy.heavy ? `・${enemy.heavy.every}ターンごとに強攻撃 ${enemy.heavy.attack}` : ''}`
                  : 'まだ倒していない'
              }</p>
            </div>
          </li>`;
        })
        .join('')}
    </ul>
  </main>`;

  container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
  container.querySelectorAll<HTMLButtonElement>('.hero-card').forEach((b) =>
    b.addEventListener('click', () => ctx.navigate({ name: 'heroes', heroId: b.dataset.id as HeroId })),
  );
  return () => undefined;
}

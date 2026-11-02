// ホーム（M3 の簡易版）：ロゴ・3人・冒険・つづきから・遊び方・設定
import type { AppContext } from '../app';
import { constellationSvg } from '../components/constellations';
import { HEROES, PARTY } from '../data/heroes';
import { CHAPTERS, findStage, stageEnemyName } from '../data/stages';

export function mountHome(container: HTMLElement, ctx: AppContext): () => void {
  const saved = ctx.progress.battle;
  const savedStage = saved ? findStage(saved.stageId) : undefined;
  const chapter = CHAPTERS[0];
  const stars = chapter.stages.reduce((sum, s) => sum + (ctx.progress.stages[s.id]?.stars ?? 0), 0);

  container.innerHTML = `
  <main class="home">
    <header class="home-top">
      <button type="button" class="icon-btn help" aria-label="遊び方">?</button>
      <button type="button" class="icon-btn settings" aria-label="設定">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>
      </button>
    </header>

    <h1 class="logo">星座パズルバトル</h1>
    <p class="logo-sub">回して、そろえて、星座の力で戦う</p>

    <ul class="home-heroes" aria-label="パーティー">
      ${PARTY.map(
        (id) => `
        <li class="home-hero hero-${id}">
          ${constellationSvg(id, `${HEROES[id].name}の星座`)}
          <span class="home-hero-symbol" aria-hidden="true">${HEROES[id].symbol}</span>
          <span class="home-hero-name">${HEROES[id].name}</span>
          <span class="home-hero-role">${HEROES[id].role === 'healer' ? 'ヒーラー' : 'アタッカー'}</span>
        </li>`,
      ).join('')}
    </ul>

    <div class="home-actions">
      <button type="button" class="adventure">
        <span class="adventure-label">冒険</span>
        <span class="adventure-sub">第${chapter.number}章 ${chapter.name}　★ ${stars} / ${chapter.stages.length * 3}</span>
      </button>
      ${
        saved && savedStage
          ? `<button type="button" class="text-btn wide resume">つづきから　${savedStage.id} ${stageEnemyName(savedStage)}（ターン ${saved.state.turn}）</button>`
          : ''
      }
    </div>
  </main>`;

  const main = container.querySelector('.home') as HTMLElement;
  container.querySelector('.adventure')?.addEventListener('click', () => {
    ctx.sound.play({ name: 'select' });
    ctx.navigate({ name: 'quest' });
  });
  container.querySelector('.resume')?.addEventListener('click', () => {
    if (saved) ctx.navigate({ name: 'battle', stageId: saved.stageId });
  });
  container.querySelector('.help')?.addEventListener('click', () => ctx.openTutorial(main));
  container.querySelector('.settings')?.addEventListener('click', () => ctx.openSettings(main, { allowClear: true }));

  if (!ctx.settings.tutorialSeen) ctx.openTutorial(main);
  return () => undefined;
}

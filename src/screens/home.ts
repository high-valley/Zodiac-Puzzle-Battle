// ホーム：ロゴ・編成中の3人・冒険・編成／育成／図鑑・つづきから（仕様書 11.5）。
// 上の帯・左右のアイコン・スタミナ・イベントのバナーは、中身が決まるまで準備中の画面へつなぐだけ（数値は出さない）
import type { AppContext } from '../app';
import { constellationSvg } from '../components/constellations';
import { HEROES } from '../data/heroes';
import { CHAPTERS, findStage, stageEnemyName } from '../data/stages';
import { heroGrowth } from '../storage/progress';
import { FEATURE_ICON, featureShortName } from './comingSoon';
import type { FeatureId } from '../routes';

const LEFT: FeatureId[] = ['news', 'gift', 'mission', 'exchange'];
const RIGHT: FeatureId[] = ['gacha', 'shop', 'friend', 'guild'];

const sideBtn = (id: FeatureId) => `
  <button type="button" class="side-btn${id === 'gacha' ? ' gacha' : ''}" data-feature="${id}">
    <span class="side-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${FEATURE_ICON[id]}</svg></span>
    <span class="side-label">${featureShortName(id)}</span>
  </button>`;

export function mountHome(container: HTMLElement, ctx: AppContext): () => void {
  const saved = ctx.progress.battle;
  const savedStage = saved ? findStage(saved.stageId) : undefined;
  const chapter = CHAPTERS[0];
  const stars = chapter.stages.reduce((sum, s) => sum + (ctx.progress.stages[s.id]?.stars ?? 0), 0);

  container.innerHTML = `
  <main class="home">
    <header class="home-top">
      <div class="player-chip" aria-label="プレイヤー情報（準備中）">
        <span class="player-avatar" aria-hidden="true">${HEROES[ctx.progress.party[0]].symbol}</span>
        <span class="player-text"><span class="player-name">プレイヤー</span><span class="player-rank">準備中</span></span>
      </div>
      <div class="wallet" aria-label="通貨（準備中）">
        <span class="wallet-label">通貨</span><span class="wallet-v">—</span>
      </div>
      <button type="button" class="icon-btn help" aria-label="遊び方">?</button>
      <button type="button" class="icon-btn settings" aria-label="設定">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>
      </button>
    </header>

    <div class="home-stage">
    <nav class="side-col left" aria-label="お知らせなど">${LEFT.map(sideBtn).join('')}</nav>
    <nav class="side-col right" aria-label="ガチャ・ショップなど">${RIGHT.map(sideBtn).join('')}</nav>
    <h1 class="logo">星座パズルバトル</h1>
    <p class="logo-sub">回して、そろえて、星座の力で戦う</p>

    <ul class="home-heroes" aria-label="パーティー">
      ${ctx.progress.party.map(
        (id) => `
        <li class="home-hero hero-${id}">
          ${constellationSvg(id, `${HEROES[id].name}の星座`)}
          <span class="home-hero-symbol" aria-hidden="true">${HEROES[id].symbol}</span>
          <span class="home-hero-name">${HEROES[id].name}</span>
          <span class="home-hero-role">${HEROES[id].role === 'healer' ? 'ヒーラー' : 'アタッカー'}</span>
          <span class="home-hero-role">Lv.${heroGrowth(ctx.progress, id).level}</span>
        </li>`,
      ).join('')}
    </ul>
    </div>

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
      <div class="home-rounds">
        <button type="button" class="round-btn go-party"><span class="rb-icon" aria-hidden="true">✦</span>編成</button>
        <button type="button" class="round-btn go-heroes"><span class="rb-icon" aria-hidden="true">★</span>育成</button>
        <button type="button" class="round-btn go-book"><span class="rb-icon" aria-hidden="true">❖</span>図鑑</button>
      </div>
      <div class="stamina" aria-label="スタミナ（準備中）">
        <span class="stamina-label">スタミナ</span>
        <span class="bar stamina-bar" aria-hidden="true"><span class="fill"></span></span>
        <span class="stamina-v">— / —</span>
      </div>
      <button type="button" class="event-banner" data-feature="event">
        <span class="eb-tag">期間限定イベント</span>
        <span class="eb-title">準備中</span>
      </button>
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
  container.querySelector('.go-party')?.addEventListener('click', () => ctx.navigate({ name: 'party' }));
  container.querySelector('.go-heroes')?.addEventListener('click', () => ctx.navigate({ name: 'heroes' }));
  container.querySelector('.go-book')?.addEventListener('click', () => ctx.navigate({ name: 'book' }));
  container.querySelectorAll<HTMLButtonElement>('[data-feature]').forEach((b) =>
    b.addEventListener('click', () => ctx.navigate({ name: 'feature', id: b.dataset.feature as FeatureId })),
  );
  container.querySelector('.help')?.addEventListener('click', () => ctx.openTutorial(main));
  container.querySelector('.settings')?.addEventListener('click', () => ctx.openSettings(main, { allowClear: true }));

  if (!ctx.settings.tutorialSeen) ctx.openTutorial(main);
  return () => undefined;
}

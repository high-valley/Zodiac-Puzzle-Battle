// ホーム：ロゴ・編成中の仲間・冒険・編成／育成／図鑑・つづきから（仕様書 11.5）。
// 上の帯・左右のアイコン・スタミナ・イベントのバナーは、中身が決まるまで準備中の画面へつなぐだけ（数値は出さない）
import type { AppContext } from '../app';
import { assetUrl } from '../components/assets';
import { constellationSvg } from '../components/constellations';
import { ROLE_PLATE } from '../components/heroCard';
import { TAB_ICON } from '../components/tabBar';
import { artHeightRatio, HERO_ART } from '../data/heroArt';
import { HEROES } from '../data/heroes';
import type { HeroId } from '../game/types';
import { CHAPTERS, findStage, stageEnemyName } from '../data/stages';
import { heroGrowth, nextStageId } from '../storage/progress';
import { FEATURE_ICON, featureShortName } from './comingSoon';
import type { FeatureId } from '../routes';

const LEFT: FeatureId[] = ['news', 'gift', 'mission', 'exchange'];
const RIGHT: FeatureId[] = ['gacha', 'shop', 'friend', 'guild'];

/** 図鑑のアイコン（開いた本） */
const BOOK_ICON = '<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6zM12 6v14.5"/>';
/** スタミナのアイコン（稲妻） */
const BOLT_ICON = '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>';

/**
 * 編成の人数ごとの並び（編成の順に、横の位置％・手前か奥か）。1人目がいちばん手前のまんなか寄り。
 * 名前の札は見た目の順（左から）に並べ、読み上げも同じ順にする
 */
// lift：後ろの列を少し上に立たせる（4人のとき、前の2人の肩の上から顔が見えるように）
const FORMATION: Record<number, { x: number; back: boolean; lift?: boolean }[]> = {
  1: [{ x: 50, back: false }],
  2: [{ x: 38, back: false }, { x: 64, back: true }],
  3: [{ x: 50, back: false }, { x: 25, back: true }, { x: 75, back: true }],
  4: [{ x: 24, back: false }, { x: 76, back: false }, { x: 41, back: true, lift: true }, { x: 60, back: true, lift: true }],
};

const sideBtn = (id: FeatureId) => `
  <button type="button" class="side-btn${id === 'gacha' ? ' gacha' : ''}" data-feature="${id}">
    <span class="side-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${FEATURE_ICON[id]}</svg></span>
    <span class="side-label">${featureShortName(id)}</span>
  </button>`;

/** 並べたときの絵の幅（いちばん背の高いキャラの背丈を 1 とした割合） */
const artWidth = (id: HeroId) => (HERO_ART[id].width / HERO_ART[id].height) * artHeightRatio(id);

/** 立ち絵と、その後ろの星座の線画。背丈の比のまま並べる（data/heroArt） */
function figureHtml(id: HeroId, place: { x: number; back: boolean; lift?: boolean }): string {
  const a = HERO_ART[id];
  return `
      <div class="home-figure${place.back ? ' back' : ' front'}${place.lift ? ' lift' : ''}" style="--h:${artHeightRatio(id).toFixed(3)};--hx:${a.headX};--x:${place.x}%" aria-hidden="true">
        ${constellationSvg(id, '')}
        <img src="${assetUrl(a.file)}" width="${a.width}" height="${a.height}" alt="" decoding="async" draggable="false" />
      </div>`;
}

export function mountHome(container: HTMLElement, ctx: AppContext): () => void {
  const saved = ctx.progress.battle;
  const party = ctx.party();
  const formation = FORMATION[party.length] ?? FORMATION[3];
  // 4人のときは、絵の細い2人を前に、幅の広い2人（大きな剣・ふたりの双子など）を後ろの少し高い所に立たせる。
  // 前に幅の広い絵が来ると、後ろの2人がほとんど隠れるため。札は左からの並びで出すので、どの位置でも名前と合う
  const placed = party.length === 4 ? [...party].sort((p, q) => artWidth(p) - artWidth(q)) : party;
  const savedStage = saved ? findStage(saved.stageId) : undefined;
  // 「冒険へ」に出す章：次に遊ぶステージの章（全部クリアしたら最後の章）
  const chapter = CHAPTERS.find((c) => c.number === findStage(nextStageId(ctx.progress))?.chapter) ?? CHAPTERS[0];
  const stars = chapter.stages.reduce((sum, s) => sum + (ctx.progress.stages[s.id]?.stars ?? 0), 0);

  container.innerHTML = `
  <main class="home">
    <header class="home-top">
      <div class="player-chip" aria-label="プレイヤー情報（準備中）">
        <span class="player-avatar" aria-hidden="true">${HEROES[party[0]].symbol}</span>
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
    <h1 class="logo"><span class="logo-ja">アストラクロニクル</span><span class="logo-en" aria-hidden="true">ASTRA CHRONICLE</span></h1>

    <div class="home-party">
      ${placed.map((id, i) => figureHtml(id, formation[i])).join('')}
      <ul class="home-plates count-${party.length}" aria-label="パーティー">
        ${placed
          .map((id, i) => ({ id, x: formation[i].x }))
          .sort((p, q) => p.x - q.x)
          .map(({ id }) => id)
          .map(
            (id) => `
          <li class="home-plate">
            <span class="plate-badge orb-${HEROES[id].special.color}" aria-hidden="true">${HEROES[id].symbol}</span>
            <span class="plate-text">
              <span class="plate-name">${HEROES[id].name}</span>
              <span class="plate-meta"><span class="plate-role">${ROLE_PLATE[HEROES[id].role]}　</span>Lv.${heroGrowth(ctx.progress, id).level}</span>
            </span>
          </li>`,
          )
          .join('')}
      </ul>
    </div>
    </div>

    <div class="home-actions">
      <div class="adventure-wrap">
      <button type="button" class="adventure">
        <span class="adventure-label">冒険</span>
        <span class="adventure-sub">第${chapter.number}章 ${chapter.name}　★ ${stars} / ${chapter.stages.length * 3}</span>
      </button>
      </div>
      ${
        saved && savedStage && ctx.canResume()
          ? `<button type="button" class="text-btn wide resume">つづきから　${savedStage.id} ${stageEnemyName(savedStage)}（ターン ${saved.state.turn}）</button>`
          : ''
      }
      <div class="home-rounds">
        <button type="button" class="round-btn go-party"><svg class="rb-icon" viewBox="0 0 24 24" aria-hidden="true">${TAB_ICON.party}</svg>編成</button>
        <button type="button" class="round-btn go-heroes"><svg class="rb-icon" viewBox="0 0 24 24" aria-hidden="true">${TAB_ICON.heroes}</svg>育成</button>
        <button type="button" class="round-btn go-book"><svg class="rb-icon" viewBox="0 0 24 24" aria-hidden="true">${BOOK_ICON}</svg>図鑑</button>
      </div>
      <div class="stamina" aria-label="スタミナ（準備中）">
        <span class="stamina-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${BOLT_ICON}</svg></span>
        <span class="stamina-label">スタミナ</span>
        <span class="bar stamina-bar" aria-hidden="true"><span class="fill"></span></span>
        <span class="stamina-v">— / —</span>
      </div>
      <button type="button" class="event-banner" data-feature="event">
        <span class="eb-sea" aria-hidden="true"></span>
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

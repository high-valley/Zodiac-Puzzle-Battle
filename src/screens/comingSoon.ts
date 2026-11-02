// まだ中身の決まっていない画面（仕様書 11.3 の「未決定」の行と 16章-10〜12）。
// 画面のつながりと配置を見るための仮の画面で、数値や報酬は出さない（決まったものから中身を作る）
import type { AppContext } from '../app';
import type { FeatureId } from '../routes';

/** アイコン（24×24 の線画） */
export const FEATURE_ICON: Record<FeatureId, string> = {
  news: '<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>',
  gift: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-2-3-6-3-5 0M12 7c2-3 6-3 5 0"/>',
  mission: '<path d="M7 4h10v16H7z"/><path d="M10 9l1.5 1.5L14 8M10 15h4"/>',
  friend: '<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M15 15c3 0 5 1.5 5 4"/>',
  guild: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2 9.5 15.6l.6-2.8L8 10.9l2.8-.3z"/>',
  shop: '<path d="M4 9l2-5h12l2 5M4 9h16v11H4z"/><path d="M4 9c0 2 4 2 4 0 0 2 4 2 4 0 0 2 4 2 4 0 0 2 4 2 4 0M10 20v-5h4v5"/>',
  exchange: '<path d="M5 8h13l-3-3M19 16H6l3 3"/>',
  gacha: '<circle cx="12" cy="12" r="8"/><path d="M12 6l1.6 3.6 3.9.4-2.9 2.6.8 3.9L12 14.6 8.6 16.5l.8-3.9L6.5 10l3.9-.4z"/>',
  event: '<path d="M4 20V5M4 5h12l-2 4 2 4H4"/>',
};

interface FeatureDef {
  title: string;
  /** この画面でできるようになること（ひとこと） */
  lead: string;
  /** 予定していること（仕様書の該当箇所） */
  plans: string[];
  /** 仮の中身（配置を見るための形だけ） */
  body: () => string;
}

const skeletonRows = (n: number, cls = '') =>
  [...Array(n)].map(() => `<li class="sk-row ${cls}"><span class="sk-thumb"></span><span class="sk-lines"><span></span><span></span></span></li>`).join('');

const tabs = (names: string[]) =>
  `<div class="sk-tabs" aria-hidden="true">${names.map((n, i) => `<span class="${i === 0 ? 'on' : ''}">${n}</span>`).join('')}</div>`;

export const FEATURES: Record<FeatureId, FeatureDef> = {
  news: {
    title: 'お知らせ',
    lead: '運営からのお知らせ、メンテナンスや不具合の情報を見る画面です。',
    plans: ['お知らせの一覧と本文', '未読の印（ホームのアイコンに出す）', '配信にはサーバーが要る（仕様書 19.1）'],
    body: () => `${tabs(['すべて', 'イベント', '不具合'])}<ul class="sk-list">${skeletonRows(4)}</ul>`,
  },
  gift: {
    title: 'プレゼント',
    lead: 'お詫びやイベントの報酬を受け取る画面です。',
    plans: ['受け取れる物の一覧と受け取り期限', 'まとめて受け取る', '報酬はサーバーで確定させる（仕様書 19.1）'],
    body: () => `<p class="sk-empty">受け取れるプレゼントはありません</p><ul class="sk-list faint">${skeletonRows(2)}</ul>`,
  },
  mission: {
    title: 'ミッション',
    lead: '毎日・毎週の目標を達成して報酬をもらう画面です。',
    plans: ['デイリー／ウィークリー／ストーリーの目標', '進み具合のバー', '中身と報酬は未決定（仕様書 16章-12）'],
    body: () => `${tabs(['デイリー', 'ウィークリー', 'ストーリー'])}<ul class="sk-list">${skeletonRows(4, 'with-bar')}</ul>`,
  },
  friend: {
    title: 'フレンド',
    lead: 'ほかのプレイヤーとフレンドになり、助っ人を借りる画面です。',
    plans: ['フレンドの一覧・申請・検索', 'アカウントとサーバーが要る（仕様書 19.1）', '入れる時期は未決定（仕様書 16章-11）'],
    body: () => `${tabs(['フレンド', '申請', '検索'])}<ul class="sk-list">${skeletonRows(3)}</ul>`,
  },
  guild: {
    title: 'ギルド',
    lead: '仲間と集まって協力する画面です。',
    plans: ['ギルドの参加・作成', '投稿を入れる場合は通報・ブロックが要る（仕様書 19.2）', '入れる時期は未決定（仕様書 16章-11）'],
    body: () => `<div class="sk-banner" aria-hidden="true"></div><ul class="sk-list">${skeletonRows(3)}</ul>`,
  },
  shop: {
    title: 'ショップ',
    lead: '通貨やスタミナの回復などを買う画面です。',
    plans: ['アプリ内課金で売る（仕様書 19.2）', '有償と無償の通貨を分ける（仕様書 19.3）', '品ぞろえと値段は未決定'],
    body: () => `${tabs(['おすすめ', '通貨', 'スタミナ'])}<div class="sk-grid">${[...Array(6)].map(() => '<span class="sk-card"></span>').join('')}</div>`,
  },
  exchange: {
    title: '交換所',
    lead: 'バトルで集めた物を、ほかの物と交換する画面です。',
    plans: ['交換に使う物と交換できる物は未決定（仕様書 16章-10）'],
    body: () => `<ul class="sk-list">${skeletonRows(4)}</ul>`,
  },
  gacha: {
    title: 'ガチャ',
    lead: 'キャラや装備を手に入れる画面です。',
    plans: ['回す前に排出確率を見せる（仕様書 19.2）', '出る物・確率・天井は未決定（仕様書 19.4）', '抽選はサーバーで行う（仕様書 19.1）'],
    body: () => `
      <div class="sk-banner tall" aria-hidden="true"></div>
      <div class="sk-gacha-btns" aria-hidden="true"><span>1回</span><span>10回</span></div>
      <p class="sk-note">排出確率の表示</p>`,
  },
  event: {
    title: '期間限定イベント',
    lead: '期間限定のクエストや報酬を遊ぶ画面です。',
    plans: ['イベントのクエストと期間', '報酬（仕様書 16章-12）', '中身と時期は未決定'],
    body: () => `<div class="sk-banner tall" aria-hidden="true"></div><ul class="sk-list">${skeletonRows(3)}</ul>`,
  },
};

export function mountComingSoon(container: HTMLElement, ctx: AppContext, id: FeatureId): () => void {
  const f = FEATURES[id];
  container.innerHTML = `
  <main class="soon-screen">
    <header class="bar-top">
      <button type="button" class="text-btn back">‹ ホーム</button>
      <h1 class="screen-title">${f.title}</h1>
    </header>
    <div class="soon-head">
      <span class="soon-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${FEATURE_ICON[id]}</svg></span>
      <div>
        <span class="soon-badge">準備中</span>
        <p class="soon-lead">${f.lead}</p>
      </div>
    </div>
    <section class="soon-preview" aria-label="画面の仮の形">${f.body()}</section>
    <section class="panel soon-plans" aria-labelledby="soon-plans-title">
      <h2 id="soon-plans-title" class="panel-title">この画面で予定していること</h2>
      <ul>${f.plans.map((p) => `<li>${p}</li>`).join('')}</ul>
    </section>
  </main>`;
  container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
  return () => undefined;
}

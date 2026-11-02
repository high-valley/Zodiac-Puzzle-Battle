// 開発者画面（#/dev）：すべて解放した状態で全画面を確かめるための入口（仕様書 11.16）。
// 「すべて解放」は表示の上だけで、保存した進行（クリアの記録・仲間）は書き換えない。レベルのボタンだけは進行を書き換える
import type { AppContext } from '../app';
import { MAX_LEVEL } from '../data/growth';
import { ALL_HEROES, HEROES } from '../data/heroes';
import { ALL_STAGES } from '../data/stages';
import { FEATURE_IDS, type Route } from '../routes';
import { featureShortName } from './comingSoon';
import type { BattleOutcome } from './battle';

/** リザルトの見本（バトルをしなくてもリザルト画面を見られるように） */
function sampleOutcome(ctx: AppContext, victory: boolean): BattleOutcome {
  const party = ctx.party();
  return {
    stageId: '1-3',
    victory,
    turns: victory ? 8 : 11,
    partyHp: victory ? 214 : 0,
    partyMaxHp: 300,
    enemyHp: victory ? 0 : 342,
    stats: { maxChain: 4, specials: 2, damageDealt: victory ? 1480 : 1138, healed: 160 },
    stars: victory ? 3 : 0,
    newBestStars: false,
    newBestTurns: false,
    exp: victory ? 50 : 12,
    growth: party.map((id, i) => ({ id, before: 3, after: victory && i === 0 ? 4 : 3 })),
    joined: victory ? ['leo'] : [],
  };
}

export function mountDev(container: HTMLElement, ctx: AppContext): () => void {
  const links: { label: string; route: Route }[] = [
    { label: 'ホーム', route: { name: 'home' } },
    { label: 'クエスト選択', route: { name: 'quest' } },
    ...ALL_STAGES.map((s) => ({ label: `バトル ${s.id}`, route: { name: 'battle', stageId: s.id } as Route })),
    { label: '編成', route: { name: 'party' } },
    { label: '育成（一覧）', route: { name: 'heroes' } },
    { label: '図鑑', route: { name: 'book' } },
    ...FEATURE_IDS.map((id) => ({ label: featureShortName(id), route: { name: 'feature', id } as Route })),
  ];

  function render() {
    const all = ctx.settings.devUnlockAll;
    container.innerHTML = `
    <main class="dev-screen">
      <header class="bar-top">
        <button type="button" class="text-btn back">‹ ホーム</button>
        <h1 class="screen-title">開発者画面</h1>
      </header>
      <p class="screen-lead">確認のための画面です。App Store に出す版では外します。</p>

      <section class="panel">
        <h2 class="panel-title">すべて解放</h2>
        <label class="dev-toggle">
          <input type="checkbox" class="unlock-all" ${all ? 'checked' : ''} />
          <span>キャラ12人とすべてのステージを使えるようにする</span>
        </label>
        <p class="dev-note">${
          all
            ? 'オンです。画面のいちばん上に金の線が出ます。クリアの記録や仲間の保存はそのままなので、オフにすると元に戻ります。'
            : 'オフです。ふつうに遊んだときと同じ見え方です。'
        }</p>
      </section>

      <section class="panel">
        <h2 class="panel-title">キャラのレベル</h2>
        <p class="dev-note">12人全員のレベルを変えます（保存した進行を書き換えます）。</p>
        <div class="dev-row">
          ${[1, 10, MAX_LEVEL].map((lv) => `<button type="button" class="text-btn set-level" data-level="${lv}">全員 Lv.${lv}</button>`).join('')}
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">画面</h2>
        <div class="dev-grid">
          ${links.map((l, i) => `<button type="button" class="text-btn go" data-i="${i}">${l.label}</button>`).join('')}
          <button type="button" class="text-btn result-win">リザルト（勝利の見本）</button>
          <button type="button" class="text-btn result-lose">リザルト（敗北の見本）</button>
          <button type="button" class="text-btn open-howto">遊び方</button>
          <button type="button" class="text-btn open-settings">設定</button>
        </div>
        <h3 class="dev-sub">育成（キャラごと）</h3>
        <div class="dev-grid">
          ${ALL_HEROES.map((id) => `<button type="button" class="text-btn hero" data-id="${id}">${HEROES[id].name}</button>`).join('')}
        </div>
      </section>
    </main>`;

    const main = container.querySelector('main') as HTMLElement;
    container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
    container.querySelector<HTMLInputElement>('.unlock-all')?.addEventListener('change', (e) => {
      ctx.setSettings({ ...ctx.settings, devUnlockAll: (e.target as HTMLInputElement).checked });
      render();
    });
    container.querySelectorAll<HTMLButtonElement>('.set-level').forEach((b) =>
      b.addEventListener('click', () => {
        const level = Number(b.dataset.level);
        const heroes = Object.fromEntries(ALL_HEROES.map((id) => [id, { level, exp: 0 }]));
        // 途中のバトルは始めたときのレベルのまま続くので、そのまま残す
        ctx.setProgress({ ...ctx.progress, heroes });
        b.textContent = `全員 Lv.${level}（済）`;
      }),
    );
    container.querySelectorAll<HTMLButtonElement>('.go').forEach((b) =>
      b.addEventListener('click', () => ctx.navigate(links[Number(b.dataset.i)].route)),
    );
    container.querySelectorAll<HTMLButtonElement>('.hero').forEach((b) =>
      b.addEventListener('click', () => ctx.navigate({ name: 'heroes', heroId: b.dataset.id as (typeof ALL_HEROES)[number] })),
    );
    container.querySelector('.result-win')?.addEventListener('click', () => {
      ctx.lastOutcome = sampleOutcome(ctx, true);
      ctx.navigate({ name: 'result' });
    });
    container.querySelector('.result-lose')?.addEventListener('click', () => {
      ctx.lastOutcome = sampleOutcome(ctx, false);
      ctx.navigate({ name: 'result' });
    });
    container.querySelector('.open-howto')?.addEventListener('click', () => ctx.openTutorial(main));
    container.querySelector('.open-settings')?.addEventListener('click', () => ctx.openSettings(main, { allowClear: true }));
  }

  render();
  return () => undefined;
}

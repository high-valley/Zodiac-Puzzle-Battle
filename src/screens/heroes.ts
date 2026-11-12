// 育成：キャラの一覧と、1人ずつのくわしい画面（レベル・経験値・強さ・技）。仕様書 11.8・12.4
// M4 の育成はレベルだけ。レベルはバトルの経験値で上がる（素材や通貨で上げる仕組みは課金を入れる段階で決める）
import type { AppContext } from '../app';
import { constellationSvg } from '../components/constellations';
import { assetUrl } from '../components/assets';
import { ROLE_SHORT, heroCardInner, joinText, lockedCardInner } from '../components/heroCard';
import { mountHeroSort } from '../components/heroSort';
import { specialOrbsHtml } from '../components/specialPreview';
import { MAX_LEVEL, expToNext } from '../data/growth';
import { HERO_ART } from '../data/heroArt';
import { ALL_HEROES, HEROES, STAT_TYPE_LABEL, TRAIT_LABEL, HERO_CALL_NAME, heroFullName, heroNameHtml } from '../data/heroes';
import { heroStats, statText } from '../game/party';
import { SHAPE_LABEL } from '../game/specials';
import type { HeroId } from '../game/types';
import { heroGrowth } from '../storage/progress';

/** 必殺の形の作りやすさ（仕様書 12.3） */
const DIFFICULTY_TEXT = { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' } as const;

export function mountHeroes(container: HTMLElement, ctx: AppContext, heroId?: HeroId): () => void {
  const party = ctx.party();
  // 前後の切り替えは仲間の中だけで
  const joined = ALL_HEROES.filter((id) => ctx.heroJoined(id));
  if (!heroId) {
    container.innerHTML = `
    <main class="heroes-screen">
      <header class="bar-top">
        <button type="button" class="text-btn back">‹ ホーム</button>
        <h1 class="screen-title">育成</h1>
      </header>
      <p class="screen-lead">バトルに出撃すると経験値が入り、レベルが上がります。</p>
      <div class="sort-host"></div>
      <div class="roster" role="list">
        ${ALL_HEROES.map((id) =>
          ctx.heroJoined(id)
            ? `
          <button type="button" role="listitem" class="hero-card" data-id="${id}">
            ${heroCardInner(id, heroGrowth(ctx.progress, id).level)}
            ${party.includes(id) ? '<span class="hc-badge">出撃</span>' : ''}
          </button>`
            : `
          <div role="listitem" class="hero-card locked" data-id="${id}" aria-label="${heroFullName(id)}（${joinText(id)}）">${lockedCardInner(id)}</div>`,
        ).join('')}
      </div>
    </main>`;
    container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
    mountHeroSort(
      container.querySelector('.sort-host') as HTMLElement,
      container.querySelector('.roster') as HTMLElement,
      (id) => ctx.heroJoined(id),
      (id) => heroGrowth(ctx.progress, id).level,
    );
    container.querySelectorAll<HTMLButtonElement>('button.hero-card').forEach((b) =>
      b.addEventListener('click', () => ctx.navigate({ name: 'heroes', heroId: b.dataset.id as HeroId })),
    );
    return () => undefined;
  }

  const h = HEROES[heroId];
  const g = heroGrowth(ctx.progress, heroId);
  const index = joined.indexOf(heroId);
  const prev = joined[(index + joined.length - 1) % joined.length];
  const next = joined[(index + 1) % joined.length];
  const maxed = g.level >= MAX_LEVEL;
  const need = maxed ? 0 : expToNext(g.level);
  const st = heroStats(heroId, g.level);

  container.innerHTML = `
  <main class="heroes-screen detail role-${h.role}">
    <header class="bar-top">
      <button type="button" class="text-btn back">‹ 一覧</button>
      <h1 class="screen-title">育成</h1>
    </header>
    <section class="hero-hero main-${h.special.color}">
      <div class="hero-stage">
        ${constellationSvg(heroId, '')}
        <img class="hero-full" src="${assetUrl(HERO_ART[heroId].file)}" alt="${heroFullName(heroId)}の立ち絵" draggable="false" />
      </div>
      <div class="hero-title">
        <span class="hero-badge" aria-hidden="true">${h.symbol}</span>
        <h2>${heroNameHtml(heroId)}</h2>
        <p class="hero-latin">${h.latin}</p>
        <p class="hero-role-text"><span class="hero-main-orb orb-${h.special.color}" aria-hidden="true"></span>${ROLE_SHORT[h.role]}・${STAT_TYPE_LABEL[h.statType]}</p>
        <dl class="hero-stats">
          <div><dt>HP</dt><dd>${st.hp}</dd></div>
          <div><dt>${h.role === 'healer' ? '回復力' : '攻撃力'}</dt><dd>${statText(st.power)}</dd></div>
          <div><dt>防御力</dt><dd>${st.defense}</dd></div>
          <div><dt>必殺の威力</dt><dd>${st.special}</dd></div>
        </dl>
      </div>
    </section>
    <p class="hero-desc">${h.description}</p>

    <section class="panel" aria-labelledby="lv-title">
      <h3 id="lv-title" class="panel-title">レベル</h3>
      <div class="lv-row">
        <span class="lv-now">Lv.<b>${g.level}</b><small> / ${MAX_LEVEL}</small></span>
        <span class="lv-next">${maxed ? '最大レベル' : `次のレベルまで ${need - g.exp}`}</span>
      </div>
      <div class="bar exp-bar" role="meter" aria-label="経験値" aria-valuemin="0" aria-valuemax="${maxed ? 1 : need}" aria-valuenow="${maxed ? 1 : g.exp}">
        <span class="fill" style="--ratio:${maxed ? 1 : g.exp / need}"></span>
      </div>
    </section>


    ${
      h.trait
        ? `<section class="panel" aria-labelledby="trait-title">
      <h3 id="trait-title" class="panel-title">特性</h3>
      <p class="sp-name">${TRAIT_LABEL[h.trait].name}</p>
      <p class="sp-text">${TRAIT_LABEL[h.trait].text}</p>
    </section>`
        : ''
    }

    <section class="panel special-panel" aria-labelledby="sp-title">
      <h3 id="sp-title" class="panel-title">必殺技</h3>
      <div class="sp-row">
        <div class="sp-shape">${specialOrbsHtml(heroId)}</div>
        <div>
          <p class="sp-name">${h.special.name}</p>
          <p class="sp-text">${SHAPE_LABEL[h.special.shape]}（左の形）を盤面につくる。向きは自由</p>
          <p class="sp-power">${h.role === 'healer' ? '回復' : 'ダメージ'} ${st.special}　形の作りやすさ：${DIFFICULTY_TEXT[h.special.difficulty]}</p>
        </div>
      </div>
    </section>

    <nav class="hero-nav" aria-label="ほかのキャラ">
      <button type="button" class="text-btn prev">‹ ${HERO_CALL_NAME[prev]}</button>
      <button type="button" class="text-btn next">${HERO_CALL_NAME[next]} ›</button>
    </nav>
  </main>`;

  container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'heroes' }));
  container.querySelector('.prev')?.addEventListener('click', () => ctx.navigate({ name: 'heroes', heroId: prev }, { replace: true }));
  container.querySelector('.next')?.addEventListener('click', () => ctx.navigate({ name: 'heroes', heroId: next }, { replace: true }));
  return () => undefined;
}

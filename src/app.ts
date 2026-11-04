// アプリの入れ物：画面の切り替え（URL の # で決める）と、画面をまたいで使うもの（音・設定・進行）
import { createSoundPlayer, type SoundPlayer } from './audio/sound';
import { closeModal } from './components/modal';
import { openSettingsDialog } from './components/settingsDialog';
import { openTutorial } from './components/tutorial';
import { findStage } from './data/stages';
import { mountBattle, type BattleOutcome } from './screens/battle';
import { mountHome } from './screens/home';
import { mountQuest } from './screens/quest';
import { mountResult } from './screens/result';
import { mountStory } from './screens/story';
import { activeParty, clearAllData, isHeroJoined, isUnlocked, loadProgress, saveProgress, type Progress } from './storage/progress';
import { DEV_TOOLS } from './data/devTools';
import { CURRENT_BUILD, buildLabel, fetchLatestBuild, reloadToLatest } from './version';
import type { HeroId } from './game/types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './storage/settings';
import { hashToRoute, routeToHash, tabOf, type Route, type Tab } from './routes';
import { tabBarHtml } from './components/tabBar';
import { openModal } from './components/modal';
import { mountBook } from './screens/book';
import { mountHeroes } from './screens/heroes';
import { mountParty } from './screens/party';
import { featureShortName, mountComingSoon } from './screens/comingSoon';
import { FEATURE_IDS } from './routes';

export type { Route };

export interface AppContext {
  root: HTMLElement;
  sound: SoundPlayer;
  settings: Settings;
  progress: Progress;
  /** 直前のバトルの結果（リザルト画面用。再読み込みすると消える） */
  lastOutcome: BattleOutcome | null;
  setSettings(next: Settings): void;
  setProgress(next: Progress): void;
  navigate(route: Route, options?: { replace?: boolean }): void;
  openSettings(background: HTMLElement, options?: { allowClear?: boolean }): void;
  openTutorial(background: HTMLElement): void;
  /** 仲間になっているか（開発者モードでは全員） */
  heroJoined(id: HeroId): boolean;
  /** 遊べるステージか（開発者モードでは全部） */
  stageOpen(stageId: string): boolean;
  /** 出撃する仲間（まだ仲間でないキャラがいれば最初の編成） */
  party(): HeroId[];
  /** 途中のバトルを続けられるか（ステージが開いていて、出撃した仲間がみな仲間） */
  canResume(): boolean;
}

export function mountApp(root: HTMLElement): void {
  const settings = loadSettings();
  let cleanup: (() => void) | null = null;

  const ctx: AppContext = {
    root,
    sound: createSoundPlayer(settings.soundOn),
    settings,
    progress: loadProgress(),
    lastOutcome: null,
    setSettings(next) {
      const leavingDev = ctx.settings.devUnlockAll && !next.devUnlockAll;
      ctx.settings = next;
      // 開発者モードを切ったら、そのモードで組んだ編成や始めた途中バトルのうち、ふつうでは使えないものを片づける
      if (leavingDev) tidyAfterDev();
      ctx.sound.setEnabled(next.soundOn);
      saveSettings(next);
      document.documentElement.dataset.speed = String(next.speed);
      document.documentElement.toggleAttribute('data-dev', next.devUnlockAll);
      window.dispatchEvent(new Event('zodiac:settings'));
    },
    setProgress(next) {
      ctx.progress = next;
      saveProgress(next);
    },
    navigate(route, options) {
      const hash = routeToHash(route);
      if (location.hash === hash) {
        render();
        return;
      }
      if (options?.replace) history.replaceState(null, '', hash);
      else history.pushState(null, '', hash);
      render();
    },
    openSettings(background, options) {
      openSettingsDialog(root, background, {
        settings: ctx.settings,
        onChange: (s) => ctx.setSettings(s),
        onShowTutorial: () => ctx.openTutorial(background),
        onClearData: options?.allowClear
          ? () => {
              clearAllData();
              ctx.progress = loadProgress();
              ctx.setSettings({ ...DEFAULT_SETTINGS, tutorialSeen: true });
              ctx.navigate({ name: 'home' }, { replace: true });
            }
          : undefined,
      });
    },
    openTutorial(background) {
      openTutorial(root, background, () => ctx.setSettings({ ...ctx.settings, tutorialSeen: true }), ctx.party());
    },
    heroJoined(id) {
      return ctx.settings.devUnlockAll || isHeroJoined(ctx.progress, id);
    },
    stageOpen(stageId) {
      return ctx.settings.devUnlockAll ? !!findStage(stageId) : isUnlocked(ctx.progress, stageId);
    },
    party() {
      return activeParty(ctx.progress, (id) => ctx.heroJoined(id));
    },
    canResume() {
      const b = ctx.progress.battle;
      return !!b && ctx.stageOpen(b.stageId) && b.state.party.every((m) => ctx.heroJoined(m.id));
    },
  };

  /** ふつうの状態（開発者モードでない）で使えない編成・途中バトルを片づける */
  function tidyAfterDev() {
    let next = ctx.progress;
    if (!next.party.every((id) => isHeroJoined(next, id))) next = { ...next, party: activeParty(next) };
    if (next.battle && !ctx.canResume()) next = { ...next, battle: null };
    if (next !== ctx.progress) ctx.setProgress(next);
  }
  if (!ctx.settings.devUnlockAll) tidyAfterDev();

  // iOS は操作の中でないと音を出せないので、操作の区切りごとに音を使えるようにする（版によって許可される操作が違う）
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) {
    root.addEventListener(type, () => ctx.sound.unlock(), { capture: true });
  }

  /** 画面を描き直すたびに増やす（読み込みを待つ画面が、別の画面に移ったあとで描かないように） */
  let renderToken = 0;

  function render() {
    renderToken++;
    closeModal();
    cleanup?.();
    cleanup = null;
    root.replaceChildren();
    const container = document.createElement('div');
    container.className = 'screen';
    root.append(container);
    let route = hashToRoute(location.hash);

    // 開いていないステージや、結果のないリザルトには入れない
    if (route.name === 'battle') {
      const stage = findStage(route.stageId);
      if (!stage || !ctx.stageOpen(stage.id)) route = { name: 'quest' };
    }
    if (route.name === 'result' && !ctx.lastOutcome) route = { name: 'quest' };
    if (route.name === 'quest' && route.stageId && !ctx.stageOpen(route.stageId)) route = { name: 'quest' };
    // まだ仲間でないキャラの詳しい画面は開かない
    if (route.name === 'heroes' && route.heroId && !ctx.heroJoined(route.heroId)) route = { name: 'heroes' };
    if (route.name === 'dev' && !DEV_TOOLS) route = { name: 'home' };
    // 会話のあとに入るバトルも、開いていないステージなら入れない
    if (route.name === 'story' && route.next.name === 'battle' && !ctx.stageOpen(route.next.stageId)) route = { name: 'quest' };
    if (routeToHash(route) !== location.hash && location.hash !== '' && location.hash !== '#/') {
      history.replaceState(null, '', routeToHash(route));
    }
    // 画面の種類（背景の絵の切り替えと、起動時の「新しい版」の帯をバトルとリザルトで出さないため）。行き先を直したあとに入れる
    document.documentElement.dataset.route = route.name;

    switch (route.name) {
      case 'home':
        cleanup = mountHome(container, ctx);
        break;
      case 'quest':
        cleanup = mountQuest(container, ctx, route.stageId);
        break;
      case 'battle':
        cleanup = mountBattle(container, ctx, route.stageId);
        break;
      case 'result':
        cleanup = mountResult(container, ctx, ctx.lastOutcome!);
        break;
      case 'party':
        cleanup = mountParty(container, ctx);
        break;
      case 'heroes':
        cleanup = mountHeroes(container, ctx, route.heroId);
        break;
      case 'book':
        cleanup = mountBook(container, ctx);
        break;
      case 'feature':
        cleanup = mountComingSoon(container, ctx, route.id);
        break;
      case 'story':
        cleanup = mountStory(container, ctx, route.sceneId, route.next);
        break;
      case 'dev': {
        // 開発者画面は必要なときだけ読む（DEV_TOOLS が false の版には入らない）
        const token = ++renderToken;
        void import('./screens/dev').then(({ mountDev }) => {
          if (token !== renderToken || !container.isConnected) return;
          cleanup = mountDev(container, ctx);
          addTabBar(container, 'menu');
        });
        break;
      }
    }

    // 下のタブバー（バトルとリザルトでは出さない）
    const tab = tabOf(route);
    if (tab) addTabBar(container, tab);
    window.scrollTo(0, 0);
  }

  function addTabBar(container: HTMLElement, tab: Tab) {
    container.classList.add('with-tabs');
    container.insertAdjacentHTML('beforeend', tabBarHtml(tab));
    container.querySelectorAll<HTMLButtonElement>('.tab-bar .tab').forEach((b) =>
      b.addEventListener('click', () => {
        const t = b.dataset.tab;
        if (t === 'menu') openMenuSheet(container.querySelector('main') ?? container);
        else if (t === 'home') ctx.navigate({ name: 'home' });
        else if (t === 'quest') ctx.navigate({ name: 'quest' });
        else if (t === 'party') ctx.navigate({ name: 'party' });
        else if (t === 'heroes') ctx.navigate({ name: 'heroes' });
      }),
    );
  }

  /** メニュー：図鑑・遊び方・設定と、準備中の画面 */
  function openMenuSheet(background: HTMLElement) {
    const modal = openModal(root, background, { className: 'sheet', labelledBy: 'menu-sheet-title' });
    if (!modal) return;
    modal.overlay.innerHTML = `
      <div class="sheet-card">
        <h2 id="menu-sheet-title">メニュー</h2>
        <button type="button" class="text-btn wide m-book">図鑑</button>
        <button type="button" class="text-btn wide m-how">遊び方</button>
        <button type="button" class="text-btn wide m-settings">設定</button>
        ${DEV_TOOLS ? '<button type="button" class="text-btn wide m-dev">開発者画面</button>' : ''}
        <p class="sheet-note">準備中</p>
        <div class="sheet-grid">
          ${FEATURE_IDS.map((id) => `<button type="button" class="text-btn m-feature" data-id="${id}">${featureShortName(id)}</button>`).join('')}
        </div>
        <section class="version-box" aria-label="アプリの版">
          <p class="v-now">今の版：${buildLabel(CURRENT_BUILD)}</p>
          <p class="v-latest" aria-live="polite">公開されている最新の版を確かめています…</p>
          <button type="button" class="text-btn wide v-update">最新の版に更新する</button>
        </section>
        <button type="button" class="primary-btn m-close">とじる</button>
      </div>`;
    // 公開されている最新の版と比べる（読み直すと最新の版が読み込まれる）
    const latestText = modal.overlay.querySelector('.v-latest') as HTMLElement;
    let latestBuild: Awaited<ReturnType<typeof fetchLatestBuild>> = null;
    void fetchLatestBuild().then((latest) => {
      latestBuild = latest;
      if (!latest) latestText.textContent = '最新の版を確かめられませんでした（通信できないときなど）';
      else if (latest.id === CURRENT_BUILD.id) latestText.textContent = 'これが最新の版です';
      else {
        latestText.textContent = `新しい版があります：${buildLabel(latest)}`;
        latestText.classList.add('newer');
      }
    });
    modal.overlay.querySelector('.v-update')?.addEventListener('click', () => reloadToLatest(latestBuild));
    modal.overlay.querySelector('.m-book')?.addEventListener('click', () => {
      modal.close();
      ctx.navigate({ name: 'book' });
    });
    modal.overlay.querySelector('.m-how')?.addEventListener('click', () => {
      modal.close();
      ctx.openTutorial(background);
    });
    modal.overlay.querySelector('.m-settings')?.addEventListener('click', () => {
      modal.close();
      ctx.openSettings(background, { allowClear: true });
    });
    modal.overlay.querySelector('.m-dev')?.addEventListener('click', () => {
      modal.close();
      ctx.navigate({ name: 'dev' });
    });
    modal.overlay.querySelectorAll<HTMLButtonElement>('.m-feature').forEach((b) =>
      b.addEventListener('click', () => {
        modal.close();
        ctx.navigate(hashToRoute(`#/${b.dataset.id}`));
      }),
    );
    modal.overlay.querySelector('.m-close')?.addEventListener('click', () => modal.close());
    (modal.overlay.querySelector('.m-close') as HTMLButtonElement).focus();
  }

  document.documentElement.dataset.speed = String(settings.speed);
  document.documentElement.toggleAttribute('data-dev', settings.devUnlockAll);
  window.addEventListener('popstate', render);
  render();

  // 起動したときに、公開されている版が新しければ、画面の上に知らせる（バトル中でも邪魔にならない小さな帯）
  void fetchLatestBuild().then((latest) => {
    if (!latest || latest.id === CURRENT_BUILD.id || CURRENT_BUILD.id === 'dev') return;
    const note = document.createElement('div');
    note.className = 'update-note';
    note.setAttribute('role', 'status');
    note.innerHTML = `<span>新しい版があります</span><button type="button" class="u-go">更新する</button><button type="button" class="u-close" aria-label="とじる">×</button>`;
    note.querySelector('.u-go')?.addEventListener('click', () => reloadToLatest(latest));
    note.querySelector('.u-close')?.addEventListener('click', () => note.remove());
    document.body.append(note);
  });
}

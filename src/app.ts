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
import { clearAllData, isUnlocked, loadProgress, saveProgress, type Progress } from './storage/progress';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './storage/settings';
import { hashToRoute, routeToHash, tabOf, type Route } from './routes';
import { tabBarHtml } from './components/tabBar';
import { openModal } from './components/modal';
import { mountBook } from './screens/book';
import { mountHeroes } from './screens/heroes';
import { mountParty } from './screens/party';

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
      ctx.settings = next;
      ctx.sound.setEnabled(next.soundOn);
      saveSettings(next);
      document.documentElement.dataset.speed = String(next.speed);
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
      openTutorial(root, background, () => ctx.setSettings({ ...ctx.settings, tutorialSeen: true }), ctx.progress.party);
    },
  };

  // iOS は操作の中でないと音を出せないので、操作の区切りごとに音を使えるようにする（版によって許可される操作が違う）
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) {
    root.addEventListener(type, () => ctx.sound.unlock(), { capture: true });
  }

  function render() {
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
      if (!stage || !isUnlocked(ctx.progress, stage.id)) route = { name: 'quest' };
    }
    if (route.name === 'result' && !ctx.lastOutcome) route = { name: 'quest' };
    if (route.name === 'quest' && route.stageId && !isUnlocked(ctx.progress, route.stageId)) route = { name: 'quest' };
    if (routeToHash(route) !== location.hash && location.hash !== '' && location.hash !== '#/') {
      history.replaceState(null, '', routeToHash(route));
    }

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
    }

    // 下のタブバー（バトルとリザルトでは出さない）
    const tab = tabOf(route);
    if (tab) {
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
    window.scrollTo(0, 0);
  }

  /** メニュー：遊び方・図鑑・設定 */
  function openMenuSheet(background: HTMLElement) {
    const modal = openModal(root, background, { className: 'sheet', labelledBy: 'menu-sheet-title' });
    if (!modal) return;
    modal.overlay.innerHTML = `
      <div class="sheet-card">
        <h2 id="menu-sheet-title">メニュー</h2>
        <button type="button" class="text-btn wide m-book">図鑑</button>
        <button type="button" class="text-btn wide m-how">遊び方</button>
        <button type="button" class="text-btn wide m-settings">設定</button>
        <button type="button" class="primary-btn m-close">とじる</button>
      </div>`;
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
    modal.overlay.querySelector('.m-close')?.addEventListener('click', () => modal.close());
    (modal.overlay.querySelector('.m-close') as HTMLButtonElement).focus();
  }

  document.documentElement.dataset.speed = String(settings.speed);
  window.addEventListener('popstate', render);
  render();
}

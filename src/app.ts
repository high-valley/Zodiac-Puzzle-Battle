// アプリの入れ物：画面の切り替え（URL の # で決める）と、画面をまたいで使うもの（音・設定・進行）
import { createSoundPlayer, type SoundPlayer } from './audio/sound';
import { openSettingsDialog } from './components/settingsDialog';
import { openTutorial } from './components/tutorial';
import { findStage } from './data/stages';
import { mountBattle, type BattleOutcome } from './screens/battle';
import { mountHome } from './screens/home';
import { mountQuest } from './screens/quest';
import { mountResult } from './screens/result';
import { clearAllData, isUnlocked, loadProgress, saveProgress, type Progress } from './storage/progress';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './storage/settings';
import { hashToRoute, routeToHash, type Route } from './routes';

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
      openTutorial(root, background, () => ctx.setSettings({ ...ctx.settings, tutorialSeen: true }));
    },
  };

  // iOS は操作の中でないと音を出せないので、操作の区切りごとに音を使えるようにする（版によって許可される操作が違う）
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) {
    root.addEventListener(type, () => ctx.sound.unlock(), { capture: true });
  }

  function render() {
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
    }
    window.scrollTo(0, 0);
  }

  document.documentElement.dataset.speed = String(settings.speed);
  window.addEventListener('popstate', render);
  render();
}

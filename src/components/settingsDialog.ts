// 設定（効果音・演出の速さ・遊び方・データの初期化）
import { openModal } from './modal';
import type { Settings } from '../storage/settings';

export interface SettingsDialogOptions {
  settings: Settings;
  /** 設定が変わったとき（保存と反映は呼び出し側） */
  onChange(settings: Settings): void;
  onShowTutorial(): void;
  /** データを消したとき（ホームからだけ。バトル中は出さない） */
  onClearData?: () => void;
}

export function openSettingsDialog(root: HTMLElement, background: HTMLElement, opts: SettingsDialogOptions): void {
  const modal = openModal(root, background, { className: 'sheet', labelledBy: 'settings-title' });
  if (!modal) return;
  const s = { ...opts.settings };
  let confirmClear = false;

  const toggle = (key: string, label: string, on: boolean, onText: string, offText: string) => `
    <div class="setting-row">
      <span id="label-${key}">${label}</span>
      <button type="button" class="seg" data-key="${key}" aria-labelledby="label-${key}" aria-pressed="${on}">
        <span class="${on ? 'on' : ''}">${onText}</span><span class="${on ? '' : 'on'}">${offText}</span>
      </button>
    </div>`;

  function render() {
    modal!.overlay.innerHTML = `
      <div class="sheet-card">
        <h2 id="settings-title">設定</h2>
        ${toggle('soundOn', '効果音', s.soundOn, 'オン', 'オフ')}
        ${toggle('speed', '演出の速さ', s.speed === 1, 'ふつう', 'はやい')}
        <button type="button" class="text-btn wide show-tutorial">遊び方を見る</button>
        ${
          opts.onClearData
            ? `<button type="button" class="text-btn wide danger clear-data">${
                confirmClear ? 'もう一度押すと、クリアの記録と設定をすべて消します' : 'データを消す'
              }</button>`
            : ''
        }
        <button type="button" class="primary-btn close">とじる</button>
      </div>`;
    const overlay = modal!.overlay;
    overlay.querySelectorAll<HTMLButtonElement>('.seg').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        if (key === 'soundOn') s.soundOn = !s.soundOn;
        if (key === 'speed') s.speed = s.speed === 1 ? 2 : 1;
        opts.onChange({ ...s });
        render();
        (overlay.querySelector(`.seg[data-key="${key}"]`) as HTMLElement | null)?.focus();
      }),
    );
    overlay.querySelector('.show-tutorial')?.addEventListener('click', () => {
      modal!.close();
      opts.onShowTutorial();
    });
    overlay.querySelector('.clear-data')?.addEventListener('click', () => {
      if (!confirmClear) {
        confirmClear = true;
        render();
        (overlay.querySelector('.clear-data') as HTMLElement | null)?.focus();
        return;
      }
      modal!.close();
      opts.onClearData?.();
    });
    overlay.querySelector('.close')?.addEventListener('click', () => modal!.close());
  }
  render();
  (modal.overlay.querySelector('.close') as HTMLButtonElement).focus();
}

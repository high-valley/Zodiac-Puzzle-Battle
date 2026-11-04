// 回す動きの速さを試すつまみ（開発者画面とバトルの一時停止メニュー。仕様書 11.16）。
// ここで決めた値をユーザーが伝え、設定データ（data/balance の DEFAULT_ROTATE_TUNING）に入れる
import type { AppContext } from '../app';
import { DEFAULT_ROTATE_TUNING, ROTATE_TUNING_RANGE, type RotateTuning } from '../data/balance';
import { rotateTuningOf } from '../storage/settings';

const ITEMS: { key: keyof RotateTuning; label: string; note: string }[] = [
  { key: 'buttonMs', label: '回転ボタンで回す時間', note: '「左回転」「右回転」ボタン' },
  { key: 'releaseMinMs', label: '指を離したあと（速く払ったとき）', note: '指で回して離してから、回しきるまで' },
  { key: 'releaseMaxMs', label: '指を離したあと（ゆっくり離したとき）', note: '速く払ったときより短くはならない' },
];

const show = (_key: keyof RotateTuning, v: number) => `${(v / 1000).toFixed(2)}秒`;

/** 伝えてもらうときの1行 */
export function rotateTuningSummary(t: RotateTuning): string {
  return `ボタン ${show('buttonMs', t.buttonMs)}／離したあと ${show('releaseMinMs', t.releaseMinMs)}〜${show('releaseMaxMs', Math.max(t.releaseMinMs, t.releaseMaxMs))}`;
}

export function rotateTuningHtml(t: RotateTuning): string {
  return `
    <div class="tune">
      ${ITEMS.map(({ key, label, note }) => {
        const r = ROTATE_TUNING_RANGE[key];
        return `
        <label class="tune-row">
          <span class="tune-head"><span class="tune-label">${label}</span><output class="tune-v" data-for="${key}">${show(key, t[key])}</output></span>
          <input type="range" data-key="${key}" min="${r.min}" max="${r.max}" step="${r.step}" value="${t[key]}" />
          <span class="tune-note">${note}</span>
        </label>`;
      }).join('')}
      <p class="tune-summary">伝える値：<b>${rotateTuningSummary(t)}</b></p>
      <p class="tune-note">演出の速さを「×2」にしているときは、時間が半分になります。</p>
      <button type="button" class="text-btn wide tune-reset">初期値に戻す</button>
    </div>`;
}

/** つまみを動かすたびに保存する（すぐバトルで試せるように） */
export function bindRotateTuning(root: HTMLElement, ctx: AppContext): void {
  const refreshSummary = () => {
    const s = root.querySelector('.tune-summary b');
    if (s) s.textContent = rotateTuningSummary(rotateTuningOf(ctx.settings));
  };
  root.querySelectorAll<HTMLInputElement>('.tune input[type=range]').forEach((input) =>
    input.addEventListener('input', () => {
      const key = input.dataset.key as keyof RotateTuning;
      const next = { ...rotateTuningOf(ctx.settings), [key]: Number(input.value) };
      ctx.setSettings({ ...ctx.settings, devRotate: next });
      const out = root.querySelector(`.tune-v[data-for="${key}"]`);
      if (out) out.textContent = show(key, next[key]);
      refreshSummary();
    }),
  );
  root.querySelector('.tune-reset')?.addEventListener('click', () => {
    ctx.setSettings({ ...ctx.settings, devRotate: null });
    root.querySelectorAll<HTMLInputElement>('.tune input[type=range]').forEach((input) => {
      const key = input.dataset.key as keyof RotateTuning;
      input.value = String(DEFAULT_ROTATE_TUNING[key]);
      const out = root.querySelector(`.tune-v[data-for="${key}"]`);
      if (out) out.textContent = show(key, DEFAULT_ROTATE_TUNING[key]);
    });
    refreshSummary();
  });
}

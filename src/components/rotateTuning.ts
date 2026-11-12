// 回す動きの速さを試すつまみ（開発者画面とバトルの一時停止メニュー。仕様書 11.16）。
// ここで決めた値をユーザーが伝え、設定データ（data/balance の DEFAULT_ROTATE_TUNING）に入れる
import type { AppContext } from '../app';
import { DEFAULT_ROTATE_TUNING, ROTATE_TUNING_RANGE, type RotateTuning } from '../data/balance';
import { rotateTuningOf, type RotateMode } from '../storage/settings';

const ITEMS: { key: keyof RotateTuning; label: string; note: string }[] = [
  { key: 'releaseMinMs', label: '指を離したあと（速く払ったとき）', note: '指で回して離してから、回しきるまで' },
  { key: 'releaseMaxMs', label: '指を離したあと（ゆっくり離したとき）', note: '速く払ったときより短くはならない' },
];

const show = (_key: keyof RotateTuning, v: number) => `${(v / 1000).toFixed(2)}秒`;

/** 伝えてもらうときの1行 */
export function rotateTuningSummary(t: RotateTuning, mode: RotateMode = 'grab'): string {
  return `${mode === 'tap' ? 'タップで選ぶ方式' : '今の方式'}／離したあと ${show('releaseMinMs', t.releaseMinMs)}〜${show('releaseMaxMs', Math.max(t.releaseMinMs, t.releaseMaxMs))}`;
}

const MODES: { value: RotateMode; label: string; note: string }[] = [
  { value: 'grab', label: '今の方式', note: '押した所で 2×2 を選び、そのまま指で回す' },
  { value: 'tap', label: 'タップで選ぶ方式', note: 'オーブの角寄りをタップして 2×2 を選ぶ（選んだ外は暗くなる）。なぞると、どこをなぞっても選んだ 2×2 が回る' },
];

export function rotateTuningHtml(t: RotateTuning, mode: RotateMode = 'grab'): string {
  return `
    <fieldset class="tune-mode">
      <legend class="tune-label">回し方（試し比べ）</legend>
      ${MODES.map(
        (m) => `
        <label class="tune-mode-row">
          <input type="radio" name="rotate-mode" value="${m.value}" ${m.value === mode ? 'checked' : ''} />
          <span><b>${m.label}</b><span class="tune-note">${m.note}</span></span>
        </label>`,
      ).join('')}
    </fieldset>
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
      <p class="tune-summary">伝える値：<b>${rotateTuningSummary(t, mode)}</b></p>
      <p class="tune-note">演出の速さを「×2」にしているときは、時間が半分になります。</p>
      <button type="button" class="text-btn wide tune-reset">初期値に戻す</button>
    </div>`;
}

/** つまみを動かすたびに保存する（すぐバトルで試せるように） */
export function bindRotateTuning(root: HTMLElement, ctx: AppContext): void {
  const refreshSummary = () => {
    const s = root.querySelector('.tune-summary b');
    if (s) s.textContent = rotateTuningSummary(rotateTuningOf(ctx.settings), ctx.settings.devRotateMode);
  };
  root.querySelectorAll<HTMLInputElement>('input[name=rotate-mode]').forEach((input) =>
    input.addEventListener('change', () => {
      if (input.checked) ctx.setSettings({ ...ctx.settings, devRotateMode: input.value as RotateMode });
      refreshSummary();
    }),
  );
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

// 遊び方（初回だけ自動で開き、「?」でいつでも開ける）。タブ：基本操作／必殺技／バトルの基本
import { DEFAULT_PARTY, HEROES } from '../data/heroes';
import { STAR3_HP_RATIO } from '../data/stages';
import type { HeroId, OrbColor } from '../game/types';
import { ORB_GLYPH } from './board';
import { openModal } from './modal';
import { specialPreviewSvg } from './specialPreview';

const orb = (color: OrbColor, extra = '') => `<span class="t-orb orb-${color} ${extra}">${ORB_GLYPH[color]}</span>`;

type Tab = 'basic' | 'special' | 'battle';

interface Step {
  tab: Tab;
  title: string;
  body: string;
  /** 図。関数なら今の編成の3人から作る */
  figure: string | ((party: readonly HeroId[]) => string);
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: '基本操作' },
  { id: 'special', label: '必殺技' },
  { id: 'battle', label: 'バトルの基本' },
];

const STEPS: Step[] = [
  {
    tab: 'basic',
    title: '3回まで回して「攻撃」',
    body: '2×2 の4個のうち1個を押して、動かしたい向きに指をすべらせると、押したオーブがその向きに動くように4個が回ります（交点の星のちょうど上を押したときは、右か下へで時計回り。「左回転」「右回転」ボタンでも回せます）。1ターンに3回まで回せて、回している間は何も消えません。「攻撃」を押すとターンが決まります。',
    figure: `
      <div class="t-rotate" aria-hidden="true">
        <div class="t-grid">
          ${orb('red', 'a')}${orb('blue', 'b')}${orb('pink', 'd')}${orb('green', 'c')}
          <span class="t-star"></span>
        </div>
        <span class="t-finger">→ ↓</span>
      </div>`,
  },
  {
    tab: 'basic',
    title: '3個そろえて行動',
    body: '「攻撃」を押したとき、同じ色が縦か横に3個以上並んでいると消えて、選んでいるキャラが行動します（斜めは消えません）。消える所は白い輪で光ります。攻撃キャラは赤・青・緑で攻撃、回復役はピンクで回復します（編成によって3人の色の得意は違います）。落ちてきたオーブでまたそろうと連鎖です。',
    figure: `
      <div class="t-row" aria-hidden="true">
        ${orb('blue', 'pop')}${orb('blue', 'pop')}${orb('blue', 'pop')}${orb('green')}
      </div>`,
  },
  {
    tab: 'special',
    title: '形をつくって必殺技',
    body: 'キャラごとに決まった色と形が、「攻撃」を押したときの盤面にあると、そのとき選んでいるキャラの必殺技が出ます（形ができると金の輪で光ります）。3回まで回せるので、途中で3個並んでも崩れずに形を組み立てられます。選んでいるキャラの形は、回転ボタンの間に出ています。',
    figure: (party) => `
      <div class="t-specials" aria-hidden="true">
        ${party.map((id) => `<div class="t-special">${specialPreviewSvg(id)}<span>${HEROES[id].name}</span></div>`).join('')}
      </div>`,
  },
  {
    tab: 'battle',
    title: 'HPは3人で1本',
    body: '3回まで回して「攻撃」で1ターン。ターンの終わりに敵が攻撃してきます。パーティーのHPは3人で1本です。毎ターン行動するキャラを1人選び、敵のHPを0にすれば勝ちです。',
    figure: `
      <div class="t-hp" aria-hidden="true">
        <div class="bar party-bar"><span class="fill" style="--ratio:.7"></span></div>
        <div class="bar enemy-bar"><span class="fill" style="--ratio:.35"></span></div>
      </div>`,
  },
  {
    tab: 'battle',
    title: '強攻撃と★',
    body: `強い敵は、何ターンかごとに強攻撃をしてきます。敵の名前の下に「強攻撃まで あと○ターン」と出るので、回復役がいれば、その前に回復しておきましょう。勝つと★1、目標ターン以内なら★2、さらにHPを${Math.round(STAR3_HP_RATIO * 100)}%以上残せば★3です。`,
    figure: `
      <div class="t-stars" aria-hidden="true">
        <span class="t-charge">強攻撃まで あと<b>1</b>ターン</span>
        <span class="t-star-row"><span class="on">★</span><span class="on">★</span><span>★</span></span>
      </div>`,
  },
];

/** 遊び方を開く。すでに何か開いていれば何もしない */
export function openTutorial(
  root: HTMLElement,
  background: HTMLElement,
  onClose: () => void,
  party: readonly HeroId[] = DEFAULT_PARTY.map((m) => m.id),
): void {
  const modal = openModal(root, background, {
    className: 'tutorial',
    labelledBy: 'tutorial-title',
    describedBy: 'tutorial-body',
    onClose,
  });
  if (!modal) return;
  const overlay = modal.overlay;
  let index = 0;

  function render() {
    const step = STEPS[index];
    const last = index === STEPS.length - 1;
    overlay.innerHTML = `
      <div class="tutorial-card">
        <div class="tutorial-tabs" role="tablist" aria-label="遊び方の項目">
          ${TABS.map(
            (t) =>
              `<button type="button" role="tab" class="tutorial-tab" data-tab="${t.id}" aria-selected="${t.id === step.tab}">${t.label}</button>`,
          ).join('')}
        </div>
        <div class="tutorial-figure">${typeof step.figure === 'function' ? step.figure(party) : step.figure}</div>
        <h2 id="tutorial-title">${step.title}<span class="visually-hidden">（${index + 1} / ${STEPS.length}）</span></h2>
        <p id="tutorial-body" aria-live="polite">${step.body}</p>
        <div class="tutorial-dots" aria-hidden="true">
          ${STEPS.map((_, i) => `<span class="${i === index ? 'on' : ''}"></span>`).join('')}
        </div>
        <div class="tutorial-actions">
          ${index > 0 ? '<button type="button" class="text-btn back">戻る</button>' : '<button type="button" class="text-btn skip">とばす</button>'}
          <button type="button" class="primary-btn next">${last ? 'とじる' : '次へ'}</button>
        </div>
      </div>`;
    overlay.querySelector('.next')?.addEventListener('click', () => {
      if (last) modal!.close();
      else {
        index++;
        render();
      }
    });
    overlay.querySelector('.back')?.addEventListener('click', () => {
      index--;
      render();
    });
    overlay.querySelector('.skip')?.addEventListener('click', () => modal!.close());
    overlay.querySelectorAll<HTMLButtonElement>('.tutorial-tab').forEach((b) =>
      b.addEventListener('click', () => {
        index = STEPS.findIndex((s) => s.tab === b.dataset.tab);
        render();
        (overlay.querySelector(`.tutorial-tab[data-tab="${b.dataset.tab}"]`) as HTMLElement | null)?.focus();
      }),
    );
    if (!overlay.contains(document.activeElement)) (overlay.querySelector('.next') as HTMLButtonElement).focus();
  }

  render();
  (overlay.querySelector('.next') as HTMLButtonElement).focus();
}

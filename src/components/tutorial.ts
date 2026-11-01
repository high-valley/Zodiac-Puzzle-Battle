// 遊び方（初回だけ自動で開き、「遊び方」ボタンでいつでも開ける）
import { HEROES, PARTY } from '../data/heroes';
import { ORB_GLYPH } from './board';
import { specialPreviewSvg } from './specialPreview';
import type { OrbColor } from '../game/types';

const orb = (color: OrbColor, extra = '') => `<span class="t-orb orb-${color} ${extra}">${ORB_GLYPH[color]}</span>`;

interface Step {
  title: string;
  body: string;
  figure: string;
}

const STEPS: Step[] = [
  {
    title: '交点をスワイプして回す',
    body: '盤面の星（交点）を押して右へスワイプすると、まわりの4個が時計回りに回ります。左へなら反時計回り。星を押してから「左回転」「右回転」ボタンでも回せます。',
    figure: `
      <div class="t-rotate" aria-hidden="true">
        <div class="t-grid">
          ${orb('red', 'a')}${orb('blue', 'b')}${orb('pink', 'd')}${orb('green', 'c')}
          <span class="t-star"></span>
        </div>
        <span class="t-finger">→</span>
      </div>`,
  },
  {
    title: '3個そろえて行動',
    body: '同じ色が縦か横に3個以上並ぶと消えて、選んでいるキャラが行動します。おひつじ座といて座は赤・青・緑で攻撃、おとめ座はピンクで回復。落ちてきたオーブでまたそろうと連鎖です。',
    figure: `
      <div class="t-row" aria-hidden="true">
        ${orb('blue', 'pop')}${orb('blue', 'pop')}${orb('blue', 'pop')}${orb('green')}
      </div>`,
  },
  {
    title: '形をつくって必殺技',
    body: 'キャラごとに決まった色と形が、回したあとの盤面にあると、そのとき選んでいるキャラの必殺技が出ます。使ったオーブは消えます。選んでいるキャラの形は、回転ボタンの間に出ています。',
    figure: `
      <div class="t-specials" aria-hidden="true">
        ${PARTY.map(
          (id) => `<div class="t-special">${specialPreviewSvg(id)}<span>${HEROES[id].name}</span></div>`,
        ).join('')}
      </div>`,
  },
  {
    title: 'HPは3人で1本',
    body: '1回まわすと1ターン。ターンの終わりに敵が攻撃してきます。パーティーのHPは3人で1本です。毎ターン行動するキャラを1人選び、敵のHPを0にすれば勝ちです。',
    figure: `
      <div class="t-hp" aria-hidden="true">
        <div class="bar party-bar"><span class="fill" style="--ratio:.7"></span></div>
        <div class="bar enemy-bar"><span class="fill" style="--ratio:.35"></span></div>
      </div>`,
  },
];

let isOpen = false;

/**
 * 遊び方を開く。開いている間は background を inert にして、
 * キーボードでも背後の盤面やボタンを操作できないようにする。すでに開いていれば何もしない
 */
export function openTutorial(root: HTMLElement, background: HTMLElement, onClose: () => void): void {
  if (isOpen) return;
  isOpen = true;
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const overlay = document.createElement('div');
  overlay.className = 'tutorial';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tutorial-title');
  overlay.setAttribute('aria-describedby', 'tutorial-body');
  root.append(overlay);
  background.inert = true;

  let index = 0;

  function close() {
    overlay.remove();
    background.inert = false;
    isOpen = false;
    document.removeEventListener('keydown', onKey);
    previouslyFocused?.focus();
    onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    // Tab でカードのボタンの間だけを巡る
    if (e.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll<HTMLButtonElement>('button')];
      if (buttons.length === 0) return;
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : i === buttons.length - 1 ? 0 : i + 1;
      buttons[next].focus();
      e.preventDefault();
    }
  }
  document.addEventListener('keydown', onKey);

  function render() {
    const step = STEPS[index];
    const last = index === STEPS.length - 1;
    overlay.innerHTML = `
      <div class="tutorial-card">
        <div class="tutorial-figure">${step.figure}</div>
        <h2 id="tutorial-title">${step.title}<span class="visually-hidden">（${index + 1} / ${STEPS.length}）</span></h2>
        <p id="tutorial-body" aria-live="polite">${step.body}</p>
        <div class="tutorial-dots" aria-hidden="true">
          ${STEPS.map((_, i) => `<span class="${i === index ? 'on' : ''}"></span>`).join('')}
        </div>
        <div class="tutorial-actions">
          ${index > 0 ? '<button type="button" class="text-btn back">戻る</button>' : '<button type="button" class="text-btn skip">とばす</button>'}
          <button type="button" class="primary-btn next">${last ? 'バトルをはじめる' : '次へ'}</button>
        </div>
      </div>`;
    overlay.querySelector('.next')?.addEventListener('click', () => {
      if (last) close();
      else {
        index++;
        render();
      }
    });
    overlay.querySelector('.back')?.addEventListener('click', () => {
      index--;
      render();
    });
    overlay.querySelector('.skip')?.addEventListener('click', close);
    (overlay.querySelector('.next') as HTMLButtonElement).focus();
  }

  render();
}

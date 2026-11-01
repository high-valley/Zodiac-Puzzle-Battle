// バトル画面。ゲームの判定はすべて src/game に任せ、ここは表示と入力だけ
import { createBoardView } from '../components/board';
import { specialPreviewSvg } from '../components/specialPreview';
import { ENEMY } from '../data/balance';
import { HEROES, PARTY } from '../data/heroes';
import { createBattle, resolveTurn } from '../game/combat';
import type { BattleEvent, BattleState, Direction, HeroId, Pos } from '../game/types';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const ms = (n: number) => (reduceMotion.matches ? Math.min(n, 60) : n);
const wait = (n: number) => new Promise<void>((resolve) => setTimeout(resolve, n));

const ENEMY_SVG = `
<svg viewBox="0 0 120 100" aria-hidden="true">
  <defs>
    <radialGradient id="nebula" cx="50%" cy="45%" r="55%">
      <stop offset="0" stop-color="#6b4fa8"/>
      <stop offset=".6" stop-color="#2b2266"/>
      <stop offset="1" stop-color="#2b2266" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="52" rx="56" ry="46" fill="url(#nebula)"/>
  <path d="M30 70 C28 40 44 22 60 22 C76 22 92 40 90 70 C84 64 78 74 72 66 C66 76 54 76 48 66 C42 74 36 64 30 70Z" fill="#120f33"/>
  <circle cx="50" cy="46" r="4.5" fill="#ffd36e"/>
  <circle cx="70" cy="46" r="4.5" fill="#ffd36e"/>
  <circle cx="18" cy="20" r="1.4" fill="#fff"/><circle cx="104" cy="30" r="1.1" fill="#fff"/><circle cx="96" cy="84" r="1.3" fill="#fff"/>
</svg>`;

export function mountBattle(root: HTMLElement): void {
  let state: BattleState = createBattle(newSeed());
  let hero: HeroId = state.selectedHero;
  let busy = false;

  root.innerHTML = `
  <main class="battle">
    <header class="top">
      <span class="stage">ステージ 1</span>
      <span class="turn" aria-live="polite"></span>
      <button type="button" class="text-btn restart">やり直す</button>
    </header>

    <section class="enemy" aria-label="敵">
      <div class="enemy-figure">${ENEMY_SVG}</div>
      <div class="enemy-info">
        <span class="enemy-name">${ENEMY.name}</span>
        <div class="bar enemy-bar" role="meter" aria-label="敵のHP" aria-valuemin="0" aria-valuemax="${state.enemyMaxHp}">
          <span class="fill"></span>
        </div>
        <span class="bar-value enemy-hp"></span>
      </div>
      <div class="popups enemy-popups" aria-live="polite"></div>
    </section>

    <div class="board-wrap">
      <div class="banner" hidden></div>
    </div>
    <p class="hint">星（交点）を押して右へスワイプで右回転、左へで左回転</p>

    <div class="controls">
      <button type="button" class="rotate-btn ccw" aria-label="左回転（反時計回り）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7H4V3M4.6 7A8 8 0 1 1 4 12.5"/></svg>
        <span>左回転</span>
      </button>
      <div class="special">
        <div class="special-shape"></div>
        <span class="special-name"></span>
      </div>
      <button type="button" class="rotate-btn cw" aria-label="右回転（時計回り）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 7h4V3M19.4 7A8 8 0 1 0 20 12.5"/></svg>
        <span>右回転</span>
      </button>
    </div>

    <div class="heroes" role="radiogroup" aria-label="このターンに行動するキャラ">
      ${PARTY.map(
        (id) => `
        <button type="button" class="hero hero-${id}" role="radio" data-hero="${id}">
          <span class="hero-symbol" aria-hidden="true">${HEROES[id].symbol}</span>
          <span class="hero-name">${HEROES[id].name}</span>
          <span class="hero-role">${HEROES[id].role === 'healer' ? 'ピンクで回復' : '赤・青・緑で攻撃'}</span>
        </button>`,
      ).join('')}
    </div>

    <section class="party" aria-label="パーティー">
      <div class="party-head">
        <span>パーティーHP</span>
        <span class="bar-value party-hp"></span>
      </div>
      <div class="bar party-bar" role="meter" aria-label="パーティーのHP" aria-valuemin="0" aria-valuemax="${state.partyMaxHp}">
        <span class="fill"></span>
      </div>
      <div class="popups party-popups" aria-live="polite"></div>
    </section>

    <div class="result" hidden role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div class="result-card">
        <p id="result-title" class="result-title"></p>
        <p class="result-detail"></p>
        <button type="button" class="primary-btn again">もう一度戦う</button>
      </div>
    </div>
  </main>`;

  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const board = createBoardView((at, direction) => void playTurn(at, direction));
  $('.board-wrap').prepend(board.el);

  const banner = $<HTMLElement>('.banner');
  const result = $<HTMLElement>('.result');
  const enemyFigure = $<HTMLElement>('.enemy-figure');

  function setBar(sel: string, value: number, max: number) {
    const bar = $<HTMLElement>(sel);
    bar.setAttribute('aria-valuenow', String(value));
    (bar.querySelector('.fill') as HTMLElement).style.setProperty('--ratio', String(value / max));
    bar.classList.toggle('low', value / max <= 0.3);
  }

  function renderStatus(enemyHp = state.enemyHp, partyHp = state.partyHp) {
    $('.turn').textContent = `ターン ${state.turn}`;
    setBar('.enemy-bar', enemyHp, state.enemyMaxHp);
    $('.enemy-hp').textContent = `${enemyHp} / ${state.enemyMaxHp}`;
    setBar('.party-bar', partyHp, state.partyMaxHp);
    $('.party-hp').textContent = `${partyHp} / ${state.partyMaxHp}`;
  }

  function renderHero() {
    root.querySelectorAll<HTMLElement>('.hero').forEach((el) => {
      const on = el.dataset.hero === hero;
      el.setAttribute('aria-checked', String(on));
      el.classList.toggle('active', on);
    });
    $('.special-shape').innerHTML = specialPreviewSvg(hero);
    $('.special-name').textContent = HEROES[hero].special.name;
    root.querySelector('.battle')?.setAttribute('data-hero', hero);
  }

  function popup(sel: string, text: string, kind: 'damage' | 'heal' | 'hurt' | 'chain') {
    const layer = $<HTMLElement>(sel);
    const p = document.createElement('span');
    p.className = `popup ${kind}`;
    p.textContent = text;
    layer.append(p);
    setTimeout(() => p.remove(), ms(1100));
  }

  function setBusy(value: boolean) {
    busy = value;
    board.setLocked(value);
    // ターンの演出中は「やり直す」も止める（途中で新しい戦闘を作ると、古いターンの結果で上書きされる）
    root.querySelectorAll<HTMLButtonElement>('.rotate-btn, .hero, .restart').forEach((b) => (b.disabled = value));
  }

  async function showEvent(ev: BattleEvent, hp: { enemy: number; party: number }) {
    switch (ev.type) {
      case 'rotate':
        await board.animateRotate(ev.board, { row: ev.row, col: ev.col }, ev.direction, ms(170));
        break;
      case 'special':
        banner.textContent = ev.name;
        banner.hidden = false;
        await board.flashCells(ev.special.cells, ms(650));
        banner.hidden = true;
        break;
      case 'clear':
        if (ev.chain > 1) popup('.enemy-popups', `${ev.chain}連鎖`, 'chain');
        await board.animateClear(ev.cells, ms(200));
        await board.animateDrop(ev.board, ev.cells, ms(230));
        break;
      case 'heal':
        hp.party = ev.partyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.party-popups', `+${ev.amount}`, 'heal');
        await wait(ms(300));
        break;
      case 'damage':
        hp.enemy = ev.enemyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.enemy-popups', `${ev.amount}`, 'damage');
        enemyFigure.classList.remove('hit');
        void enemyFigure.offsetWidth;
        enemyFigure.classList.add('hit');
        await wait(ms(420));
        break;
      case 'enemyAttack':
        await wait(ms(200));
        hp.party = ev.partyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.party-popups', `−${ev.amount}`, 'hurt');
        root.querySelector('.party')?.classList.add('shake');
        await wait(ms(320));
        root.querySelector('.party')?.classList.remove('shake');
        break;
      case 'end':
        break;
    }
  }

  async function playTurn(at: Pos, direction: Direction) {
    if (busy || state.status !== 'playing') return;
    setBusy(true);
    const before = state;
    const turn = resolveTurn(state, { hero, row: at.row, col: at.col, direction });
    const hp = { enemy: before.enemyHp, party: before.partyHp };
    for (const ev of turn.events) await showEvent(ev, hp);
    state = turn.state;
    board.render(state.board);
    renderStatus();
    setBusy(false);
    if (state.status !== 'playing') showResult();
  }

  function showResult() {
    const win = state.status === 'victory';
    $('.result-title').textContent = win ? '勝利' : '敗北';
    $('.result-detail').textContent = win
      ? `${state.turn - 1}ターンで${ENEMY.name}を倒した`
      : `パーティーHPが尽きた。敵の残りHPは${state.enemyHp}`;
    result.hidden = false;
    $<HTMLButtonElement>('.again').focus();
  }

  function restart() {
    if (busy) return;
    state = createBattle(newSeed());
    hero = state.selectedHero;
    result.hidden = true;
    board.select(null);
    board.render(state.board);
    renderHero();
    renderStatus();
  }

  root.querySelectorAll<HTMLButtonElement>('.hero').forEach((b) =>
    b.addEventListener('click', () => {
      if (busy) return;
      hero = b.dataset.hero as HeroId;
      renderHero();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('.rotate-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const at = board.selected();
      if (!at) {
        board.el.classList.add('nudge');
        setTimeout(() => board.el.classList.remove('nudge'), 400);
        return;
      }
      void playTurn(at, b.classList.contains('cw') ? 'clockwise' : 'counterclockwise');
    }),
  );
  $('.restart').addEventListener('click', restart);
  $('.again').addEventListener('click', restart);

  board.render(state.board);
  renderHero();
  renderStatus();
}

/** 戦闘ごとの seed。エンジンは受け取った seed だけで決まる */
function newSeed(): number {
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}

// バトル画面。ゲームの判定はすべて src/game に任せ、ここは表示と入力だけ
import type { AppContext } from '../app';
import { cueForEvent, turnHasSpecial } from '../audio/cues';
import { createBoardView } from '../components/board';
import { enemySvg } from '../components/enemyArt';
import { openModal } from '../components/modal';
import { specialPreviewSvg } from '../components/specialPreview';
import { HEROES, PARTY } from '../data/heroes';
import { findStage, starsFor } from '../data/stages';
import { createBattle, enemyOf, resolveTurn } from '../game/combat';
import type { BattleEvent, BattleState, BattleStats, Direction, HeroId, Pos } from '../game/types';
import { recordResult } from '../storage/progress';

/** バトルが終わったときの結果（リザルト画面に渡す） */
export interface BattleOutcome {
  stageId: string;
  victory: boolean;
  turns: number;
  partyHp: number;
  partyMaxHp: number;
  enemyHp: number;
  stats: BattleStats;
  stars: number;
  newBestStars: boolean;
  newBestTurns: boolean;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = (n: number) => new Promise<void>((resolve) => setTimeout(resolve, n));

export function mountBattle(container: HTMLElement, ctx: AppContext, stageId: string): () => void {
  const stage = findStage(stageId)!;
  const saved = ctx.progress.battle;
  let state: BattleState =
    saved && saved.stageId === stageId ? saved.state : createBattle(newSeed(), stage.enemyId);
  const enemy = enemyOf(state);
  let hero: HeroId = state.selectedHero;
  let busy = false;
  let disposed = false;
  const sound = ctx.sound;
  // 演出の待ち時間。「はやい」なら半分、動きを減らす設定ならごく短く
  const ms = (n: number) => (reduceMotion.matches ? Math.min(n, 60) : n / ctx.settings.speed);

  container.innerHTML = `
  <main class="battle">
    <header class="top">
      <span class="stage">${stage.id}</span>
      <span class="turn" aria-live="polite"></span>
      <span class="top-actions">
        <button type="button" class="chip speed-toggle"></button>
        <button type="button" class="icon-btn menu" aria-label="メニュー">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
        </button>
      </span>
    </header>

    <section class="enemy" aria-label="敵">
      <div class="enemy-figure">${enemySvg(enemy.tint)}</div>
      <div class="enemy-info">
        <span class="enemy-name">${enemy.name}</span>
        <div class="bar enemy-bar" role="meter" aria-label="敵のHP" aria-valuemin="0" aria-valuemax="${state.enemyMaxHp}">
          <span class="fill"></span>
        </div>
        <span class="enemy-meta"><span class="bar-value enemy-hp"></span><span class="enemy-charge" aria-live="polite"></span></span>
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
  </main>`;

  const $ = <T extends Element>(sel: string) => container.querySelector(sel) as T;
  const board = createBoardView((at, direction) => void playTurn(at, direction));
  $('.board-wrap').prepend(board.el);

  const banner = $<HTMLElement>('.banner');
  const enemyFigure = $<HTMLElement>('.enemy-figure');
  const battleEl = $<HTMLElement>('.battle');

  function setBar(sel: string, value: number, max: number) {
    const bar = $<HTMLElement>(sel);
    bar.setAttribute('aria-valuenow', String(value));
    (bar.querySelector('.fill') as HTMLElement).style.setProperty('--ratio', String(value / max));
    bar.classList.toggle('low', value / max <= 0.3);
  }

  function renderCharge(chargeIn: number | null) {
    const el = $<HTMLElement>('.enemy-charge');
    if (!enemy.heavy || chargeIn === null) {
      el.textContent = '';
      return;
    }
    el.classList.toggle('imminent', chargeIn === 1);
    el.textContent = chargeIn === 1 ? `次のターンに強攻撃（${enemy.heavy.attack}）` : `強攻撃まで あと${chargeIn}ターン`;
  }

  function renderStatus(enemyHp = state.enemyHp, partyHp = state.partyHp) {
    $('.turn').textContent = `ターン ${state.turn}`;
    setBar('.enemy-bar', enemyHp, state.enemyMaxHp);
    $('.enemy-hp').textContent = `${enemyHp.toLocaleString('ja-JP')} / ${state.enemyMaxHp.toLocaleString('ja-JP')}`;
    setBar('.party-bar', partyHp, state.partyMaxHp);
    $('.party-hp').textContent = `${partyHp.toLocaleString('ja-JP')} / ${state.partyMaxHp.toLocaleString('ja-JP')}`;
  }

  function renderHero() {
    container.querySelectorAll<HTMLElement>('.hero').forEach((el) => {
      const on = el.dataset.hero === hero;
      el.setAttribute('aria-checked', String(on));
      el.classList.toggle('active', on);
    });
    $('.special-shape').innerHTML = specialPreviewSvg(hero);
    $('.special-name').textContent = HEROES[hero].special.name;
    battleEl.setAttribute('data-hero', hero);
  }

  function renderSettings() {
    const speed = $<HTMLButtonElement>('.speed-toggle');
    speed.textContent = ctx.settings.speed === 2 ? '×2' : '×1';
    speed.setAttribute('aria-label', ctx.settings.speed === 2 ? '演出の速さ：はやい' : '演出の速さ：ふつう');
    speed.setAttribute('aria-pressed', String(ctx.settings.speed === 2));
    battleEl.classList.toggle('no-rotate-buttons', !ctx.settings.rotateButtons);
  }

  function popup(sel: string, text: string, kind: 'damage' | 'heal' | 'hurt' | 'chain', big = false) {
    const layer = $<HTMLElement>(sel);
    const p = document.createElement('span');
    p.className = `popup ${kind}${big ? ' big' : ''}`;
    p.textContent = text;
    layer.append(p);
    setTimeout(() => p.remove(), ms(1100));
  }

  function setBusy(value: boolean) {
    busy = value;
    board.setLocked(value);
    // ターンの演出中はメニューも止める（途中でリタイアや遊び方を開くと、背後で勝敗が決まってしまう）
    container.querySelectorAll<HTMLButtonElement>('.rotate-btn, .hero, .menu').forEach((b) => (b.disabled = value));
  }

  async function showEvent(ev: BattleEvent, hp: { enemy: number; party: number }, special: boolean) {
    const cue = cueForEvent(ev, special);
    if (cue) sound.play(cue);
    switch (ev.type) {
      case 'rotate':
        await board.animateRotate(ev.board, { row: ev.row, col: ev.col }, ev.direction, ms(170));
        break;
      case 'special': {
        // 必殺演出：形を星座の線で結び、キャラ名と技名を大きく出す
        const owner = HEROES[ev.special.heroId];
        banner.innerHTML = `<span class="banner-hero">${owner.symbol} ${owner.name}</span><span class="banner-name">${ev.name}</span>`;
        banner.dataset.color = ev.special.color;
        banner.hidden = false;
        battleEl.classList.add('special-flash');
        battleEl.dataset.flash = ev.special.color;
        await board.drawConstellation(ev.special.cells, ms(1100));
        battleEl.classList.remove('special-flash');
        banner.hidden = true;
        break;
      }
      case 'clear':
        if (ev.chain > 1) popup('.enemy-popups', `${ev.chain}連鎖`, 'chain');
        await board.animateClear(ev.cells, ms(200));
        await board.animateDrop(ev.board, ev.cells, ms(230));
        break;
      case 'heal':
        hp.party = ev.partyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.party-popups', `+${ev.amount}`, 'heal', special);
        await wait(ms(special ? 500 : 300));
        break;
      case 'damage':
        hp.enemy = ev.enemyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.enemy-popups', `${ev.amount}`, 'damage', special);
        enemyFigure.classList.remove('hit');
        void enemyFigure.offsetWidth;
        enemyFigure.classList.toggle('big-hit', special);
        enemyFigure.classList.add('hit');
        await wait(ms(special ? 650 : 420));
        break;
      case 'enemyAttack':
        await wait(ms(200));
        hp.party = ev.partyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.party-popups', `−${ev.amount}`, 'hurt', ev.heavy);
        battleEl.classList.toggle('heavy-hit', ev.heavy);
        $('.party').classList.add('shake');
        await wait(ms(ev.heavy ? 520 : 320));
        $('.party').classList.remove('shake');
        battleEl.classList.remove('heavy-hit');
        break;
      case 'end':
        break;
    }
  }

  function finish() {
    const victory = state.status === 'victory';
    const turns = state.turn - 1;
    const stars = starsFor(stage, { victory, turns, partyHp: state.partyHp, partyMaxHp: state.partyMaxHp });
    const prev = ctx.progress.stages[stage.id];
    const outcome: BattleOutcome = {
      stageId: stage.id,
      victory,
      turns,
      partyHp: state.partyHp,
      partyMaxHp: state.partyMaxHp,
      enemyHp: state.enemyHp,
      stats: state.stats,
      stars,
      newBestStars: victory && stars > (prev?.stars ?? 0) && (prev?.stars ?? 0) > 0,
      newBestTurns: victory && prev?.bestTurns != null && turns < prev.bestTurns,
    };
    ctx.setProgress(recordResult(ctx.progress, stage.id, stars, victory ? turns : null));
    ctx.lastOutcome = outcome;
    ctx.navigate({ name: 'result' }, { replace: true });
  }

  async function playTurn(at: Pos, direction: Direction) {
    if (busy || disposed || state.status !== 'playing') return;
    setBusy(true);
    try {
      const turn = resolveTurn(state, { hero, row: at.row, col: at.col, direction });
      const hp = { enemy: state.enemyHp, party: state.partyHp };
      const special = turnHasSpecial(turn.events);
      // 状態は先に進めて保存しておく。演出の途中で何か失敗しても、表示は最後に state から描き直す
      state = turn.state;
      if (state.status === 'playing') ctx.setProgress({ ...ctx.progress, battle: { stageId: stage.id, state } });
      try {
        for (const ev of turn.events) {
          if (disposed) return;
          await showEvent(ev, hp, special);
        }
      } catch (e) {
        console.error('演出の途中で失敗しました', e);
      }
    } finally {
      if (!disposed) {
        board.render(state.board);
        renderStatus();
        renderCharge(state.enemyChargeIn);
        setBusy(false);
      }
    }
    if (disposed) return;
    if (state.status !== 'playing') {
      await wait(ms(500));
      if (!disposed) finish();
    }
  }

  function openMenu() {
    if (busy) return;
    const modal = openModal(ctx.root, battleEl, { className: 'sheet', labelledBy: 'menu-title' });
    if (!modal) return;
    let confirmRetire = false;
    const render = () => {
      modal.overlay.innerHTML = `
        <div class="sheet-card">
          <h2 id="menu-title">一時停止</h2>
          <p class="sheet-note">${stage.id} ${enemy.name}　ターン ${state.turn}</p>
          <button type="button" class="primary-btn resume">つづける</button>
          <button type="button" class="text-btn wide how">遊び方</button>
          <button type="button" class="text-btn wide settings">設定</button>
          <button type="button" class="text-btn wide danger retire">${confirmRetire ? 'もう一度押すとリタイア（このバトルは記録されません）' : 'リタイア'}</button>
        </div>`;
      modal.overlay.querySelector('.resume')?.addEventListener('click', () => modal.close());
      modal.overlay.querySelector('.how')?.addEventListener('click', () => {
        modal.close();
        ctx.openTutorial(battleEl);
      });
      modal.overlay.querySelector('.settings')?.addEventListener('click', () => {
        modal.close();
        ctx.openSettings(battleEl);
      });
      modal.overlay.querySelector('.retire')?.addEventListener('click', () => {
        if (!confirmRetire) {
          confirmRetire = true;
          render();
          (modal.overlay.querySelector('.retire') as HTMLElement).focus();
          return;
        }
        modal.close();
        ctx.setProgress({ ...ctx.progress, battle: null });
        ctx.navigate({ name: 'quest', stageId: stage.id });
      });
    };
    render();
    (modal.overlay.querySelector('.resume') as HTMLButtonElement).focus();
  }

  container.querySelectorAll<HTMLButtonElement>('.hero').forEach((b) =>
    b.addEventListener('click', () => {
      if (busy) return;
      hero = b.dataset.hero as HeroId;
      renderHero();
      sound.play({ name: 'select' });
    }),
  );
  container.querySelectorAll<HTMLButtonElement>('.rotate-btn').forEach((b) =>
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
  $('.menu').addEventListener('click', openMenu);
  $('.speed-toggle').addEventListener('click', () => {
    ctx.setSettings({ ...ctx.settings, speed: ctx.settings.speed === 2 ? 1 : 2 });
    renderSettings();
  });

  // 設定（回転ボタン・速さ）がメニューから変わったら反映する
  const onSettingsChanged = () => renderSettings();
  window.addEventListener('zodiac:settings', onSettingsChanged);

  board.render(state.board);
  renderHero();
  renderStatus();
  renderCharge(state.enemyChargeIn);
  renderSettings();
  if (!ctx.settings.tutorialSeen) ctx.openTutorial(battleEl);

  return () => {
    disposed = true;
    window.removeEventListener('zodiac:settings', onSettingsChanged);
  };
}

/** 戦闘ごとの seed。エンジンは受け取った seed だけで決まる */
function newSeed(): number {
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}

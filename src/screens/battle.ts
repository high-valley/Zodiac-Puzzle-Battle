// バトル画面。ゲームの判定はすべて src/game に任せ、ここは表示と入力だけ
import type { AppContext } from '../app';
import { cueForEvent, turnHasSpecial } from '../audio/cues';
import { createBoardView } from '../components/board';
import { enemySvg } from '../components/enemyArt';
import { openModal } from '../components/modal';
import { specialPreviewSvg } from '../components/specialPreview';
import { MAX_ROTATIONS_PER_TURN } from '../data/balance';
import { rotateTuningOf } from '../storage/settings';
import { bindRotateTuning, rotateTuningHtml } from '../components/rotateTuning';
import { DEV_TOOLS } from '../data/devTools';
import { HEROES } from '../data/heroes';
import { findStage, starsFor } from '../data/stages';
import { rotate2x2 } from '../game/board';
import { createBattle, enemyOf, resolveTurn } from '../game/combat';
import { findMatches, matchedMask, maskToCells } from '../game/matching';
import { detectHeroSpecial } from '../game/specials';
import type { BattleEvent, BattleState, BattleStats, Direction, HeroId, Pos, Rotation } from '../game/types';
import { applyBattleExp, heroesJoinedBy, partyMembers, recordResult, type GrowthChange } from '../storage/progress';
import { battleExp } from '../game/growth';

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
  /** 出撃した3人それぞれがもらった経験値 */
  exp: number;
  /** 3人それぞれのレベル（前と後） */
  growth: GrowthChange[];
  /** 開発者モードで遊んだので、記録・経験値・仲間を保存していない */
  notSaved?: boolean;
  /** このステージを初めてクリアして仲間になったキャラ（仕様書 12.6） */
  joined: HeroId[];
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = (n: number) => new Promise<void>((resolve) => setTimeout(resolve, n));

export function mountBattle(container: HTMLElement, ctx: AppContext, stageId: string): () => void {
  const stage = findStage(stageId)!;
  const saved = ctx.progress.battle;
  // 続けられない途中バトル（まだ仲間でないキャラがいる、など）は捨てて最初から
  const resuming = saved !== null && saved.stageId === stageId && ctx.canResume();
  let state: BattleState = resuming ? saved.state : createBattle(newSeed(), stage.enemyId, partyMembers(ctx.progress, (id) => ctx.heroJoined(id)));
  // このターンにすでに回した分（「攻撃」を押すまでは何も消えない）。途中で閉じても続きから回せるよう保存する
  let pending: Rotation[] = resuming ? [...saved.pending] : [];
  let rotating = false;
  const enemy = enemyOf(state);
  let hero: HeroId = state.selectedHero;
  let busy = false;
  let disposed = false;
  const sound = ctx.sound;
  // 演出の待ち時間。「はやい」なら半分、動きを減らす設定ならごく短く
  const ms = (n: number) => (reduceMotion.matches ? Math.min(n, 60) : n / ctx.settings.speed);
  // パズルの動き（回す・消える・落ちる）は、端末の「視差効果を減らす」に関係なく、だれでも同じ速さで見せる
  // （2026-11-03 ユーザーの決定。どう動いたかが分かることはパズルに欠かせないため）。演出 ×2 では半分
  const puzzleMs = (n: number) => n / ctx.settings.speed;

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
    <div class="turn-bar">
      <div class="rot-left">
        <span class="rot-dots" aria-hidden="true"></span>
        <span class="rot-text" aria-live="polite"></span>
      </div>
      <button type="button" class="attack-btn">攻撃</button>
    </div>

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
      ${state.party.map(
        ({ id }) => `
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
  const board = createBoardView(
    (at, direction) => void rotateOnce(at, direction),
    // 指に合わせて動かしてよいとき（攻撃の演出中・回せる回数を使い切ったときは動かさない）
    () => !busy && !disposed && state.status === 'playing' && pending.length < MAX_ROTATIONS_PER_TURN,
    () => rotateTuningOf(ctx.settings),
  );
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
    el.textContent =
      chargeIn === 1 ? `このターンの終わりに強攻撃（${enemy.heavy.attack}）` : `強攻撃まで あと${chargeIn}ターン`;
  }

  /** このターンに回した分を反映した盤面（まだ何も消えていない） */
  function previewBoard() {
    return pending.reduce((b, r) => rotate2x2(b, r.row, r.col, r.direction), state.board);
  }

  /** 「攻撃」で消える3個並びと、選んでいるキャラの必殺の形に印をつける */
  function renderMarks() {
    const b = previewBoard();
    const clear = maskToCells(matchedMask(findMatches(b)));
    const special = detectHeroSpecial(b, hero)?.cells ?? [];
    board.mark(clear, special);
  }

  function renderTurnBar() {
    const left = MAX_ROTATIONS_PER_TURN - pending.length;
    $('.rot-dots').innerHTML = [...Array(MAX_ROTATIONS_PER_TURN)]
      .map((_, i) => `<span class="${i < left ? 'on' : ''}"></span>`)
      .join('');
    $('.rot-text').textContent =
      pending.length === 0
        ? `交点を押して上下左右にスワイプ（${MAX_ROTATIONS_PER_TURN}回まで）`
        : left > 0
          ? `あと${left}回まわせる`
          : '「攻撃」で確定';
    const attack = $<HTMLButtonElement>('.attack-btn');
    // 回している最中（アニメーション中）は押せない（押しても受け付けないため）
    const canAttack = !busy && !rotating && pending.length > 0;
    attack.disabled = !canAttack;
    attack.classList.toggle('ready', canAttack);
    battleEl.classList.toggle('rotations-used', left === 0);
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
    renderTurnBar();
  }

  async function showEvent(ev: BattleEvent, hp: { enemy: number; party: number }, special: boolean) {
    // 回転は回したときにもう見せているので、ここでは何もしない
    if (ev.type === 'rotate') return;
    const cue = cueForEvent(ev, special);
    if (cue) sound.play(cue);
    switch (ev.type) {
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
        await board.animateClear(ev.cells, puzzleMs(200));
        // 補充は目で追える速さで（演出 ×2 なら半分）
        await board.animateDrop(ev.board, ev.cells, puzzleMs(380));
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

  /** 勝敗を記録する。演出より先に呼ぶ（演出の途中で再読み込みや「戻る」をしても、結果が消えたりやり直せたりしないように） */
  function recordOutcome() {
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
      exp: battleExp(stage.exp, victory),
      growth: [],
      joined: heroesJoinedBy(ctx.progress, stage.id, victory),
    };
    // 経験値：出撃した3人それぞれに入る（端末に保存。課金を入れる段階でサーバーへ移す）
    const gained = applyBattleExp(recordResult(ctx.progress, stage.id, stars, victory ? turns : null), state.party, outcome.exp);
    outcome.growth = gained.growth;
    if (ctx.settings.devUnlockAll) {
      // 開発者モードの「すべて解放」は見え方だけの切り替えなので、結果は保存しない（途中のバトルだけ消す。仕様書 11.16）
      outcome.notSaved = true;
      outcome.joined = [];
      ctx.setProgress({ ...ctx.progress, battle: null });
    } else {
      ctx.setProgress(gained.progress);
    }
    ctx.lastOutcome = outcome;
  }

  /** 今の回す動きが終わるのを待つための約束 */
  let rotationDone: Promise<void> = Promise.resolve();

  /** 1回まわす（まだ何も消えない）。回せるのは1ターンに MAX_ROTATIONS_PER_TURN 回まで */
  async function rotateOnce(at: Pos, direction: Direction) {
    // 回している途中に次の入力が来たら、今の動きをすぐ終わらせてから回す（すばやく続けて回しても取りこぼさない）
    if (rotating) {
      board.finishRotate();
      await rotationDone;
      if (rotating) return;
    }
    if (busy || rotating || disposed || state.status !== 'playing') return;
    if (pending.length >= MAX_ROTATIONS_PER_TURN) {
      const bar = $<HTMLElement>('.turn-bar');
      bar.classList.remove('nudge');
      void bar.offsetWidth;
      bar.classList.add('nudge');
      return;
    }
    rotating = true;
    let done!: () => void;
    rotationDone = new Promise<void>((resolve) => (done = resolve));
    const before = previewBoard();
    const rotation: Rotation = { row: at.row, col: at.col, direction };
    pending = [...pending, rotation];
    ctx.setProgress({ ...ctx.progress, battle: { stageId: stage.id, state, pending } });
    sound.play({ name: 'rotate' });
    renderTurnBar();
    try {
      // 回す動きは目で追える速さに（演出 ×2 なら半分）
      await board.animateRotate(rotate2x2(before, at.row, at.col, direction), at, direction, puzzleMs(rotateTuningOf(ctx.settings).buttonMs));
    } finally {
      rotating = false;
      done();
      if (!disposed) {
        board.setLocked(busy);
        renderMarks();
        renderTurnBar();
      }
    }
  }

  /** 「攻撃」：回し終えた盤面で、必殺と消去と敵の行動を進める */
  async function attack() {
    // 回している途中なら、その動きをすぐ終わらせてから攻撃する（回す動きを遅くしたので、待たせない）
    if (rotating) {
      board.finishRotate();
      await rotationDone;
    }
    if (busy || rotating || disposed || state.status !== 'playing' || pending.length === 0) return;
    const rotations = pending;
    pending = [];
    setBusy(true);
    try {
      const turn = resolveTurn(state, { hero, rotations });
      const hp = { enemy: state.enemyHp, party: state.partyHp };
      const special = turnHasSpecial(turn.events);
      // 状態は先に進めて保存しておく（勝敗が決まったら、ここで記録まで済ませる）。
      // 演出の途中で何か失敗しても、表示は最後に state から描き直す
      state = turn.state;
      if (state.status === 'playing') ctx.setProgress({ ...ctx.progress, battle: { stageId: stage.id, state, pending } });
      else recordOutcome();
      board.mark([], []);
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
        // 勝敗が決まったら操作を止めたままにする（リザルトへ移るまでにメニューを開いたりリタイアしたりできないように）
        if (state.status === 'playing') setBusy(false);
        renderTurnBar();
        renderMarks();
      }
    }
    if (disposed) return;
    if (state.status !== 'playing') {
      await wait(ms(500));
      if (!disposed) ctx.navigate({ name: 'result' }, { replace: true });
    }
  }

  function openMenu() {
    if (busy) return;
    const modal = openModal(ctx.root, battleEl, { className: 'sheet', labelledBy: 'menu-title' });
    if (!modal) return;
    let confirmRetire = false;
    let tuning = false;
    const render = () => {
      if (tuning) {
        // 開発者用：回す動きの速さを試す（つまみを動かすと保存され、「つづける」ですぐ試せる）
        modal.overlay.innerHTML = `
        <div class="sheet-card">
          <h2 id="menu-title">回す速さ（調整用）</h2>
          ${rotateTuningHtml(rotateTuningOf(ctx.settings))}
          <button type="button" class="primary-btn resume">つづけて試す</button>
          <button type="button" class="text-btn wide back">メニューに戻る</button>
        </div>`;
        bindRotateTuning(modal.overlay, ctx);
        modal.overlay.querySelector('.resume')?.addEventListener('click', () => modal.close());
        modal.overlay.querySelector('.back')?.addEventListener('click', () => {
          tuning = false;
          render();
          (modal.overlay.querySelector('.tune-open') as HTMLElement | null)?.focus();
        });
        return;
      }
      modal.overlay.innerHTML = `
        <div class="sheet-card">
          <h2 id="menu-title">一時停止</h2>
          <p class="sheet-note">${stage.id} ${enemy.name}　ターン ${state.turn}</p>
          <button type="button" class="primary-btn resume">つづける</button>
          <button type="button" class="text-btn wide how">遊び方</button>
          <button type="button" class="text-btn wide settings">設定</button>
          ${DEV_TOOLS ? '<button type="button" class="text-btn wide tune-open">回す速さ（調整用）</button>' : ''}
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
      modal.overlay.querySelector('.tune-open')?.addEventListener('click', () => {
        tuning = true;
        render();
        (modal.overlay.querySelector('.tune input') as HTMLElement | null)?.focus();
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
      // 選んだキャラも保存する（再読み込みしても、選んだキャラと金の輪がそのまま戻るように）
      if (state.status === 'playing') {
        state = { ...state, selectedHero: hero };
        ctx.setProgress({ ...ctx.progress, battle: { stageId: stage.id, state, pending } });
      }
      renderHero();
      // 回している途中は、オーブの並びが動いているので印は付けない（回し終えたときに付け直す）
      if (!rotating) renderMarks();
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
      void rotateOnce(at, b.classList.contains('cw') ? 'clockwise' : 'counterclockwise');
    }),
  );
  $('.menu').addEventListener('click', openMenu);
  $('.attack-btn').addEventListener('click', () => void attack());
  $('.speed-toggle').addEventListener('click', () => {
    ctx.setSettings({ ...ctx.settings, speed: ctx.settings.speed === 2 ? 1 : 2 });
    renderSettings();
  });

  // 設定（回転ボタン・速さ）がメニューから変わったら反映する
  const onSettingsChanged = () => renderSettings();
  window.addEventListener('zodiac:settings', onSettingsChanged);

  board.render(previewBoard());
  renderHero();
  renderStatus();
  renderCharge(state.enemyChargeIn);
  renderSettings();
  renderTurnBar();
  renderMarks();
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

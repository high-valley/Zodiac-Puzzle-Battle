// バトル画面。ゲームの判定はすべて src/game に任せ、ここは表示と入力だけ
import type { AppContext } from '../app';
import { cueForEvent, turnHasSpecial } from '../audio/cues';
import { createBoardView } from '../components/board';
import { assetUrl, BATTLE_IMAGES, preloadImages } from '../components/assets';
import { createFx } from '../components/effects';
import { affinityHtml } from '../components/heroCard';
import { enemySvg } from '../components/enemyArt';
import { isModalOpen, openModal } from '../components/modal';
import { specialOrbsHtml } from '../components/specialPreview';
import { AUTO_ATTACK_DELAY_MS, MAX_ROTATIONS_PER_TURN, damageTaken } from '../data/balance';
import { partyDefense } from '../game/party';
import { rotateTuningOf } from '../storage/settings';
import { bindRotateTuning, rotateTuningHtml } from '../components/rotateTuning';
import { DEV_TOOLS } from '../data/devTools';
import { HERO_ART } from '../data/heroArt';
import { BATTLE_INTRO, CUTIN_ART, FX_TIMING } from '../data/heroFx';
import { HEROES } from '../data/heroes';
import { findStage, starsFor } from '../data/stages';
import { rotate2x2 } from '../game/board';
import { createBattle, enemyOf, resolveTurn } from '../game/combat';
import { findMatches, matchedMask, maskToCells, junkBeside } from '../game/matching';
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
  /** このバトルで初めてクリアしたか */
  firstClear: boolean;
  newBestTurns: boolean;
  /** 出撃した仲間それぞれがもらった経験値 */
  exp: number;
  /** 出撃した仲間それぞれのレベル（前と後） */
  growth: GrowthChange[];
  /** 開発者モードで遊んだので、記録・経験値・仲間を保存していない */
  notSaved?: boolean;
  /** このステージを初めてクリアして仲間になったキャラ（仕様書 12.6） */
  joined: HeroId[];
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = (n: number) => new Promise<void>((resolve) => setTimeout(resolve, n));

/** 数値の上に添える小さな文字 */
const TAG_TEXT = { weak: '弱点', resist: '耐性', poison: '毒', rain: '恵みの雨', shield: '盾' } as const;

/** 1画面に収めるために盤面を縮めるときの、いちばん小さい幅（px。1マス約44px＝指で押せる下限）。これより低い画面ではスクロールする */
const BOARD_MIN_PX = 220;

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
  let busy = false;
  let disposed = false;
  const sound = ctx.sound;
  // 演出の待ち時間。「はやい」なら半分、動きを減らす設定ならごく短く
  const ms = (n: number) => (reduceMotion.matches ? Math.min(n, 60) : n / ctx.settings.speed);
  // パズルの動き（回す・消える・落ちる）は、端末の「視差効果を減らす」に関係なく、だれでも同じ速さで見せる
  // （2026-11-03 ユーザーの決定。どう動いたかが分かることはパズルに欠かせないため）。演出 ×2 では半分
  const puzzleMs = (n: number) => n / ctx.settings.speed;
  // 攻撃・必殺の演出も、端末の「視差効果を減らす」に関係なく見せる（だれが何をしたかが分かるように）。
  // そのかわり、画面のゆれや大きな光は「視差効果を減らす」では出さない（CSS）。演出 ×2 では半分
  const fxMs = puzzleMs;

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
        <span class="enemy-name">${enemy.name}<span class="aff-row">${affinityHtml(enemy)}</span></span>
        <div class="bar enemy-bar" role="meter" aria-label="敵のHP" aria-valuemin="0" aria-valuemax="${state.enemyMaxHp}">
          <span class="fill"></span>
        </div>
        <span class="enemy-meta"><span class="bar-value enemy-hp"></span><span class="enemy-charge" aria-live="polite"></span><span class="enemy-junk" aria-live="polite"></span></span>
      </div>
      <div class="popups enemy-popups" aria-live="polite"></div>
    </section>

    <div class="board-wrap"></div>
    <div class="turn-bar">
      <div class="rot-left">
        <span class="rot-dots" aria-hidden="true"></span>
        <span class="rot-text" aria-live="polite"></span>
      </div>
      <button type="button" class="attack-btn">攻撃</button>
    </div>

    <div class="specials" role="group" data-n="${state.party.length}" aria-label="仲間の必殺の形（盤面にこの形があると、「攻撃」で必殺技が出る）">
      ${state.party
        .map(
          ({ id }) => `
        <div class="special-item" id="special-${id}" data-hero="${id}">
          ${specialOrbsHtml(id)}
          <span class="special-label" aria-hidden="true"><span class="special-owner" aria-hidden="true">${HEROES[id].symbol}</span>${HEROES[id].special.name}</span>
        </div>`,
        )
        .join('')}
    </div>

    <div class="heroes" aria-label="仲間（全員が同時に行動する。押すと上の必殺の形が光る）">
      ${state.party.map(
        ({ id }) => `
        <button type="button" class="hero hero-${id}" data-hero="${id}" aria-describedby="special-${id}" aria-label="${HEROES[id].name}（${HEROES[id].role === 'healer' ? '回復役' : '攻撃役'}）">
          <span class="hero-symbol" aria-hidden="true">${HEROES[id].symbol}</span>
          <span class="hero-name">${HEROES[id].name}</span>
          <span class="hero-role"><span class="hero-main-orb orb-${HEROES[id].special.color}" aria-hidden="true"></span>${HEROES[id].role === 'healer' ? '回復' : '攻撃'}</span>
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
    <div class="fx-layer" aria-hidden="true"></div>
  </main>`;

  const $ = <T extends Element>(sel: string) => container.querySelector(sel) as T;
  const board = createBoardView(
    (at, direction, steps) => void rotateOnce(at, direction, steps),
    // 指で回せる回数（攻撃の演出中・回せる回数を使い切ったときは 0 で、指に合わせて動かさない）
    () => (!busy && !disposed && state.status === 'playing' ? MAX_ROTATIONS_PER_TURN - pending.length : 0),
    () => rotateTuningOf(ctx.settings),
    () => ctx.settings.rotateMode,
  );
  $('.board-wrap').prepend(board.el);
  // 回し方（設定）：タップで選ぶ方式では、選んだ 2×2 の外を暗くする
  const applyRotateMode = () => board.el.classList.toggle('tap-mode', ctx.settings.rotateMode === 'tap');
  applyRotateMode();

  const enemyFigure = $<HTMLElement>('.enemy-figure');
  const battleEl = $<HTMLElement>('.battle');
  const fx = createFx($<HTMLElement>('.fx-layer'), () => ctx.settings.speed);
  // 必殺のカットインの立ち絵を先に読み込んでおく（初めての必殺で絵が間に合わないことがないように）
  // バトル突入の画面：オーブ・背景・カットインの絵を読み込むあいだ、ステージと敵の名前を見せる（2026-11-04）。
  // 読み込み済みなら短く、まだなら最大1.5秒まで待つ。そのあと消えて操作できるようになる
  const images = [...BATTLE_IMAGES, ...state.party.flatMap(({ id }) => [HERO_ART[id].file, ...(CUTIN_ART[id]?.frames ?? [])])].map(assetUrl);
  const intro = document.createElement('div');
  intro.className = 'battle-intro';
  intro.setAttribute('role', 'status');
  intro.innerHTML = `
    <div class="intro-band">
      <span class="intro-stage">${stage.id}</span>
      <span class="intro-title">バトル開始</span>
      <span class="intro-enemy">${enemy.name}</span>
    </div>`;
  battleEl.append(intro);
  // 帯を出している間は、裏のボタンにキーボードでも届かないようにする
  const behind = [...battleEl.children].filter((el) => el !== intro) as HTMLElement[];
  for (const el of behind) el.inert = true;
  const introStart = performance.now();
  void preloadImages(images, BATTLE_INTRO.maxMs).then(async () => {
    const left = BATTLE_INTRO.minMs - (performance.now() - introStart);
    if (left > 0) await wait(left);
    if (disposed) return;
    for (const el of behind) el.inert = false;
    intro.classList.add('out');
    // 初めてのバトルなら、帯が消えてから遊び方を開く（帯の下に隠れないように）
    if (!ctx.settings.tutorialSeen) ctx.openTutorial(battleEl);
    // 3回回したところで中断していたら、続きはそのまま攻撃する（遊び方を開いたなら、閉じてから）
    autoAttackIfFull();
      await wait(BATTLE_INTRO.fadeMs);
    intro.remove();
  });

  function setBar(sel: string, value: number, max: number) {
    const bar = $<HTMLElement>(sel);
    bar.setAttribute('aria-valuenow', String(value));
    (bar.querySelector('.fill') as HTMLElement).style.setProperty('--ratio', String(value / max));
    bar.classList.toggle('low', value / max <= 0.3);
  }

  /** お邪魔の星屑をまぜるまでの予告（仕様書 12.12） */
  function renderJunk(junkIn: number | undefined) {
    const el = $<HTMLElement>('.enemy-junk');
    if (!enemy.junk || junkIn === undefined) {
      el.textContent = '';
      return;
    }
    el.classList.toggle('imminent', junkIn === 1);
    // まぜる数は盤面の星屑の上限（max）まで。「攻撃」で消えれば余裕ができるので、上限も添えて出す
    el.textContent = junkIn === 1 ? `ターンの終わりに星屑を${enemy.junk.count}個（盤面に${enemy.junk.max}個まで）` : `星屑まで あと${junkIn}ターン`;
  }

  function renderCharge(chargeIn: number | null) {
    const el = $<HTMLElement>('.enemy-charge');
    if (!enemy.heavy || chargeIn === null) {
      el.textContent = '';
      return;
    }
    el.classList.toggle('imminent', chargeIn === 1);
    el.textContent =
      chargeIn === 1 ? `このターンの終わりに強攻撃（−${damageTaken(enemy.heavy.attack, partyDefense(state.party))}）` : `強攻撃まで あと${chargeIn}ターン`;
  }

  /** このターンに回した分を反映した盤面（まだ何も消えていない） */
  function previewBoard() {
    return pending.reduce((b, r) => rotate2x2(b, r.row, r.col, r.direction), state.board);
  }

  /** 「攻撃」で消える3個並びと、仲間全員の必殺の形に印をつける */
  function renderMarks() {
    const b = previewBoard();
    const mask = matchedMask(findMatches(b));
    const special = state.party.flatMap((m) => detectHeroSpecial(b, m.id)?.cells ?? []);
    // 最初の消去で一緒に消える星屑（消えるマスと必殺の形の、上下左右）にも白い輪をつける
    const both = mask.map((line) => line.slice());
    for (const p of special) both[p.row][p.col] = true;
    const clear = [...maskToCells(mask), ...junkBeside(b, both)];
    board.mark(clear, special);
  }

  function renderTurnBar() {
    const left = MAX_ROTATIONS_PER_TURN - pending.length;
    $('.rot-dots').innerHTML = [...Array(MAX_ROTATIONS_PER_TURN)]
      .map((_, i) => `<span class="${i < left ? 'on' : ''}"></span>`)
      .join('');
    $('.rot-text').textContent =
      pending.length === 0
        ? `選んだ4個を指で回す（${MAX_ROTATIONS_PER_TURN}回まで）`
        : left > 0
          ? `あと${left}回まわせる`
          : '攻撃します';
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

  /** 仲間のカードを押したら、その仲間の必殺の形を軽く光らせる */
  function pulseSpecial(id: HeroId) {
    const item = container.querySelector<HTMLElement>(`.special-item[data-hero="${id}"]`);
    if (!item) return;
    item.classList.remove('pulse');
    void item.offsetWidth;
    item.classList.add('pulse');
  }

  /** この段で動いた仲間のカードを光らせる */
  function flashActors(ids: HeroId[]) {
    container.querySelectorAll<HTMLElement>('.hero').forEach((el) => {
      el.classList.remove('acting');
      if (ids.includes(el.dataset.hero as HeroId)) {
        void el.offsetWidth;
        el.classList.add('acting');
      }
    });
  }

  function renderSettings() {
    const speed = $<HTMLButtonElement>('.speed-toggle');
    speed.textContent = ctx.settings.speed === 2 ? '×2' : '×1';
    speed.setAttribute('aria-label', ctx.settings.speed === 2 ? '演出の速さ：はやい' : '演出の速さ：ふつう');
    speed.setAttribute('aria-pressed', String(ctx.settings.speed === 2));
  }

  /** dx は横にずらす量（px。仲間ごとの数値が重ならないように） */
  /** tag は数値の上に添える小さな文字（「弱点」「耐性」） */
  function popup(sel: string, text: string, kind: 'damage' | 'heal' | 'hurt' | 'chain', big = false, dx = 0, tag?: keyof typeof TAG_TEXT) {
    const layer = $<HTMLElement>(sel);
    const p = document.createElement('span');
    p.className = `popup ${kind}${big ? ' big' : ''}${tag ? ` ${tag}` : ''}`;
    if (tag) p.dataset.tag = TAG_TEXT[tag];
    // 中央寄せのグリッドの中では、左の余白の半分だけ中心が動くので2倍にする
    if (dx) p.style.marginLeft = `${dx * 2}px`;
    p.textContent = text;
    layer.append(p);
    // 「視差効果を減らす」でも数値は見せる（11.15.1）。演出 ×2 では半分
    setTimeout(() => p.remove(), fxMs(big ? 1400 : 1100));
  }

  function setBusy(value: boolean) {
    busy = value;
    board.setLocked(value);
    // ターンの演出中はメニューも止める（途中でリタイアや遊び方を開くと、背後で勝敗が決まってしまう）
    // 仲間のカードは必殺の形を見るだけなので止めない（行動の演出で光らせる）
    container.querySelectorAll<HTMLButtonElement>('.menu').forEach((b) => (b.disabled = value));
    renderTurnBar();
  }

  function enemyHit(big: boolean) {
    enemyFigure.classList.remove('hit');
    void enemyFigure.offsetWidth;
    enemyFigure.classList.toggle('big-hit', big);
    enemyFigure.classList.add('hit');
  }

  /**
   * 仲間1人の攻撃・回復を見せる（仕様書 11.15.1）。数値はその仲間の分。HP の欄は見せた分だけ動かし、
   * 最後に出来事の合計（heal・damage）で正しい値に合わせる
   */
  async function hitBy(id: HeroId, damage: number, heal: number, hp: { enemy: number; party: number }, isSpecial: boolean, dx = 0, hits = 1) {
    const card = $<HTMLElement>(`.hero-${id}`);
    const healer = HEROES[id].role === 'healer';
    // 的は敵の欄（数値が出る所）と、味方のHPの欄
    const target = healer ? $<HTMLElement>('.party') : $<HTMLElement>('.enemy');
    const play = isSpecial ? fx.special(id, card, target) : fx.normal(id, card, target);
    // 当たった瞬間に数値を出す（演出の半ばあたり）
    await wait(fxMs(isSpecial ? FX_TIMING.special * 0.4 : FX_TIMING.normal * 0.5));
    // 画面を離れたら、音も数値も出さない
    if (disposed) return;
    if (damage > 0) {
      hp.enemy = Math.max(0, hp.enemy - damage);
      const c = HEROES[id].special.color;
      const tag = enemy.weak === c ? 'weak' : enemy.resist === c ? 'resist' : undefined;
      if (hits > 1) {
        // 2回攻撃（ふたご座）：2つに分けて、少しずらして出す
        const first = Math.ceil(damage / 2);
        popup('.enemy-popups', `${first}`, 'damage', isSpecial, dx - 14, tag);
        setTimeout(() => {
          if (!disposed) {
            popup('.enemy-popups', `${damage - first}`, 'damage', isSpecial, dx + 14, tag);
            enemyHit(false);
          }
        }, fxMs(160));
      } else popup('.enemy-popups', `${damage}`, 'damage', isSpecial, dx, tag);
      enemyHit(isSpecial);
      sound.play({ name: 'hit', big: isSpecial });
    }
    if (heal > 0) {
      // 最大HPで頭打ちになった分は出さない
      const healed = Math.min(heal, state.partyMaxHp - hp.party);
      hp.party += healed;
      // 満タンで回復できなかったときは、数値も音も出さない（エンジンも heal の出来事を出さない）
      if (healed > 0) {
        popup('.party-popups', `+${healed}`, 'heal', isSpecial, dx);
        sound.play({ name: 'heal', big: isSpecial });
      }
    }
    renderStatus(hp.enemy, hp.party);
    await play;
  }

  /** 連鎖が終わったら、動いた仲間が編成の順に1人ずつ攻撃・回復する（仕様書 11.15.1） */
  async function membersAct(events: BattleEvent[], hp: { enemy: number; party: number }) {
    const total = new Map<HeroId, { damage: number; heal: number; hits: number }>();
    for (const ev of events) {
      if (ev.type !== 'clear') continue;
      for (const a of ev.actors) {
        const t = total.get(a.heroId) ?? { damage: 0, heal: 0, hits: 1 };
        total.set(a.heroId, { damage: t.damage + a.damage, heal: t.heal + a.heal, hits: Math.max(t.hits, a.hits ?? 1) });
      }
    }
    const jobs: Promise<void>[] = [];
    const acting = state.party.filter(({ id }) => total.has(id));
    for (const [i, { id }] of acting.entries()) {
      const t = total.get(id)!;
      if (disposed) break;
      flashActors([id]);
      // 数値は左から順に少しずつずらして出す（続けて出ても重ならないように）
      jobs.push(hitBy(id, t.damage, t.heal, hp, false, Math.round((i - (acting.length - 1) / 2) * 46), t.hits));
      // 前の仲間の演出と少し重ねて、次の仲間を始める
      await wait(fxMs(FX_TIMING.nextMember));
    }
    await Promise.all(jobs);
  }

  async function showEvent(ev: BattleEvent, hp: { enemy: number; party: number }, special: boolean) {
    // 回転は回したときにもう見せているので、ここでは何もしない
    if (ev.type === 'rotate') return;
    const cue = ev.type === 'heal' || ev.type === 'damage' ? null : cueForEvent(ev, special);
    if (cue) sound.play(cue);
    switch (ev.type) {
      case 'special': {
        // 必殺演出（仕様書 11.15.1）：盤面の形を星座の線で結ぶ → 立ち絵のカットイン → その仲間だけの技
        const id = ev.special.heroId;
        flashActors([id]);
        battleEl.classList.add('special-flash');
        battleEl.dataset.flash = ev.special.color;
        await board.drawConstellation(ev.special.cells, fxMs(FX_TIMING.constellation));
        battleEl.classList.remove('special-flash');
        if (disposed) return;
        await fx.cutIn(id);
        if (disposed) return;
        await hitBy(id, ev.damage, ev.heal, hp, true);
        break;
      }
      case 'clear':
        if (ev.chain > 1) popup('.enemy-popups', `${ev.chain}連鎖`, 'chain');
        // 自分の色が消えた仲間が動く（全員が同時に行動する）
        flashActors(ev.actors.map((a) => a.heroId));
        await board.animateClear(ev.cells, puzzleMs(200));
        // 補充は目で追える速さで（演出 ×2 なら半分）
        await board.animateDrop(ev.board, ev.cells, puzzleMs(380));
        break;
      // 数値と演出は仲間ごとに見せ終えているので、ここでは合計の値に合わせるだけ
      case 'heal':
        hp.party = ev.partyHp;
        renderStatus(hp.enemy, hp.party);
        break;
      case 'damage':
        hp.enemy = ev.enemyHp;
        renderStatus(hp.enemy, hp.party);
        await wait(ms(200));
        break;
      case 'poison':
        // 毒（さそり座）：ターンの終わりのダメージ
        hp.enemy = ev.enemyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.enemy-popups', `${ev.amount}`, 'damage', false, 0, 'poison');
        enemyHit(false);
        await wait(ms(380));
        break;
      case 'rain':
        // 恵みの雨（みずがめ座）：続く回復
        hp.party = ev.partyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.party-popups', `+${ev.amount}`, 'heal', false, 0, 'rain');
        await wait(ms(320));
        break;
      case 'enemyAttack':
        await wait(ms(200));
        hp.party = ev.partyHp;
        renderStatus(hp.enemy, hp.party);
        popup('.party-popups', `−${ev.amount}`, 'hurt', ev.heavy, 0, ev.shield ? 'shield' : undefined);
        battleEl.classList.toggle('heavy-hit', ev.heavy);
        $('.party').classList.add('shake');
        await wait(ms(ev.heavy ? 520 : 320));
        $('.party').classList.remove('shake');
        battleEl.classList.remove('heavy-hit');
        break;
      case 'junk':
        // 敵がお邪魔の星屑をまぜる（隣でそろえると一緒に消える）
        popup('.enemy-popups', '星屑', 'chain');
        await board.animateJunk(ev.board, ev.cells, puzzleMs(500));
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
      firstClear: victory && (prev?.stars ?? 0) === 0,
      newBestTurns: victory && prev?.bestTurns != null && turns < prev.bestTurns,
      exp: battleExp(stage.exp, victory),
      growth: [],
      joined: heroesJoinedBy(ctx.progress, stage.id, victory),
    };
    // 経験値：出撃した仲間それぞれに入る（端末に保存。課金を入れる段階でサーバーへ移す）
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

  /** 回す（まだ何も消えない）。steps は続けて回す回数（指で 180 度回したら 2）。回せるのは1ターンに MAX_ROTATIONS_PER_TURN 回まで */
  async function rotateOnce(at: Pos, direction: Direction, steps = 1) {
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
    const count = Math.max(1, Math.min(steps, MAX_ROTATIONS_PER_TURN - pending.length));
    // 最後の1回の手前の盤面（指で何回分も回したとき、ここから最後の1回を見せる）
    let before = previewBoard();
    for (let i = 1; i < count; i++) before = rotate2x2(before, at.row, at.col, direction);
    const rotation: Rotation = { row: at.row, col: at.col, direction };
    pending = [...pending, ...Array.from({ length: count }, () => ({ ...rotation }))];
    ctx.setProgress({ ...ctx.progress, battle: { stageId: stage.id, state, pending } });
    sound.play({ name: 'rotate' });
    renderTurnBar();
    try {
      // 回す動きは目で追える速さに（演出 ×2 なら半分）
      await board.animateRotate(rotate2x2(before, at.row, at.col, direction), at, direction, puzzleMs(rotateTuningOf(ctx.settings).buttonMs), count > 1 ? before : undefined);
    } finally {
      rotating = false;
      done();
      if (!disposed) {
        board.setLocked(busy);
        renderMarks();
        renderTurnBar();
        autoAttackIfFull();
      }
    }
  }

  /** 回せる回数を使い切ったら、「攻撃」を押さなくてもそのまま攻撃する（2026-11-04 ユーザーの要望） */
  function autoAttackIfFull() {
    if (pending.length < MAX_ROTATIONS_PER_TURN || busy || disposed || state.status !== 'playing') return;
    const turn = state.turn;
    const fire = () => {
      // 待っているあいだに自分で「攻撃」を押していたら、何もしない
      if (disposed || busy || rotating || state.turn !== turn || pending.length < MAX_ROTATIONS_PER_TURN || state.status !== 'playing') return;
      // メニュー・遊び方・設定を開いている間は攻撃しない（裏で勝敗が決まらないように）。閉じるのを待つ
      if (isModalOpen()) {
        setTimeout(fire, 300);
        return;
      }
      void attack();
    };
    setTimeout(fire, puzzleMs(AUTO_ATTACK_DELAY_MS));
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
      const turn = resolveTurn(state, { rotations });
      const hp = { enemy: state.enemyHp, party: state.partyHp };
      const special = turnHasSpecial(turn.events);
      // 状態は先に進めて保存しておく（勝敗が決まったら、ここで記録まで済ませる）。
      // 演出の途中で何か失敗しても、表示は最後に state から描き直す
      state = turn.state;
      if (state.status === 'playing') ctx.setProgress({ ...ctx.progress, battle: { stageId: stage.id, state, pending } });
      else recordOutcome();
      board.mark([], []);
      try {
        let acted = false;
        for (const ev of turn.events) {
          if (disposed) return;
          // 消去と連鎖を見せ終えたら、仲間が1人ずつ攻撃・回復する
          if (!acted && ev.type !== 'rotate' && ev.type !== 'special' && ev.type !== 'clear') {
            acted = true;
            await membersAct(turn.events, hp);
            if (disposed) return;
          }
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
        renderJunk(state.enemyJunkIn);
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
          ${rotateTuningHtml(rotateTuningOf(ctx.settings), ctx.settings.rotateMode)}
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
      // 上に並べた必殺の形のうち、その仲間の分を光らせるだけ（行動するキャラは選ばない）
      pulseSpecial(b.dataset.hero as HeroId);
      sound.play({ name: 'select' });
    }),
  );
  $('.menu').addEventListener('click', openMenu);
  $('.attack-btn').addEventListener('click', () => void attack());
  $('.speed-toggle').addEventListener('click', () => {
    ctx.setSettings({ ...ctx.settings, speed: ctx.settings.speed === 2 ? 1 : 2 });
    renderSettings();
  });

  // 設定（速さ）がメニューから変わったら反映する
  const onSettingsChanged = () => {
    renderSettings();
    applyRotateMode();
  };
  window.addEventListener('zodiac:settings', onSettingsChanged);

  board.render(previewBoard());
  renderStatus();
  renderCharge(state.enemyChargeIn);
  renderJunk(state.enemyJunkIn);
  renderSettings();
  renderTurnBar();
  renderMarks();

  // 画面の高さが足りないとき（Safari のツールバーが出ているとき、iPhone SE など）は、
  // 盤面を小さくして、スクロールせずに1画面に収める（2026-11-07）
  const wrap = $<HTMLElement>('.board-wrap');
  let fitFrame = 0;
  const fitBoard = () => {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      if (disposed) return;
      wrap.style.width = '';
      const viewH = window.visualViewport?.height ?? window.innerHeight;
      const over = document.documentElement.scrollHeight - viewH;
      if (over <= 0) return;
      const full = wrap.getBoundingClientRect().width;
      wrap.style.width = `${Math.max(BOARD_MIN_PX, Math.floor(full - over))}px`;
    });
  };
  fitBoard();
  window.addEventListener('resize', fitBoard);
  window.visualViewport?.addEventListener('resize', fitBoard);

  return () => {
    disposed = true;
    cancelAnimationFrame(fitFrame);
    window.removeEventListener('resize', fitBoard);
    window.visualViewport?.removeEventListener('resize', fitBoard);
    window.removeEventListener('zodiac:settings', onSettingsChanged);
  };
}

/** 戦闘ごとの seed。エンジンは受け取った seed だけで決まる */
function newSeed(): number {
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}

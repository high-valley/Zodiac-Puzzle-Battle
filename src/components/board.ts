// 5×5 盤面の表示と交点スワイプの入力
import { BOARD_SIZE, DEFAULT_ROTATE_TUNING, releaseDuration, ROTATE_ANIM, SWIPE, type RotateTuning } from '../data/balance';
import type { Board, Cell, Direction, OrbColor, Pos } from '../game/types';
import type { RotateMode } from '../storage/settings';
import { isRockBlocked } from '../game/board';
import { advanceDial, angleAround, isAmbiguousPress, pickByDrag, pickIntersection, pickQuadrant, releaseSteps, starAt, wrapAngle } from '../input/swipe';
import { shapeLinks } from './shapeLinks';

/** 色覚の違いでも見分けられるよう、色ごとに記号を重ねる（オーブの形は共通） */
export const ORB_GLYPH: Record<OrbColor, string> = { red: '▲', blue: '◆', green: '■', pink: '♥' };
export const ORB_LABEL: Record<OrbColor, string> = { red: '赤', blue: '青', green: '緑', pink: 'ピンク' };
/** 盤面のマスの読み上げ（お邪魔の星屑を含む。仕様書 12.12） */
const CELL_LABEL: Record<Cell, string> = { ...ORB_LABEL, junk: 'お邪魔の星屑' };

/** オーブの中の白い記号（目指す見た目 11-target-orbs：中が透ける線の三角・ひし形・四角、塗りのハート） */
const ORB_SYMBOL: Record<Cell, string> = {
  // お邪魔の星屑：くすんだ四つ角の星（どの色の記号とも形が違う）
  junk: '<path d="M12 2.8 14 10 21.2 12 14 14 12 21.2 10 14 2.8 12 10 10Z" class="fill"/>',
  red: '<path d="M12 4.2 20.6 19H3.4Z" class="line"/>',
  blue: '<path d="M12 3.2 20.8 12 12 20.8 3.2 12Z" class="line"/>',
  green: '<path d="M5 5h14v14H5Z" class="line"/>',
  pink: '<path d="M12 20.4C6 16.3 3 13 3 9.3 3 6.6 5.1 4.6 7.6 4.6c1.8 0 3.3 1 4.4 2.6 1.1-1.6 2.6-2.6 4.4-2.6 2.5 0 4.6 2 4.6 4.7 0 3.7-3 7-9 11.1Z" class="fill"/>',
};

/** ぶつかり岩の殻（仕様書 12.14）：オーブの色と記号が透けて見える、ひびの入った石の輪 */
export const ROCK_SHELL_SVG =
  '<svg class="rock-shell" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path class="rock-body" fill-rule="evenodd" d="M12 .9 17.6 2.4 21.7 6.6 23.1 12.3 21.4 17.8 17.2 21.6 11.6 23.1 6 21.5 2.3 17.4 .9 11.7 2.6 6.1 6.7 2.3ZM12 5.2A6.8 6.8 0 1 0 12 18.8 6.8 6.8 0 1 0 12 5.2Z"/>' +
  '<path class="rock-crack" d="M4 7.2 6.3 8.6M19.6 5.6 17.4 7.8 18.6 8.4M20.6 16.9 18 15.9M5.4 19 7.6 16.9 6.6 16.2M12.4 1.6 12 4.4"/>' +
  '</svg>';

export function orbSymbolSvg(color: Cell): string {
  return `<svg class="orb-symbol" viewBox="0 0 24 24" aria-hidden="true">${ORB_SYMBOL[color]}</svg>`;
}

export interface BoardView {
  el: HTMLElement;
  /** 回し方（設定）が変わったら呼ぶ：選んだ外を暗くするか、読み上げの説明 */
  applyMode(): void;
  render(board: Board): void;
  /** 選んだ交点 */
  selected(): Pos | null;
  select(pos: Pos | null): void;
  setLocked(locked: boolean): void;
  /** 回す動き */
  /** 回す動き。startBoard は、指で何回分も回したときの、最後の1回の手前の盤面（そこから最後の1回を見せる） */
  animateRotate(board: Board, at: Pos, direction: Direction, ms: number, startBoard?: Board): Promise<void>;
  /** 回している途中なら、すぐ回し終える（次の入力を待たせないため） */
  finishRotate(): void;
  animateClear(cells: Pos[], ms: number): Promise<void>;
  animateDrop(board: Board, cleared: Pos[], ms: number): Promise<void>;
  /** 「攻撃」で消えるマス（clear）と、必殺の形になっているマス（special）に印をつける */
  mark(clear: Pos[], special: Pos[]): void;
  /** 必殺の形を星座の線で結んで光らせる */
  drawConstellation(cells: Pos[], ms: number): Promise<void>;
  /** 盤面を描き直し、敵がまぜたお邪魔の星屑（cells）を現れさせる（仕様書 12.12） */
  animateJunk(board: Board, cells: Pos[], ms: number): Promise<void>;
  /** 岩で固まったマス（仕様書 12.14）。次に描き直したときにも残る。岩のある 2×2 は指で回せない */
  setRocks(rocks: readonly Pos[]): void;
  /** 敵が新しく岩で固めたマス（cells）を見せる。rocks は固めた後のすべての岩 */
  animateRocks(rocks: readonly Pos[], cells: Pos[], ms: number): Promise<void>;
  /** 割れた岩を見せる（オーブはそのまま。消えるオーブなら一緒に消える） */
  crackRocks(cells: Pos[]): void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 2×2 の4マス（左上・右上・右下・左下の順） */
function quad(at: Pos): Pos[] {
  const { row: r, col: c } = at;
  return [
    { row: r, col: c },
    { row: r, col: c + 1 },
    { row: r + 1, col: c + 1 },
    { row: r + 1, col: c },
  ];
}

/** 2×2 の中心のまわりを角度 p（1 で 90 度。1 を超えてもよい）だけ回した位置の transform。1マス＝オーブの大きさの100% */
function arcTransform(from: Pos, at: Pos, direction: Direction, p: number): string {
  const cx = at.col + 1;
  const cy = at.row + 1;
  const a0 = Math.atan2(from.row + 0.5 - cy, from.col + 0.5 - cx);
  const a = a0 + (direction === 'clockwise' ? 1 : -1) * (Math.PI / 2) * p;
  const x = cx + Math.SQRT1_2 * Math.cos(a) - 0.5;
  const y = cy + Math.SQRT1_2 * Math.sin(a) - 0.5;
  // 途中で少しだけ大きくして、持ち上げて回す感じを出す
  const lift = 1 + 0.06 * Math.abs(Math.sin(Math.PI * p));
  return `translate(${x * 100}%, ${y * 100}%) scale(${lift})`;
}

/**
 * @param onRotate 回すと決まったとき（指を離したとき）。steps は続けて回す回数（指で 180 度回したら 2）
 * @param remaining 今あと何回回せるか（0 なら指に合わせて動かさない。指で回せるのもこの回数まで）
 */
export function createBoardView(
  onRotate: (at: Pos, direction: Direction, steps: number) => void,
  remaining: () => number = () => 3,
  /** 回す動きの速さ（開発者画面で変えられるので、使うたびに読む） */
  tuning: () => RotateTuning = () => DEFAULT_ROTATE_TUNING,
  /** 回し方（設定で選ぶ。'tap'＝タップで選んで、なぞって回す。使うたびに読む） */
  mode: () => RotateMode = () => 'grab',
): BoardView {
  const el = document.createElement('div');
  el.className = 'board';
  el.setAttribute('role', 'grid');
  const ARIA = {
    grab: '盤面。2×2 の4個を押して、つまみを回すように指で円を描くと、4個がその向きに回ります',
    tap: '盤面。タップで 2×2 の4個を選び、盤のどこかで指で円を描くと、選んだ4個がその向きに回ります',
  };
  el.setAttribute('aria-label', ARIA[mode()]);

  const orbLayer = document.createElement('div');
  orbLayer.className = 'orbs';
  el.append(orbLayer);

  // 16 か所の交点を小さな星で示す
  const starLayer = document.createElement('div');
  starLayer.className = 'stars';
  const stars: HTMLElement[][] = [];
  for (let r = 0; r < BOARD_SIZE - 1; r++) {
    stars.push([]);
    for (let c = 0; c < BOARD_SIZE - 1; c++) {
      const s = document.createElement('span');
      stars[r].push(s);
      s.className = 'star';
      s.style.setProperty('--r', String(r + 1));
      s.style.setProperty('--c', String(c + 1));
      starLayer.append(s);
    }
  }
  el.append(starLayer);

  // タップで選ぶ方式：選んだ 2×2 の外を暗くする（中の .hole の外側を、大きな影で塗る。盤面の外へははみ出さない）
  const dim = document.createElement('div');
  dim.className = 'sel-dim';
  dim.setAttribute('aria-hidden', 'true');
  const hole = document.createElement('div');
  hole.className = 'sel-hole';
  dim.append(hole);
  dim.hidden = true;
  el.append(dim);

  const ring = document.createElement('div');
  ring.className = 'ring';
  ring.hidden = true;
  // 選び直したときの光は一度だけ（枠が隠れてまた出たときに、もう一度光らないように）
  ring.addEventListener('animationend', (e) => ring.classList.remove(e.animationName === 'ring-nope' ? 'nope' : 'moved'));
  el.append(ring);

  let orbs: HTMLElement[][] = [];
  /** 回している途中のアニメーション */
  let running: Animation[] = [];
  /** 元に戻している途中のアニメーション */
  let springs: Animation[] = [];
  let current: Pos | null = null;
  let locked = false;
  /** 岩で固まったマス（仕様書 12.14） */
  let rocks: Pos[] = [];
  const rockedAt = (r: number, c: number) => rocks.some((p) => p.row === r && p.col === c);
  const blocked = (at: Pos | null) => !!at && isRockBlocked(rocks, at.row, at.col);

  /** 岩の殻をつける・外す（読み上げにも添える） */
  function dressRock(o: HTMLElement, color: Cell, on: boolean) {
    o.classList.toggle('rocked', on);
    o.querySelector('.rock-shell')?.remove();
    if (on) o.insertAdjacentHTML('beforeend', ROCK_SHELL_SVG);
    o.setAttribute('aria-label', on ? `${CELL_LABEL[color]}（岩で固まっている）` : CELL_LABEL[color]);
  }

  function orbAt(p: Pos) {
    return orbs[p.row][p.col];
  }

  function render(board: Board) {
    // 指に合わせて回しかけていたら、その動きは捨てる（描き直したオーブに残さない）
    drag = null;
    release = null;
    for (const a of springs) a.cancel();
    springs = [];
    orbLayer.replaceChildren();
    orbs = board.map((row, r) =>
      row.map((color, c) => {
        const o = document.createElement('div');
        o.className = `orb orb-${color}`;
        o.style.setProperty('--r', String(r));
        o.style.setProperty('--c', String(c));
        o.setAttribute('role', 'gridcell');
        o.setAttribute('aria-label', CELL_LABEL[color]);
        o.innerHTML = orbSymbolSvg(color);
        o.dataset.cell = color;
        if (rockedAt(r, c)) dressRock(o, color, true);
        orbLayer.append(o);
        return o;
      }),
    );
  }

  function flashRing() {
    ring.classList.remove('moved');
    void ring.offsetWidth;
    ring.classList.add('moved');
  }

  function select(pos: Pos | null) {
    if (current) stars[current.row][current.col].classList.remove('on');
    current = pos;
    if (pos) stars[pos.row][pos.col].classList.add('on');
    ring.hidden = pos === null;
    dim.hidden = pos === null;
    // 岩のある 2×2 を選んだら、枠を灰色にして回せないことを見せる
    ring.classList.toggle('blocked', blocked(pos));
    if (pos) {
      ring.style.setProperty('--r', String(pos.row));
      ring.style.setProperty('--c', String(pos.col));
      hole.style.setProperty('--r', String(pos.row));
      hole.style.setProperty('--c', String(pos.col));
    }
  }

  // 指で回す：選んだ 2×2 の中心のまわりを、つまみを回すように（2026-11-04）。指の角度にぴったり付いて回る
  /** q は回した量（90度＝1、正＝時計回り）、v は角速度（90度＝1 / ms）、moved は押してから動いた最大の距離（px） */
  /** pending は、動かした向きで 2×2 を決めるのを待っているあいだの、押した位置（盤面の中の座標。決まったら null） */
  let start: {
    x: number;
    y: number;
    id: number;
    lastAngle: number | null;
    q: number;
    v: number;
    lastT: number;
    moved: number;
    pending: { x: number; y: number } | null;
    /** タップで選ぶ方式で、オーブを押したとき：動かさずに離したら、この 2×2 を選ぶ */
    tapPick: Pos | null;
    /** 岩で回せないことを、この押し方でもう見せたか */
    nope?: boolean;
  } | null = null;
  /** 指に合わせて回している途中のようす */
  let drag: { at: Pos; q: number } | null = null;
  /** 指を離して回すと決まり、その続きを animateRotate に引き継ぐもの（p は最後の1回のうち回した割合、v は指の速さ px/ms） */
  let release: { at: Pos; direction: Direction; p: number; v: number } | null = null;

  const dirOf = (q: number): Direction => (q >= 0 ? 'clockwise' : 'counterclockwise');

  function setDrag(at: Pos, q: number) {
    for (const from of quad(at)) {
      const o = orbAt(from);
      o.classList.add('dragging');
      o.style.transform = arcTransform(from, at, dirOf(q), Math.abs(q));
    }
  }

  function clearDrag(at: Pos) {
    for (const from of quad(at)) {
      const o = orbAt(from);
      o.classList.remove('dragging');
      o.style.transform = '';
    }
  }

  /** 回しきらずに離したときは、もとの位置へ戻す */
  function springBack(state: { at: Pos; q: number }) {
    if (state.q === 0 || typeof el.animate !== 'function') {
      clearDrag(state.at);
      return;
    }
    const dir = dirOf(state.q);
    const p = Math.abs(state.q);
    for (const from of quad(state.at)) {
      const o = orbAt(from);
      const anim = o.animate(
        [{ transform: arcTransform(from, state.at, dir, p) }, { transform: arcTransform(from, state.at, dir, 0) }],
        { duration: ROTATE_ANIM.springBackMs * Math.min(2, Math.max(1, p * 2)), easing: 'ease-out' },
      );
      o.style.transform = '';
      o.classList.remove('dragging');
      springs.push(anim);
      void anim.finished.catch(() => undefined);
    }
  }

  function local(e: PointerEvent) {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, cell: rect.width / BOARD_SIZE };
  }

  /** 中心から近すぎる所では角度を読まない */
  function angleOf(e: PointerEvent, at: Pos): number | null {
    const p = local(e);
    const { angle, r } = angleAround(p.x, p.y, p.cell, at);
    return r < SWIPE.centerDeadCells * p.cell ? null : angle;
  }

  el.addEventListener('pointerdown', (e) => {
    if (locked || start || !e.isPrimary || e.button !== 0) return;
    // 前の回転や、元に戻す動きが残っていれば、すぐ終わらせる
    for (const a of running) a.finish();
    for (const a of springs) a.cancel();
    springs = [];
    const p = local(e);
    const before = current;
    let pending: { x: number; y: number } | null = null;
    let tapPick: Pos | null = null;
    if (mode() === 'tap') {
      // タップで選ぶ方式：星を押したらその 2×2。オーブを押したら、動かさずに離したときに選び直す（pointerup）。
      // 動かしたら、選んである 2×2 を回す（どこをなぞっても）。まだ選んでいなければ、押した所の 2×2 を選んで回す
      const star = starAt(p.x, p.y, p.cell);
      if (star) select(star);
      else if (!current) select(pickQuadrant(p.x, p.y, p.cell));
      else tapPick = pickQuadrant(p.x, p.y, p.cell);
    } else {
      // オーブのまんなか寄りを押したときは、いったん近い交点を選んで見せ、動かした向きで決め直す（pointermove）
      pending = isAmbiguousPress(p.x, p.y, p.cell, current) ? { x: p.x, y: p.y } : null;
      select(pickIntersection(p.x, p.y, p.cell, current));
    }
    // 押している間は枠を少し強く光らせる。選び直したときは、移ったことが分かるように軽く光らせる
    ring.classList.add('pressing');
    if (before && current && (before.row !== current.row || before.col !== current.col)) flashRing();
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, lastAngle: current ? angleOf(e, current) : null, q: 0, v: 0, lastT: e.timeStamp, moved: 0, pending, tapPick };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const left = remaining();
    if (!current || locked || running.length > 0 || left <= 0 || typeof el.animate !== 'function') {
      // 回せなくなった（別の指で攻撃やボタンを押したなど）ら、回しかけを元に戻し、回した量も捨てて基準を取り直す
      // （回せるようになったとき、前の回しかけが急に付いて盤面が飛ばないように）
      if (drag) {
        clearDrag(drag.at);
        drag = null;
      }
      resetDial();
      return;
    }
    start.moved = Math.max(start.moved, Math.hypot(e.clientX - start.x, e.clientY - start.y));
    // タップで選ぶ方式：タップのぶれ（tapSlop まで）では回し始めない
    if (start.tapPick && start.moved < SWIPE.tapSlop) return;
    if (start.pending) {
      // どの 2×2 か決めにくい所を押した：少し動くまで回さず、動かした向きで 2×2 を決める（仕様書 6.2）
      const p = local(e);
      if (Math.hypot(p.x - start.pending.x, p.y - start.pending.y) < SWIPE.decideCells * p.cell) return;
      const picked = pickByDrag(start.pending.x, start.pending.y, p.x, p.y, p.cell);
      if (picked.row !== current.row || picked.col !== current.col) {
        select(picked);
        flashRing();
      }
      // 押した所からの動きを回した量にする（決めるまでに動かした分を捨てない）。
      // ただし一度に付けるのは decideMaxTurns まで（押した所が中心に近いと角度が大きくなり、盤面が飛ぶため）
      const from = angleAround(start.pending.x, start.pending.y, p.cell, picked);
      const now = angleOf(e, picked);
      if (from.r < SWIPE.centerDeadCells * p.cell || now === null) {
        start.lastAngle = null;
      } else {
        const cap = SWIPE.decideMaxTurns * (Math.PI / 2);
        const d = wrapAngle(now - from.angle);
        start.lastAngle = Math.abs(d) > cap ? now - Math.sign(d) * cap : from.angle;
      }
      start.pending = null;
    }
    // 岩のある 2×2 は回せない：回そうとしたら枠を一度だけ揺らす（仕様書 12.14）
    if (blocked(current)) {
      if (start.moved >= SWIPE.tapSlop && !start.nope) {
        start.nope = true;
        ring.classList.remove('nope');
        void ring.offsetWidth;
        ring.classList.add('nope');
      }
      resetDial();
      return;
    }
    // 中心を通りすぎるあいだは、回しかけの位置のまま止めておく。残りの回数で止める（止まった所から逆へ回せば、すぐ戻る）
    const next = advanceDial(start, angleOf(e, current), start.moved, left);
    start.lastAngle = next.lastAngle;
    const q = next.q;
    if (q === start.q) return;
    const dt = e.timeStamp - start.lastT;
    if (dt > 0) start.v = start.v * 0.5 + ((q - start.q) / dt) * 0.5;
    start.q = q;
    start.lastT = e.timeStamp;
    drag = { at: current, q };
    setDrag(current, q);
  });

  el.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    ring.classList.remove('pressing');
    const st = start;
    start = null;
    const dragged = drag;
    drag = null;
    // タップで選ぶ方式：オーブを押して、動かさずに離した（または回すほど動かさなかった）ら、その 2×2 を選ぶ
    if (st.tapPick && st.moved < SWIPE.tapSlop) {
      if (dragged) clearDrag(dragged.at);
      const pick = st.tapPick;
      if (!current || current.row !== pick.row || current.col !== pick.col) {
        select(pick);
        flashRing();
      }
      return;
    }
    if (!dragged) return;
    if (locked || !current) {
      clearDrag(dragged.at);
      return;
    }
    // 離す直前に指を止めていたら、払った速さとして扱わない
    const still = e.timeStamp - st.lastT;
    const v = still > ROTATE_ANIM.stillMs ? st.v * (ROTATE_ANIM.stillMs / still) : st.v;
    const steps = Math.max(-remaining(), Math.min(remaining(), releaseSteps(dragged.q, v, st.moved)));
    if (steps === 0) {
      springBack(dragged);
      return;
    }
    const direction = dirOf(steps);
    const k = Math.abs(steps);
    const cell = el.getBoundingClientRect().width / BOARD_SIZE;
    // 最後の1回のうち、もう回した割合から続きを回す（1 を超えていたら戻しながら止める）
    release = { at: dragged.at, direction, p: Math.abs(dragged.q) - (k - 1), v: Math.abs(v) * cell * (Math.PI / 4) * Math.SQRT2 };
    const mine = release;
    onRotate(dragged.at, direction, k);
    // 回せなかったとき（上限など）は、もとに戻す
    setTimeout(() => {
      if (release === mine) {
        release = null;
        springBack(dragged);
      }
    }, 60);
  });

  /** 回した量を捨てて、今の指の角度から数え直す */
  function resetDial() {
    if (!start) return;
    start.q = 0;
    start.v = 0;
    start.lastAngle = null;
    // 向きで決めるのを待っていた分も捨てる（回せるようになったとき、押した所からの動きが一度に付かないように）
    start.pending = null;
  }

  // 回している指の取り消しだけを扱う（ほかの指の取り消しで、回している操作を止めない）
  const cancel = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    ring.classList.remove('pressing');
    start = null;
    if (drag) springBack(drag);
    drag = null;
  };
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('lostpointercapture', cancel);

  return {
    applyMode() {
      el.classList.toggle('tap-mode', mode() === 'tap');
      el.setAttribute('aria-label', ARIA[mode()]);
    },
    el,
    render,
    selected: () => current,
    select,
    setLocked(value) {
      locked = value;
      el.classList.toggle('locked', value);
      if (value && drag) {
        clearDrag(drag.at);
        drag = null;
      }
      if (value) resetDial();
    },
    finishRotate() {
      for (const a of running) a.finish();
    },
    async animateRotate(board, at, direction, ms, startBoard) {
      const { row: r, col: c } = at;
      // 各マスの移動先。時計回り：左上→右上→右下→左下→左上
      const cw: [Pos, Pos][] = [
        [{ row: r, col: c }, { row: r, col: c + 1 }],
        [{ row: r, col: c + 1 }, { row: r + 1, col: c + 1 }],
        [{ row: r + 1, col: c + 1 }, { row: r + 1, col: c }],
        [{ row: r + 1, col: c }, { row: r, col: c }],
      ];
      const moves = direction === 'clockwise' ? cw : cw.map(([from, to]) => [to, from] as [Pos, Pos]);
      if (typeof el.animate !== 'function') {
        // 古い環境では、円を描かずにまっすぐ入れ替える
        for (const [from, to] of moves) {
          const o = orbAt(from);
          o.classList.add('moving');
          o.style.transitionDuration = `${ms}ms`;
          o.style.setProperty('--r', String(to.row));
          o.style.setProperty('--c', String(to.col));
        }
        await wait(ms);
        render(board);
        return;
      }
      el.classList.add('rotating');
      // 指で回していた続きなら、その位置から指の速さで回しきる。ボタンなら最初から（始まりと終わりはゆっくり）
      const fromDrag = release && release.at.row === r && release.at.col === c && release.direction === direction ? release : null;
      release = null;
      // 指で何回分も回したときは、最後の1回の手前の盤面にしてから、その1回を見せる（見た目はもうそこまで回っている）
      if (startBoard) render(startBoard);
      const p0 = fromDrag ? fromDrag.p : 0;
      let duration = ms;
      let easing = 'cubic-bezier(0.45, 0.05, 0.3, 1)';
      if (fromDrag) {
        const cell = el.getBoundingClientRect().width / BOARD_SIZE;
        // 残りの弧を、離したときの指の速さで回しきる。速すぎ・遅すぎは抑える（data/balance の releaseDuration）。
        // 回しすぎていたら、少し戻して止める
        duration = p0 >= 1 ? ROTATE_ANIM.springBackMs * Math.min(1, 0.3 + (p0 - 1) * 2) : releaseDuration(p0, fromDrag.v, cell, ms, tuning());
        easing = 'cubic-bezier(0.2, 0.6, 0.35, 1)';
      }
      const STEPS = 12;
      await Promise.all(
        moves.map(([from]) => {
          const o = orbAt(from);
          o.classList.remove('dragging');
          o.style.transform = '';
          o.classList.add('moving');
          const frames: Keyframe[] = [];
          for (let i = 0; i <= STEPS; i++) frames.push({ transform: arcTransform(from, at, direction, p0 + ((1 - p0) * i) / STEPS) });
          const anim = o.animate(frames, { duration, easing, fill: 'forwards' });
          running.push(anim);
          return anim.finished.catch(() => undefined);
        }),
      );
      running = [];
      el.classList.remove('rotating');
      render(board);
    },
    setRocks(list) {
      rocks = list.map((p) => ({ ...p }));
      orbs.forEach((line, r) => line.forEach((o, c) => dressRock(o, (o.dataset.cell ?? 'red') as Cell, rockedAt(r, c))));
      ring.classList.toggle('blocked', blocked(current));
    },
    async animateRocks(list, cells, ms) {
      this.setRocks(list);
      for (const p of cells) orbAt(p).classList.add('rock-in');
      await wait(ms);
      for (const p of cells) orbAt(p).classList.remove('rock-in');
    },
    crackRocks(cells) {
      for (const p of cells) {
        const o = orbAt(p);
        o.classList.remove('rocked');
        o.classList.add('rock-break');
      }
    },
    async animateJunk(next, cells, ms) {
      render(next);
      for (const p of cells) orbAt(p).classList.add('junk-in');
      await wait(ms);
      for (const p of cells) orbAt(p).classList.remove('junk-in');
    },
    async animateClear(cells, ms) {
      for (const p of cells) orbAt(p).classList.add('clearing');
      await wait(ms);
    },
    async animateDrop(board, cleared, ms) {
      render(board);
      if (typeof el.animate !== 'function') {
        // 古い環境：消えたマスより上のオーブだけ、短く上から入れる
        const lowest = new Map<number, number>();
        for (const p of cleared) lowest.set(p.col, Math.max(lowest.get(p.col) ?? -1, p.row));
        for (const [col, bottom] of lowest) {
          for (let r = 0; r <= bottom; r++) orbs[r][col].classList.add('dropping');
        }
        await wait(ms);
        return;
      }
      // 残ったオーブは元の位置から下へすべり落ち、新しいオーブは盤面の上から列ごとに少しずつずらして落ちてくる
      el.classList.add('refilling');
      const animations: Promise<unknown>[] = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        const gone = new Set(cleared.filter((p) => p.col === col).map((p) => p.row));
        if (gone.size === 0) continue;
        const k = gone.size;
        // 残ったオーブの元の行（上から順）。落ちたあとの行 k + i に入る
        const kept = [...Array(BOARD_SIZE).keys()].filter((r) => !gone.has(r));
        for (let row = 0; row < BOARD_SIZE; row++) {
          const fromRow = row < k ? row - k : kept[row - k];
          if (fromRow === row) continue;
          const o = orbs[row][col];
          const distance = row - fromRow;
          // 列ごと・上から入る順に少しずつずらす（演出の速さに合わせて縮む）
          const delay = Math.round((ms / 380) * (col * 22 + (row < k ? (k - row) * 18 : 0)));
          const anim = o.animate(
            [
              { transform: `translate(${col * 100}%, ${fromRow * 100}%)`, opacity: row < k ? 0.2 : 1 },
              { transform: `translate(${col * 100}%, ${row * 100}%)`, opacity: 1, offset: 0.82 },
              { transform: `translate(${col * 100}%, ${row * 100 - 4}%)`, opacity: 1, offset: 0.92 },
              { transform: `translate(${col * 100}%, ${row * 100}%)`, opacity: 1 },
            ],
            { duration: Math.round(ms * (0.7 + 0.15 * Math.min(distance, 4))), delay, easing: 'ease-in', fill: 'backwards' },
          );
          animations.push(anim.finished.catch(() => undefined));
        }
      }
      await Promise.all(animations);
      el.classList.remove('refilling');
    },
    mark(clear, special) {
      for (const row of orbs) for (const o of row) o.classList.remove('will-clear', 'will-special');
      for (const p of clear) orbAt(p).classList.add('will-clear');
      for (const p of special) orbAt(p).classList.add('will-special');
    },
    async drawConstellation(cells, ms) {
      // 必殺のオーブ同士を星座の線で結ぶ（盤面を 5×5 の座標にした SVG）
      const lines = shapeLinks(cells).map(
        ([a, b]) =>
          `<line pathLength="1" x1="${a.col + 0.5}" y1="${a.row + 0.5}" x2="${b.col + 0.5}" y2="${b.row + 0.5}"/>`,
      );
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${BOARD_SIZE} ${BOARD_SIZE}`);
      svg.setAttribute('class', 'constellation');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = lines.join('');
      el.append(svg);
      el.classList.add('special-glow');
      for (const p of cells) orbAt(p).classList.add('special');
      await wait(ms);
      for (const p of cells) orbAt(p).classList.remove('special');
      el.classList.remove('special-glow');
      svg.remove();
    },
  };
}

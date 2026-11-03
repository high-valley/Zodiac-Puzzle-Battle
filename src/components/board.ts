// 5×5 盤面の表示と交点スワイプの入力
import { BOARD_SIZE, ROTATE_ANIM } from '../data/balance';
import type { Board, Direction, OrbColor, Pos } from '../game/types';
import { classifySwipe, nearestIntersection, swipeAlong } from '../input/swipe';
import { shapeLinks } from './shapeLinks';

/** 色覚の違いでも見分けられるよう、色ごとに記号を重ねる（オーブの形は共通） */
export const ORB_GLYPH: Record<OrbColor, string> = { red: '▲', blue: '◆', green: '■', pink: '♥' };
export const ORB_LABEL: Record<OrbColor, string> = { red: '赤', blue: '青', green: '緑', pink: 'ピンク' };

/** オーブの中の白い記号（目指す見た目 11-target-orbs：中が透ける線の三角・ひし形・四角、塗りのハート） */
const ORB_SYMBOL: Record<OrbColor, string> = {
  red: '<path d="M12 4.2 20.6 19H3.4Z" class="line"/>',
  blue: '<path d="M12 3.2 20.8 12 12 20.8 3.2 12Z" class="line"/>',
  green: '<path d="M5 5h14v14H5Z" class="line"/>',
  pink: '<path d="M12 20.4C6 16.3 3 13 3 9.3 3 6.6 5.1 4.6 7.6 4.6c1.8 0 3.3 1 4.4 2.6 1.1-1.6 2.6-2.6 4.4-2.6 2.5 0 4.6 2 4.6 4.7 0 3.7-3 7-9 11.1Z" class="fill"/>',
};

export function orbSymbolSvg(color: OrbColor): string {
  return `<svg class="orb-symbol" viewBox="0 0 24 24" aria-hidden="true">${ORB_SYMBOL[color]}</svg>`;
}

export interface BoardView {
  el: HTMLElement;
  render(board: Board): void;
  /** 選んだ交点（回転ボタン用） */
  selected(): Pos | null;
  select(pos: Pos | null): void;
  setLocked(locked: boolean): void;
  /** 回す動き。straight は「動きを減らす」設定のとき（円を描かずに入れ替える） */
  animateRotate(board: Board, at: Pos, direction: Direction, ms: number, straight?: boolean): Promise<void>;
  /** 回している途中なら、すぐ回し終える（次の入力を待たせないため） */
  finishRotate(): void;
  animateClear(cells: Pos[], ms: number): Promise<void>;
  animateDrop(board: Board, cleared: Pos[], ms: number): Promise<void>;
  /** 「攻撃」で消えるマス（clear）と、必殺の形になっているマス（special）に印をつける */
  mark(clear: Pos[], special: Pos[]): void;
  /** 必殺の形を星座の線で結んで光らせる */
  drawConstellation(cells: Pos[], ms: number): Promise<void>;
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

/** 2×2 の中心のまわりを角度 p（0〜1 で 90 度）だけ回した位置の transform。1マス＝オーブの大きさの100% */
function arcTransform(from: Pos, at: Pos, direction: Direction, p: number): string {
  const cx = at.col + 1;
  const cy = at.row + 1;
  const a0 = Math.atan2(from.row + 0.5 - cy, from.col + 0.5 - cx);
  const a = a0 + (direction === 'clockwise' ? 1 : -1) * (Math.PI / 2) * p;
  const x = cx + Math.SQRT1_2 * Math.cos(a) - 0.5;
  const y = cy + Math.SQRT1_2 * Math.sin(a) - 0.5;
  // 途中で少しだけ大きくして、持ち上げて回す感じを出す
  const lift = 1 + 0.06 * Math.sin(Math.PI * p);
  return `translate(${x * 100}%, ${y * 100}%) scale(${lift})`;
}

/**
 * @param onRotate 回すと決まったとき（指を離したとき・回転ボタン）
 * @param canRotate 今回せるか（回せないときは、指に合わせて動かさない）
 */
export function createBoardView(
  onRotate: (at: Pos, direction: Direction) => void,
  canRotate: () => boolean = () => true,
): BoardView {
  const el = document.createElement('div');
  el.className = 'board';
  el.setAttribute('role', 'grid');
  el.setAttribute('aria-label', '盤面。交点を押して上下左右にスワイプすると、その周りの4個が回ります');

  const orbLayer = document.createElement('div');
  orbLayer.className = 'orbs';
  el.append(orbLayer);

  // 16 か所の交点を小さな星で示す
  const starLayer = document.createElement('div');
  starLayer.className = 'stars';
  for (let r = 0; r < BOARD_SIZE - 1; r++) {
    for (let c = 0; c < BOARD_SIZE - 1; c++) {
      const s = document.createElement('span');
      s.className = 'star';
      s.style.setProperty('--r', String(r + 1));
      s.style.setProperty('--c', String(c + 1));
      starLayer.append(s);
    }
  }
  el.append(starLayer);

  const ring = document.createElement('div');
  ring.className = 'ring';
  ring.hidden = true;
  el.append(ring);

  let orbs: HTMLElement[][] = [];
  /** 回している途中のアニメーション */
  let running: Animation[] = [];
  /** 元に戻している途中のアニメーション */
  let springs: Animation[] = [];
  let current: Pos | null = null;
  let locked = false;

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
        o.setAttribute('aria-label', ORB_LABEL[color]);
        o.innerHTML = orbSymbolSvg(color);
        orbLayer.append(o);
        return o;
      }),
    );
  }

  function select(pos: Pos | null) {
    current = pos;
    ring.hidden = pos === null;
    ring.classList.remove('hint-cw', 'hint-ccw');
    if (pos) {
      ring.style.setProperty('--r', String(pos.row));
      ring.style.setProperty('--c', String(pos.col));
    }
  }

  // 交点スワイプ
  let start: { x: number; y: number; id: number } | null = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** 指に合わせて回している途中のようす（p は 0〜1 で 90 度、v は指の速さ px/ms） */
  let drag: { at: Pos; direction: Direction; p: number; v: number; axis: 'x' | 'y'; lastX: number; lastT: number } | null = null;
  /** 指を離して回すと決まり、その続きを animateRotate に引き継ぐもの */
  let release: { at: Pos; direction: Direction; p: number; v: number } | null = null;

  function setDrag(at: Pos, direction: Direction, p: number) {
    for (const from of quad(at)) {
      const o = orbAt(from);
      o.classList.add('dragging');
      o.style.transform = arcTransform(from, at, direction, p);
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
  function springBack(state: { at: Pos; direction: Direction; p: number }) {
    if (state.p <= 0 || typeof el.animate !== 'function') {
      clearDrag(state.at);
      return;
    }
    for (const from of quad(state.at)) {
      const o = orbAt(from);
      const anim = o.animate(
        [{ transform: arcTransform(from, state.at, state.direction, state.p) }, { transform: arcTransform(from, state.at, state.direction, 0) }],
        { duration: 140, easing: 'ease-out' },
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

  el.addEventListener('pointerdown', (e) => {
    if (locked || start || !e.isPrimary || e.button !== 0) return;
    // 前の回転や、元に戻す動きが残っていれば、すぐ終わらせる
    for (const a of running) a.finish();
    for (const a of springs) a.cancel();
    springs = [];
    const p = local(e);
    select(nearestIntersection(p.x, p.y, p.cell));
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const result = classifySwipe(dx, dy);
    ring.classList.toggle('hint-cw', result.kind === 'rotate' && result.direction === 'clockwise');
    ring.classList.toggle('hint-ccw', result.kind === 'rotate' && result.direction === 'counterclockwise');
    // 指に合わせて回す：横か縦に動かした分だけ（1マス弱で 90 度）。右・下＝時計回り。斜めでは回さない
    if (!current || locked || reduceMotion.matches || running.length > 0 || !canRotate() || typeof el.animate !== 'function') {
      // 回せなくなった（別の指で攻撃を押したなど）ら、回しかけを元に戻す
      if (drag) {
        clearDrag(drag.at);
        drag = null;
      }
      return;
    }
    const s = swipeAlong(dx, dy);
    const direction: Direction = s && s.along > 0 ? 'clockwise' : 'counterclockwise';
    if (drag && (!s || drag.direction !== direction || drag.at !== current || drag.axis !== s.axis)) {
      clearDrag(drag.at);
      drag = null;
    }
    if (!s) return;
    const cell = el.getBoundingClientRect().width / BOARD_SIZE;
    const p = Math.min(1, (Math.abs(s.along) - 4) / (cell * 0.9));
    const now = e.timeStamp;
    const pos = s.axis === 'x' ? e.clientX : e.clientY;
    const v = drag && now > drag.lastT ? Math.abs(pos - drag.lastX) / (now - drag.lastT) : 0;
    drag = { at: current, direction, axis: s.axis, p, v: drag ? drag.v * 0.5 + v * 0.5 : v, lastX: pos, lastT: now };
    setDrag(current, direction, p);
  });

  el.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const result = classifySwipe(e.clientX - start.x, e.clientY - start.y);
    start = null;
    ring.classList.remove('hint-cw', 'hint-ccw');
    const dragged = drag;
    drag = null;
    // 離す直前に指を止めていたら、そのぶん遅く回しきる
    if (dragged && e.timeStamp - dragged.lastT > 80) dragged.v *= 80 / (e.timeStamp - dragged.lastT);
    if (locked) {
      if (dragged) clearDrag(dragged.at);
      return;
    }
    if (result.kind === 'rotate' && current) {
      if (dragged && dragged.direction === result.direction && dragged.at === current) {
        // 指を離した位置と速さから続きを回す（animateRotate が引き継ぐ）
        release = { at: dragged.at, direction: dragged.direction, p: dragged.p, v: dragged.v };
        const mine = release;
        onRotate(current, result.direction);
        // 回せなかったとき（上限など）は、もとに戻す
        setTimeout(() => {
          if (release === mine) {
            release = null;
            springBack(mine);
          }
        }, 60);
      } else {
        if (dragged) clearDrag(dragged.at);
        onRotate(current, result.direction);
      }
    } else if (dragged) {
      springBack(dragged);
    }
  });

  el.addEventListener('pointercancel', () => {
    start = null;
    ring.classList.remove('hint-cw', 'hint-ccw');
    if (drag) springBack(drag);
    drag = null;
  });

  return {
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
    },
    finishRotate() {
      for (const a of running) a.finish();
    },
    async animateRotate(board, at, direction, ms, straight = false) {
      const { row: r, col: c } = at;
      // 各マスの移動先。時計回り：左上→右上→右下→左下→左上
      const cw: [Pos, Pos][] = [
        [{ row: r, col: c }, { row: r, col: c + 1 }],
        [{ row: r, col: c + 1 }, { row: r + 1, col: c + 1 }],
        [{ row: r + 1, col: c + 1 }, { row: r + 1, col: c }],
        [{ row: r + 1, col: c }, { row: r, col: c }],
      ];
      const moves = direction === 'clockwise' ? cw : cw.map(([from, to]) => [to, from] as [Pos, Pos]);
      if (typeof el.animate !== 'function' || straight) {
        // 動きを減らす設定のとき（と古い環境）は、円を描かずにまっすぐ入れ替える
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
      const p0 = fromDrag ? fromDrag.p : 0;
      let duration = ms;
      let easing = 'cubic-bezier(0.45, 0.05, 0.3, 1)';
      if (fromDrag) {
        const cell = el.getBoundingClientRect().width / BOARD_SIZE;
        // 残りの弧の長さ（px）を、離したときの指の速さで進む時間。速すぎ・遅すぎは抑える
        const remaining = (1 - p0) * cell * 1.11;
        const k = ms / ROTATE_ANIM.buttonMs; // 演出 ×2 では半分に
        duration = Math.round(
          Math.min(ROTATE_ANIM.releaseMaxMs * k, Math.max(ROTATE_ANIM.releaseMinMs * k, remaining / Math.max(fromDrag.v, 0.3))),
        );
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
    async animateClear(cells, ms) {
      for (const p of cells) orbAt(p).classList.add('clearing');
      await wait(ms);
    },
    async animateDrop(board, cleared, ms) {
      render(board);
      if (typeof el.animate !== 'function' || reduceMotion.matches) {
        // 動きを減らす設定：消えたマスより上のオーブだけ、短く上から入れる
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

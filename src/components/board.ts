// 5×5 盤面の表示と交点スワイプの入力
import { BOARD_SIZE } from '../data/balance';
import type { Board, Direction, OrbColor, Pos } from '../game/types';
import { classifySwipe, nearestIntersection } from '../input/swipe';

/** 色覚の違いでも見分けられるよう、色ごとに記号を重ねる（オーブの形は共通） */
export const ORB_GLYPH: Record<OrbColor, string> = { red: '▲', blue: '◆', green: '■', pink: '♥' };
export const ORB_LABEL: Record<OrbColor, string> = { red: '赤', blue: '青', green: '緑', pink: 'ピンク' };

export interface BoardView {
  el: HTMLElement;
  render(board: Board): void;
  /** 選んだ交点（回転ボタン用） */
  selected(): Pos | null;
  select(pos: Pos | null): void;
  setLocked(locked: boolean): void;
  animateRotate(board: Board, at: Pos, direction: Direction, ms: number): Promise<void>;
  animateClear(cells: Pos[], ms: number): Promise<void>;
  animateDrop(board: Board, cleared: Pos[], ms: number): Promise<void>;
  flashCells(cells: Pos[], ms: number): Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createBoardView(onRotate: (at: Pos, direction: Direction) => void): BoardView {
  const el = document.createElement('div');
  el.className = 'board';
  el.setAttribute('role', 'grid');
  el.setAttribute('aria-label', '盤面。交点を押して左右にスワイプすると、その周りの4個が回ります');

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
  let current: Pos | null = null;
  let locked = false;

  function orbAt(p: Pos) {
    return orbs[p.row][p.col];
  }

  function render(board: Board) {
    orbLayer.replaceChildren();
    orbs = board.map((row, r) =>
      row.map((color, c) => {
        const o = document.createElement('div');
        o.className = `orb orb-${color}`;
        o.style.setProperty('--r', String(r));
        o.style.setProperty('--c', String(c));
        o.setAttribute('role', 'gridcell');
        o.setAttribute('aria-label', ORB_LABEL[color]);
        o.textContent = ORB_GLYPH[color];
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

  function local(e: PointerEvent) {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, cell: rect.width / BOARD_SIZE };
  }

  el.addEventListener('pointerdown', (e) => {
    if (locked || start) return;
    const p = local(e);
    select(nearestIntersection(p.x, p.y, p.cell));
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const result = classifySwipe(e.clientX - start.x, e.clientY - start.y);
    ring.classList.toggle('hint-cw', result.kind === 'rotate' && result.direction === 'clockwise');
    ring.classList.toggle('hint-ccw', result.kind === 'rotate' && result.direction === 'counterclockwise');
  });

  el.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const result = classifySwipe(e.clientX - start.x, e.clientY - start.y);
    start = null;
    ring.classList.remove('hint-cw', 'hint-ccw');
    if (result.kind === 'rotate' && current && !locked) onRotate(current, result.direction);
  });

  el.addEventListener('pointercancel', () => {
    start = null;
    ring.classList.remove('hint-cw', 'hint-ccw');
  });

  return {
    el,
    render,
    selected: () => current,
    select,
    setLocked(value) {
      locked = value;
      el.classList.toggle('locked', value);
    },
    async animateRotate(board, at, direction, ms) {
      const { row: r, col: c } = at;
      // 各マスの移動先。時計回り：左上→右上→右下→左下→左上
      const cw: [Pos, Pos][] = [
        [{ row: r, col: c }, { row: r, col: c + 1 }],
        [{ row: r, col: c + 1 }, { row: r + 1, col: c + 1 }],
        [{ row: r + 1, col: c + 1 }, { row: r + 1, col: c }],
        [{ row: r + 1, col: c }, { row: r, col: c }],
      ];
      const moves = direction === 'clockwise' ? cw : cw.map(([from, to]) => [to, from] as [Pos, Pos]);
      for (const [from, to] of moves) {
        const o = orbAt(from);
        o.classList.add('moving');
        o.style.setProperty('--r', String(to.row));
        o.style.setProperty('--c', String(to.col));
      }
      await wait(ms);
      render(board);
    },
    async animateClear(cells, ms) {
      for (const p of cells) orbAt(p).classList.add('clearing');
      await wait(ms);
    },
    async animateDrop(board, cleared, ms) {
      render(board);
      // 消えたマスより上（＝落ちてきた・補充された）オーブだけ上から入れる
      const lowest = new Map<number, number>();
      for (const p of cleared) lowest.set(p.col, Math.max(lowest.get(p.col) ?? -1, p.row));
      for (const [col, bottom] of lowest) {
        for (let r = 0; r <= bottom; r++) orbs[r][col].classList.add('dropping');
      }
      await wait(ms);
    },
    async flashCells(cells, ms) {
      for (const p of cells) orbAt(p).classList.add('special');
      await wait(ms);
      for (const p of cells) orbAt(p).classList.remove('special');
    },
  };
}

// 盤面の生成・2×2回転・落下と補充
import { BOARD_SIZE, MIN_MATCH, ORB_COLORS, ROCK } from '../data/balance';
import { nextInt } from './rng';
import type { Board, Cell, Direction, OrbColor, Pos } from './types';

/** 回転できる交点は 0..(BOARD_SIZE - 2) */
export const MAX_INTERSECTION = BOARD_SIZE - 2;

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function isValidIntersection(row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    col >= 0 &&
    row <= MAX_INTERSECTION &&
    col <= MAX_INTERSECTION
  );
}

/**
 * (row, col) を左上とする 2×2 を 90° 回転する。
 * [A B; C D] → 時計回り [C A; D B]、反時計回り [B D; A C]
 */
export function rotate2x2(board: Board, row: number, col: number, direction: Direction): Board {
  if (!isValidIntersection(row, col)) {
    throw new RangeError(`交点が範囲外です: (${row}, ${col})`);
  }
  const next = cloneBoard(board);
  const a = board[row][col];
  const b = board[row][col + 1];
  const c = board[row + 1][col];
  const d = board[row + 1][col + 1];
  if (direction === 'clockwise') {
    next[row][col] = c;
    next[row][col + 1] = a;
    next[row + 1][col] = d;
    next[row + 1][col + 1] = b;
  } else {
    next[row][col] = b;
    next[row][col + 1] = d;
    next[row + 1][col] = a;
    next[row + 1][col + 1] = c;
  }
  return next;
}

/**
 * 通常マッチが1つもない初期盤面を作る。
 * 左に同色が (MIN_MATCH - 1) 個、または上に同色が (MIN_MATCH - 1) 個続く色は選ばない
 */
export function createInitialBoard(seed: number): { board: Board; seed: number } {
  let s = seed;
  const board: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: OrbColor[] = [];
    board.push(row);
    for (let c = 0; c < BOARD_SIZE; c++) {
      const banned = new Set<OrbColor>();
      if (c >= MIN_MATCH - 1) {
        const left = row.slice(c - (MIN_MATCH - 1), c);
        if (left.every((x) => x === left[0])) banned.add(left[0]);
      }
      if (r >= MIN_MATCH - 1) {
        const above = board.slice(r - (MIN_MATCH - 1), r).map((line) => line[c]);
        if (above.every((x) => x === above[0])) banned.add(above[0] as OrbColor);
      }
      const choices = ORB_COLORS.filter((color) => !banned.has(color));
      const pick = nextInt(s, choices.length);
      s = pick.seed;
      row.push(choices[pick.value]);
    }
  }
  return { board, seed: s };
}

/**
 * cleared が true のマスを消し、各列で残りを下に詰め、上から補充する。
 * 補充は左の列から、各列は下の空きから順に乱数を引く
 */
export function collapseAndRefill(
  board: Board,
  cleared: boolean[][],
  seed: number,
): { board: Board; seed: number } {
  let s = seed;
  const next = cloneBoard(board);
  for (let c = 0; c < BOARD_SIZE; c++) {
    // 星屑も残って落ちる。補充では星屑は出ない
    const kept: Cell[] = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (!cleared[r][c]) kept.push(board[r][c]);
    }
    for (let r = BOARD_SIZE - 1, i = 0; r >= 0; r--, i++) {
      if (i < kept.length) {
        next[r][c] = kept[i];
      } else {
        const pick = nextInt(s, ORB_COLORS.length);
        s = pick.seed;
        next[r][c] = ORB_COLORS[pick.value];
      }
    }
  }
  return { board: next, seed: s };
}

/** (row, col) を左上とする 2×2 に、岩で固まったマスがあるか（あれば回せない。仕様書 12.14） */
export function isRockBlocked(rocks: readonly Pos[] | undefined, row: number, col: number): boolean {
  return !!rocks && rocks.some((p) => (p.row === row || p.row === row + 1) && (p.col === col || p.col === col + 1));
}

/** 回せる交点の数（岩で固まったマスを含まない 2×2） */
export function freeIntersections(rocks: readonly Pos[] | undefined): number {
  let n = 0;
  for (let r = 0; r <= MAX_INTERSECTION; r++) for (let c = 0; c <= MAX_INTERSECTION; c++) if (!isRockBlocked(rocks, r, c)) n++;
  return n;
}

/** 位置を上の行から順に並べる */
export function sortPos(cells: Pos[]): Pos[] {
  return cells.sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * 消えるマス（cleared）で、岩を割って落とす。そのマスか上下左右が消える岩は割れる（broken）。
 * 残った岩は、collapseAndRefill と同じく、その下で消えたマスの数だけ落ちる。
 * 落ちたせいで回せる 2×2 が ROCK.minFreeAfterDrop より少なくなったら、落ちた岩を下の行（同じ行なら右）から順に割る（手詰まりを防ぐ）
 */
export function breakAndDropRocks(rocks: readonly Pos[], cleared: boolean[][]): { rocks: Pos[]; broken: Pos[] } {
  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE && cleared[r][c];
  const broken: Pos[] = [];
  /** 残る岩：落ちる前（from）と落ちた後（to） */
  const kept: { from: Pos; to: Pos }[] = [];
  for (const p of rocks) {
    const { row: r, col: c } = p;
    if (on(r, c) || on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1)) broken.push({ ...p });
    else {
      let below = 0;
      for (let k = r + 1; k < BOARD_SIZE; k++) if (cleared[k][c]) below++;
      kept.push({ from: { ...p }, to: { row: r + below, col: c } });
    }
  }
  // 落ちた岩のせいで回せる所が足りなければ、落ちた岩を下の行から割る（broken には落ちる前の位置を入れる）
  const fell = kept.filter((k) => k.to.row !== k.from.row).sort((a, b) => b.to.row - a.to.row || b.to.col - a.to.col);
  while (fell.length > 0 && freeIntersections(kept.map((k) => k.to)) < ROCK.minFreeAfterDrop) {
    const k = fell.shift()!;
    kept.splice(kept.indexOf(k), 1);
    broken.push(k.from);
  }
  return { rocks: sortPos(kept.map((k) => k.to)), broken: sortPos(broken) };
}

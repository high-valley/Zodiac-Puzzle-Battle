// 必殺の形を星座の線で結ぶときの線の引き方（純粋な関数）
import type { Pos } from '../game/types';

/**
 * 結ぶ線の一覧。縦横に隣り合うマスは結ぶ。斜めに隣り合うマスは、
 * 両方に縦横で隣り合う形のマスが無いときだけ結ぶ（2×2の中に×を描かないように）
 */
export function shapeLinks(cells: readonly Pos[]): [Pos, Pos][] {
  const key = (r: number, c: number) => `${r},${c}`;
  const lit = new Set(cells.map((p) => key(p.row, p.col)));
  const links: [Pos, Pos][] = [];
  for (const p of cells) {
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ]) {
      if (lit.has(key(p.row + dr, p.col + dc))) links.push([p, { row: p.row + dr, col: p.col + dc }]);
    }
    for (const dc of [-1, 1]) {
      const q = { row: p.row + 1, col: p.col + dc };
      if (!lit.has(key(q.row, q.col))) continue;
      // 斜めの2マスに共通して隣り合うのは (p.row, q.col) と (q.row, p.col)
      const joined = lit.has(key(p.row, q.col)) || lit.has(key(q.row, p.col));
      if (!joined) links.push([p, q]);
    }
  }
  return links;
}

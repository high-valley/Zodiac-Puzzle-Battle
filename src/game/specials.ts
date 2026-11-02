// キャラ固有の「形」による必殺技の判定。形は盤面のどこにあってもよい
import { BOARD_SIZE } from '../data/balance';
import { HEROES } from '../data/heroes';
import type { Board, HeroId, Pos, SpecialResult, SpecialShape } from './types';

type Offsets = readonly (readonly [number, number])[];

/** 右に90度回した配置 */
function rotateOffsets(offsets: Offsets): Offsets {
  const height = Math.max(...offsets.map(([r]) => r));
  return offsets.map(([r, c]) => [c, height - r] as const);
}

/** 図（● が形のマス）から配置を作る */
function fromRows(rows: readonly string[]): Offsets {
  return rows.flatMap((line, r) => [...line].flatMap((ch, c) => (ch === '●' ? [[r, c] as const] : [])));
}

/** 90度ずつ回した配置のうち、違うものだけ（回しても同じ形は1つにまとめる） */
function orientations(base: Offsets): Offsets[] {
  const key = (o: Offsets) =>
    [...o]
      .map(([r, c]) => `${r},${c}`)
      .sort()
      .join(' ');
  const out: Offsets[] = [];
  let cur = base;
  for (let i = 0; i < 4; i++) {
    if (!out.some((o) => key(o) === key(cur))) out.push(cur);
    cur = rotateOffsets(cur);
  }
  return out;
}

/**
 * 形ごとの配置（[行, 列] の相対位置）。どの形も、90度ずつ回した向きすべてが有効。
 * 1ターンに3回まで回せて、「攻撃」を押すまで消えないので、縦横の3個並びを含む形（L字・十字など）も組み立てられる。
 * 作りにくい形ほど必殺の威力を大きくする（仕様書 12.3、作りやすさは npm run bench）
 */
export const SHAPES: Record<SpecialShape, readonly Offsets[]> = {
  // L字：縦3＋横3で角を共有する5個
  L: orientations(fromRows(['●・・', '●・・', '●●●'])),
  // 十字：中央と上下左右
  cross: orientations(fromRows(['・●・', '●●●', '・●・'])),
  square: orientations(fromRows(['●●', '●●'])),
  // T字（牛の頭）
  T: orientations(fromRows(['●●●', '・●・', '・●・'])),
  // 小さなT（天秤）
  smallT: orientations(fromRows(['・●・', '●●●'])),
  // 二本柱（ふたご）
  pillars: orientations(fromRows(['●・●', '●・●'])),
  // 一直線5（獅子の咆哮）
  line5: orientations(fromRows(['●●●●●'])),
  // 一直線4（水の流れ）
  line4: orientations(fromRows(['●●●●'])),
  // Z字（さそりの尾）
  Z: orientations(fromRows(['●●・', '・●・', '・●●'])),
  // 角（やぎ）
  horns: orientations(fromRows(['●・●', '●・●', '・●・'])),
  // S字（反対を向いて泳ぐ二匹の魚）
  S: orientations(fromRows(['・●●', '●●・'])),
  // 四隅（かにのはさみと脚）
  corners: orientations(fromRows(['●・●', '・・・', '●・●'])),
};

/** 形の名前（表示用） */
export const SHAPE_LABEL: Record<SpecialShape, string> = {
  L: 'L字',
  cross: '十字',
  square: '2×2',
  T: 'T字',
  smallT: '小さなT字',
  pillars: '二本柱',
  line5: '一直線5個',
  line4: '一直線4個',
  Z: 'Z字',
  horns: '角（つの）',
  S: 'S字',
  corners: '四隅',
};

/** 選んだキャラの必殺の形が盤面にあれば、最初に見つかった1つを返す（向きの順に、それぞれ左上から探す） */
export function detectHeroSpecial(board: Board, heroId: HeroId): SpecialResult | null {
  const { color, shape } = HEROES[heroId].special;
  for (const offsets of SHAPES[shape]) {
    const height = Math.max(...offsets.map(([r]) => r)) + 1;
    const width = Math.max(...offsets.map(([, c]) => c)) + 1;
    for (let r = 0; r + height <= BOARD_SIZE; r++) {
      for (let c = 0; c + width <= BOARD_SIZE; c++) {
        const cells: Pos[] = offsets.map(([dr, dc]) => ({ row: r + dr, col: c + dc }));
        if (cells.every((p) => board[p.row][p.col] === color)) {
          return { heroId, shape, color, cells };
        }
      }
    }
  }
  return null;
}

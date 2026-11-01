// ゲームエンジンの型。画面やブラウザ固有 API には依存しない

export type OrbColor = 'red' | 'blue' | 'green' | 'pink';
export type HeroId = 'aries' | 'sagittarius' | 'virgo';
export type Direction = 'clockwise' | 'counterclockwise';

/** 5×5。board[row][col]、row 0 が一番上 */
export type Board = OrbColor[][];

export interface Pos {
  row: number;
  col: number;
}

export type BattleStatus = 'playing' | 'victory' | 'defeat';

export interface BattleState {
  board: Board;
  selectedHero: HeroId;
  turn: number;
  partyHp: number;
  partyMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  /** 乱数の内部状態。補充のたびに進む */
  rngSeed: number;
  status: BattleStatus;
}

export interface TurnAction {
  hero: HeroId;
  /** 交点の位置（0..3）。2×2 の左上のマス */
  row: number;
  col: number;
  direction: Direction;
}

export interface MatchGroup {
  color: OrbColor;
  /** 'row' は横並び、'col' は縦並び */
  axis: 'row' | 'col';
  cells: Pos[];
}

export type SpecialShape = 'L' | 'cross' | 'square';

export interface SpecialResult {
  heroId: HeroId;
  shape: SpecialShape;
  color: OrbColor;
  cells: Pos[];
}

/** 画面の演出に渡す、1ターンの出来事の並び */
export type BattleEvent =
  | { type: 'rotate'; row: number; col: number; direction: Direction; board: Board }
  | { type: 'special'; special: SpecialResult; name: string; damage: number; heal: number }
  | {
      type: 'clear';
      chain: number;
      cells: Pos[];
      counts: Record<OrbColor, number>;
      damage: number;
      heal: number;
      /** 落下・補充した後の盤面 */
      board: Board;
    }
  | { type: 'heal'; amount: number; partyHp: number }
  | { type: 'damage'; amount: number; enemyHp: number }
  | { type: 'enemyAttack'; amount: number; partyHp: number }
  | { type: 'end'; status: Exclude<BattleStatus, 'playing'> };

export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
}

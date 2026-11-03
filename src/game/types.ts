// ゲームエンジンの型。画面やブラウザ固有 API には依存しない

export type OrbColor = 'red' | 'blue' | 'green' | 'pink';
/** 12星座（仕様書 12.1） */
export type HeroId =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

/** 編成の1人：キャラとレベル（1〜MAX_LEVEL） */
export interface PartyMember {
  id: HeroId;
  level: number;
}
export type Direction = 'clockwise' | 'counterclockwise';

/** 5×5。board[row][col]、row 0 が一番上 */
export type Board = OrbColor[][];

export interface Pos {
  row: number;
  col: number;
}

export type BattleStatus = 'playing' | 'victory' | 'defeat';

/** 1戦の記録（リザルトに出す。途中で保存しても失われないよう状態に持つ） */
export interface BattleStats {
  /** 1ターンの最大連鎖（0〜8） */
  maxChain: number;
  /** 必殺が出た回数 */
  specials: number;
  /** 敵に与えたダメージの合計（敵の残りHPを超えた分は含めない） */
  damageDealt: number;
  /** 実際に回復した量の合計 */
  healed: number;
}

export interface BattleState {
  board: Board;
  /** 出撃した仲間（バトルの間は変わらない） */
  party: PartyMember[];
  turn: number;
  partyHp: number;
  partyMaxHp: number;
  /** 敵の種類（src/data/enemies.ts） */
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  /** 強攻撃まであと何ターンか。強攻撃のない敵は null */
  enemyChargeIn: number | null;
  /** 乱数の内部状態。補充のたびに進む */
  rngSeed: number;
  status: BattleStatus;
  stats: BattleStats;
}

/** 1回の回転。row・col は交点の位置（0..3）＝回す 2×2 の左上のマス */
export interface Rotation {
  row: number;
  col: number;
  direction: Direction;
}

/**
 * 1ターンの操作：1〜3回の回転（MAX_ROTATIONS_PER_TURN）。
 * 回している間は何も消えず、「攻撃」で確定したときに必殺と消去が起きる。
 * 出撃した仲間は全員が同時に行動し、各キャラは自分の色のオーブが消えたときだけ動く（仕様書 12.7）
 */
export interface TurnAction {
  rotations: Rotation[];
}

/** 1段の消去で動いたキャラと、その量 */
export interface Actor {
  heroId: HeroId;
  damage: number;
  heal: number;
}

export interface MatchGroup {
  color: OrbColor;
  /** 'row' は横並び、'col' は縦並び */
  axis: 'row' | 'col';
  cells: Pos[];
}

/** 必殺の形（配置は src/game/specials.ts、仕様書 9.2） */
export type SpecialShape =
  | 'L'
  | 'cross'
  | 'square'
  | 'T'
  | 'smallT'
  | 'pillars'
  | 'line5'
  | 'line4'
  | 'Z'
  | 'horns'
  | 'S'
  | 'corners';

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
      /** 通常マッチの連鎖段数（1〜）。必殺に使ったオーブだけを消した段は 0 */
      chain: number;
      /** この段で消したマス（通常マッチ＋必殺に使ったオーブ） */
      cells: Pos[];
      /** 通常マッチで消した色ごとの個数（通常効果の計算に使う。必殺だけで消えた分は含めない） */
      counts: Record<OrbColor, number>;
      /** この段で動いたキャラ（自分の色が消えたキャラ） */
      actors: Actor[];
      damage: number;
      heal: number;
      /** 落下・補充した後の盤面 */
      board: Board;
    }
  /** amount は実際に増えた量 */
  | { type: 'heal'; amount: number; partyHp: number }
  | { type: 'damage'; amount: number; enemyHp: number }
  /** heavy は強攻撃のとき true */
  | { type: 'enemyAttack'; amount: number; partyHp: number; heavy: boolean }
  | { type: 'end'; status: Exclude<BattleStatus, 'playing'> };

export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
}

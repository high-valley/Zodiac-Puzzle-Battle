// キャラの設定データ（数値は仮）。12星座の性能の考え方は仕様書 12.3
import type { HeroId, OrbColor, PartyMember, SpecialShape } from '../game/types';
import { TRAITS } from './balance';

export interface ColorAction {
  /** 技名（表示用） */
  name: string;
  /** 消したオーブ1個あたりの基礎係数（レベル1のとき） */
  coef: number;
}

/**
 * キャラ特性（仕様書 12.8。数値は src/data/balance.ts の TRAITS）
 * vanguard 先陣：そのターン最初の消去に自分の色があれば強い／mass 量：一度に多く消すほど強い／chain 連鎖：連鎖が深いほど強い
 */
export type HeroTrait = 'vanguard' | 'mass' | 'chain' | 'twin' | 'poison' | 'far' | 'balance' | 'charge' | 'vortex' | 'shield' | 'bigHeal' | 'rain';

export const TRAIT_LABEL: Record<HeroTrait, { name: string; text: string }> = {
  vanguard: { name: '先陣', text: 'そのターン最初に消えたオーブに自分の色があると、その一撃が大きくなる' },
  mass: { name: '量', text: '自分の色を一度に多く消すほど、ダメージが伸びる' },
  chain: { name: '連鎖', text: '連鎖が深いほど、ダメージが大きく伸びる' },
  twin: { name: '2回攻撃', text: '1回は弱いが、必ず2回当たる（合わせると少し強い）' },
  poison: { name: '毒', text: `攻撃すると敵に毒が回り、${TRAITS.poisonTurns}ターンのあいだダメージを与える` },
  far: { name: '遠距離', text: `盤面の上の${TRAITS.farRows}段で自分の色を消すと、その分だけ強くなる` },
  balance: { name: '均衡', text: '同じ段にほかの色も消えると、色の数だけ強くなる' },
  charge: { name: '溜め', text: `自分の色で攻撃しなかったターンごとに力が溜まり（最大${TRAITS.chargeMax}）、次の一撃が大きくなる` },
  vortex: { name: '渦', text: '2段目からの連鎖で攻撃するたびに、少しずつ回復もする' },
  shield: { name: '盾', text: `回復したターンは、敵の攻撃を${Math.round(TRAITS.shieldCut * 10)}割軽くする` },
  bigHeal: { name: '大回復', text: `ピンクを一度に${TRAITS.bigHealMin}個以上消すと、回復が大きくなる` },
  rain: { name: '恵みの雨', text: `回復すると、次の${TRAITS.rainTurns}ターンも少しずつ回復が続く` },
};

export interface HeroDef {
  id: HeroId;
  name: string;
  /** 英名（育成・図鑑の表示用） */
  latin: string;
  /** 星座記号（テキスト表示） */
  symbol: string;
  role: 'attacker' | 'healer';
  /** ステータスのタイプ（攻撃型・体力型など。仕様書 12.13） */
  statType: StatType;
  /** パーティー最大HPへの寄与値（レベル1のとき） */
  maxHpContribution: number;
  /** 防御力（レベル1のとき）。仲間の合計で、敵の攻撃で減るHPを割合で減らす（仕様書 12.11。式は data/balance の DEFENSE） */
  defense: number;
  /** 色ごとの通常効果。自分の色（必殺の色）だけ。ほかの色は直接効果なし（連鎖には寄与する。仕様書 12.7） */
  actions: Partial<Record<OrbColor, ColorAction>>;
  /** キャラ特性（仕様書 12.8）。まだ決めていないキャラは無し */
  trait?: HeroTrait;
  special: {
    name: string;
    color: OrbColor;
    shape: SpecialShape;
    /** 攻撃キャラはダメージ、ヒーラーは回復量（レベル1のとき）。形が作りにくいほど大きい（仕様書 12.3） */
    power: number;
    /**
     * 形の作りやすさ（表示用）。npm run bench の「3回以内に作れる割合」で決める：
     * 75%以上 easy、55%以上 normal、それ未満 hard（仕様書 12.3）
     */
    difficulty: 'easy' | 'normal' | 'hard';
  };
  /** 図鑑のひとこと */
  description: string;
}

/**
 * ステータスのタイプ（仕様書 12.13。2026-11-07 ユーザーの決定）。同じ色の3人が同じような数値にならないよう、得意なものを分ける。
 * 数値はレベル1のとき。2026-11-07 に全体を10倍にした（強さのつり合いは変えない）。
 * 係数は10の倍数にする（レベルの倍率が10%きざみなので、画面の攻撃力・回復力が小数にならない）
 */
export type StatType = 'balanced' | 'attack' | 'stamina' | 'guard' | 'heal';
export const STAT_TYPE_LABEL: Record<StatType, string> = { balanced: '均整型', attack: '攻撃型', stamina: '体力型', guard: '防御型', heal: '回復型' };

/**
 * 攻撃キャラのタイプの目安。hp＝パーティー最大HPへの寄与、defense＝防御力、coef＝自分の色を1個消すごとのダメージ。
 * 同じタイプでもキャラごとに少しずつ違う値にする（2026-11-07 ユーザーの要望。値は各キャラに直接書く）。
 * タイプは「どれが得意か」の目安：攻撃型は係数 140 以上、体力型は HP 1250 以上、防御型は防御 240
 */
export const ATTACKER_TYPES = {
  balanced: { hp: 1000, defense: 120, coef: 120 },
  attack: { hp: 850, defense: 60, coef: 140 },
  stamina: { hp: 1300, defense: 100, coef: 110 },
  guard: { hp: 1050, defense: 240, coef: 100 },
} satisfies Partial<Record<StatType, { hp: number; defense: number; coef: number }>>;

/** 回復役のタイプ。coef＝ピンクを1個消すごとの回復 */
export const HEALER_TYPES = {
  heal: { hp: 1000, defense: 100, coef: 100 },
  stamina: { hp: 1400, defense: 90, coef: 90 },
  guard: { hp: 1150, defense: 240, coef: 80 },
} satisfies Partial<Record<StatType, { hp: number; defense: number; coef: number }>>;

/** 攻撃キャラの標準の係数（均整型）。2026-11-03 自分の色だけで攻撃するように変えた（仕様書 12.7） */
export const ATTACK_COEF = ATTACKER_TYPES.balanced.coef;
/** 回復役の標準の係数（回復型） */
export const HEAL_COEF = HEALER_TYPES.heal.coef;

// 攻撃キャラ：自分の色（必殺の色）のオーブが消えたときだけ攻撃する。係数はタイプで決める
const attack = (color: OrbColor, name: string, coef = ATTACK_COEF): Partial<Record<OrbColor, ColorAction>> => ({ [color]: { name, coef } });
const heal = (name: string, coef = HEAL_COEF): Partial<Record<OrbColor, ColorAction>> => ({ pink: { name, coef } });

export const HEROES: Record<HeroId, HeroDef> = {
  aries: {
    id: 'aries',
    name: 'おひつじ座',
    latin: 'Aries',
    symbol: '♈︎',
    role: 'attacker',
    statType: 'balanced',
    maxHpContribution: 1050,
    defense: 130,
    actions: attack('red', '紅蓮の一撃', 120),
    trait: 'vanguard',
    special: { name: '炎角・紅蓮衝', color: 'red', shape: 'L', power: 1400, difficulty: 'normal' },
    description: '燃える角で道を切り開く、まっすぐな剣士。',
  },
  taurus: {
    id: 'taurus',
    name: 'おうし座',
    latin: 'Taurus',
    symbol: '♉︎',
    role: 'attacker',
    statType: 'stamina',
    maxHpContribution: 1400,
    // 2026-11-03 緑から赤に（赤・青・緑・ピンクを3人ずつにそろえる）
    defense: 110,
    actions: attack('red', '猛進', 100),
    trait: 'mass',
    special: { name: '金牛の猛進', color: 'red', shape: 'T', power: 1400, difficulty: 'normal' },
    description: '大地のように揺るがない、頼れる守り手。',
  },
  gemini: {
    id: 'gemini',
    name: 'ふたご座',
    latin: 'Gemini',
    symbol: '♊︎',
    role: 'attacker',
    statType: 'stamina',
    maxHpContribution: 1250,
    defense: 90,
    actions: attack('blue', '鏡の閃き', 110),
    trait: 'twin',
    special: { name: '双つ星の共鳴', color: 'blue', shape: 'pillars', power: 1100, difficulty: 'easy' },
    description: 'ふたりで息を合わせて戦う、いたずら好きの双子。',
  },
  cancer: {
    id: 'cancer',
    name: 'かに座',
    latin: 'Cancer',
    symbol: '♋︎',
    role: 'healer',
    statType: 'guard',
    maxHpContribution: 1150,
    defense: 240,
    actions: heal('月潮の癒やし', 80),
    trait: 'shield',
    special: { name: '蟹甲の加護', color: 'pink', shape: 'corners', power: 1200, difficulty: 'easy' },
    description: '仲間を固い甲羅のように守る、面倒見のよい癒やし手。',
  },
  leo: {
    id: 'leo',
    name: 'しし座',
    latin: 'Leo',
    symbol: '♌︎',
    role: 'attacker',
    statType: 'attack',
    maxHpContribution: 900,
    defense: 70,
    actions: attack('red', '獅子の爪', 140),
    trait: 'chain',
    special: { name: '獅子王の咆哮', color: 'red', shape: 'line5', power: 1600, difficulty: 'hard' },
    description: '百獣の王の誇りを胸に、正面から敵を討つ。',
  },
  virgo: {
    id: 'virgo',
    name: 'おとめ座',
    latin: 'Virgo',
    symbol: '♍︎',
    role: 'healer',
    statType: 'heal',
    maxHpContribution: 1030,
    defense: 110,
    actions: heal('癒やしの光', 100),
    trait: 'bigHeal',
    special: { name: '聖女の祝福', color: 'pink', shape: 'square', power: 1100, difficulty: 'easy' },
    description: '祈りで仲間を包む、やさしい癒やし手。',
  },
  libra: {
    id: 'libra',
    name: 'てんびん座',
    latin: 'Libra',
    symbol: '♎︎',
    role: 'attacker',
    statType: 'balanced',
    maxHpContribution: 1000,
    defense: 140,
    actions: attack('green', '天秤の一閃', 110),
    trait: 'balance',
    special: { name: '天秤の審判', color: 'green', shape: 'smallT', power: 1100, difficulty: 'easy' },
    description: '何ごとも公平に量る、冷静な裁き手。',
  },
  scorpio: {
    id: 'scorpio',
    name: 'さそり座',
    latin: 'Scorpio',
    symbol: '♏︎',
    role: 'attacker',
    statType: 'attack',
    maxHpContribution: 780,
    defense: 50,
    actions: attack('blue', '闇の一刺し', 150),
    trait: 'poison',
    special: { name: '蠍毒の尾撃', color: 'blue', shape: 'Z', power: 1600, difficulty: 'hard' },
    description: '静かに狙いすまし、一撃で仕留める。',
  },
  sagittarius: {
    id: 'sagittarius',
    name: 'いて座',
    latin: 'Sagittarius',
    symbol: '♐︎',
    role: 'attacker',
    statType: 'balanced',
    maxHpContribution: 920,
    defense: 100,
    actions: attack('blue', '貫通射撃', 130),
    trait: 'far',
    special: { name: '天穿つ星矢', color: 'blue', shape: 'cross', power: 1600, difficulty: 'hard' },
    description: '星をも射抜く、誇り高き弓の名手。',
  },
  capricorn: {
    id: 'capricorn',
    name: 'やぎ座',
    latin: 'Capricorn',
    symbol: '♑︎',
    role: 'attacker',
    statType: 'guard',
    maxHpContribution: 1050,
    defense: 240,
    actions: attack('green', '山羊の跳撃', 100),
    trait: 'charge',
    special: { name: '山嶺の双角', color: 'green', shape: 'horns', power: 1400, difficulty: 'normal' },
    description: '険しい山も駆け上がる、粘り強い戦士。',
  },
  aquarius: {
    id: 'aquarius',
    name: 'みずがめ座',
    latin: 'Aquarius',
    symbol: '♒︎',
    // 2026-11-03 攻撃（青）から回復役に
    role: 'healer',
    statType: 'stamina',
    maxHpContribution: 1400,
    defense: 90,
    actions: heal('命の水', 90),
    trait: 'rain',
    special: { name: '宝瓶の慈雨', color: 'pink', shape: 'line4', power: 1100, difficulty: 'easy' },
    description: '水がめからあふれる清らかな水で仲間を癒やす、型にはまらない自由な賢者。',
  },
  pisces: {
    id: 'pisces',
    name: 'うお座',
    latin: 'Pisces',
    symbol: '♓︎',
    role: 'attacker',
    statType: 'stamina',
    maxHpContribution: 1300,
    defense: 100,
    actions: attack('green', '潮の渦', 110),
    trait: 'vortex',
    special: { name: '双魚の渦潮', color: 'green', shape: 'S', power: 1100, difficulty: 'easy' },
    description: '二匹の魚が渦を巻いて襲いかかる、気まぐれで夢見がちな歌い手。',
  },
};

/** 星座の順（おひつじ座から） */
export const ALL_HEROES: readonly HeroId[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

/** 12星座のキャラ名か（保存データや URL の文字列を確かめる。Object の持ち物の名前は通さない） */
export function isHeroId(id: unknown): id is HeroId {
  return typeof id === 'string' && (ALL_HEROES as readonly string[]).includes(id);
}

/**
 * 仲間になる条件（仕様書 12.6）。
 * - 'start'：最初からいる
 * - { stageId }：そのステージを初めてクリアすると加入する。まだ無い章のステージは、その章を作るまで加入できない
 * - 'later'：ストーリーの区切りに合わせて、章の構成を決めるときに決める（それまでは加入しない）
 */
export type HeroJoin = 'start' | 'later' | { stageId: string };

export const HERO_JOIN: Record<HeroId, HeroJoin> = {
  aries: 'start',
  sagittarius: 'start',
  virgo: 'start',
  leo: 'later',
  // 第3章（2026-11-12 ユーザーの決定）：ふたご座は 3-3、おうし座は章の最後の 3-5
  taurus: { stageId: '3-5' },
  gemini: { stageId: '3-3' },
  cancer: 'later',
  // 最初の新しい仲間は第2章の最後（2-5。2026-11-07 に第2章を5ステージで作った）。緑のキャラが入り、4人目の枠が使えるようになる（2026-11-03）
  libra: { stageId: '2-5' },
  scorpio: 'later',
  capricorn: 'later',
  aquarius: 'later',
  pisces: 'later',
};

/** そのステージで加入するキャラ */
export function joinersOf(stageId: string, table: Record<HeroId, HeroJoin> = HERO_JOIN): HeroId[] {
  return ALL_HEROES.filter((id) => {
    const j = table[id];
    return typeof j === 'object' && j.stageId === stageId;
  });
}

/** 最初の編成 */
export const DEFAULT_PARTY: readonly PartyMember[] = [
  { id: 'aries', level: 1 },
  { id: 'sagittarius', level: 1 },
  { id: 'virgo', level: 1 },
];

/** 編成の人数：1〜4人（2026-11-03。仲間が3人のうちは3人まで） */
export const PARTY_MIN = 1;
export const PARTY_MAX = 4;

/**
 * キャラの呼び名。星座の英名から（2026-11-04 に会話の名前の札として決め、2026-11-12 ユーザーの要望で画面全体の表示名にした）。
 * HEROES[id].name（「いて座」など）は、呼び名に添える星座の名前として使う
 */
export const HERO_CALL_NAME: Record<HeroId, string> = {
  aries: 'アリエス',
  taurus: 'タウラス',
  gemini: 'ジェミニ',
  cancer: 'キャンサー',
  leo: 'レオ',
  virgo: 'ヴァルゴ',
  libra: 'リブラ',
  scorpio: 'スコルピオ',
  sagittarius: 'サジタリウス',
  capricorn: 'カプリコーン',
  aquarius: 'アクエリアス',
  pisces: 'ピスケス',
};

/** 文の中や読み上げで使う名前：「サジタリウス（いて座）」 */
export function heroFullName(id: HeroId): string {
  return `${HERO_CALL_NAME[id]}（${HEROES[id].name}）`;
}

/** 画面に出す名前：呼び名のあとに、小さく星座の名前を添える（HTML） */
export function heroNameHtml(id: HeroId): string {
  // 読み上げでは「サジタリウス（いて座）」になるよう、見えない括弧で区切る
  return `${HERO_CALL_NAME[id]}<small class="hn-sign"><span class="visually-hidden">（</span>${HEROES[id].name}<span class="visually-hidden">）</span></small>`;
}

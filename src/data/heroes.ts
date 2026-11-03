// キャラの設定データ（数値は仮）。12星座の性能の考え方は仕様書 12.3
import type { HeroId, OrbColor, PartyMember, SpecialShape } from '../game/types';

export interface ColorAction {
  /** 技名（表示用） */
  name: string;
  /** 消したオーブ1個あたりの基礎係数（レベル1のとき） */
  coef: number;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  /** 英名（育成・図鑑の表示用） */
  latin: string;
  /** 星座記号（テキスト表示） */
  symbol: string;
  role: 'attacker' | 'healer';
  /** パーティー最大HPへの寄与値（レベル1のとき） */
  maxHpContribution: number;
  /** 色ごとの通常効果。無い色は直接効果なし（連鎖には寄与する） */
  actions: Partial<Record<OrbColor, ColorAction>>;
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

// 攻撃キャラの色の係数：得意な色を 12、残りを 10 と 9（合計 31）にそろえる
const attack = (main: OrbColor, names: Record<'red' | 'blue' | 'green', string>, order: [OrbColor, OrbColor]) => {
  const coef: Record<string, number> = { [main]: 12, [order[0]]: 10, [order[1]]: 9 };
  return {
    red: { name: names.red, coef: coef.red },
    blue: { name: names.blue, coef: coef.blue },
    green: { name: names.green, coef: coef.green },
  };
};

export const HEROES: Record<HeroId, HeroDef> = {
  aries: {
    id: 'aries',
    name: 'おひつじ座',
    latin: 'Aries',
    symbol: '♈︎',
    role: 'attacker',
    maxHpContribution: 100,
    actions: {
      red: { name: '高威力攻撃', coef: 12 },
      // 防御低下は後のフェーズで追加する（MVP ではダメージのみ）
      blue: { name: '防御低下の一撃', coef: 9 },
      green: { name: '連続斬撃', coef: 10 },
    },
    special: { name: '炎角・紅蓮衝', color: 'red', shape: 'L', power: 140, difficulty: 'normal' },
    description: '燃える角で道を切り開く、まっすぐな剣士。',
  },
  taurus: {
    id: 'taurus',
    name: 'おうし座',
    latin: 'Taurus',
    symbol: '♉︎',
    role: 'attacker',
    maxHpContribution: 110,
    // 2026-11-03 緑から赤に（赤・青・緑・ピンクを3人ずつにそろえる）
    actions: attack('red', { red: '猛進', blue: '地鳴り', green: '大地の一撃' }, ['green', 'blue']),
    special: { name: '金牛の猛進', color: 'red', shape: 'T', power: 140, difficulty: 'normal' },
    description: '大地のように揺るがない、頼れる守り手。',
  },
  gemini: {
    id: 'gemini',
    name: 'ふたご座',
    latin: 'Gemini',
    symbol: '♊︎',
    role: 'attacker',
    maxHpContribution: 90,
    actions: attack('blue', { red: '双撃', blue: '鏡の閃き', green: '風の連携' }, ['green', 'red']),
    special: { name: '双つ星の共鳴', color: 'blue', shape: 'pillars', power: 110, difficulty: 'easy' },
    description: 'ふたりで息を合わせて戦う、いたずら好きの双子。',
  },
  cancer: {
    id: 'cancer',
    name: 'かに座',
    latin: 'Cancer',
    symbol: '♋︎',
    role: 'healer',
    maxHpContribution: 110,
    actions: { pink: { name: '月潮の癒やし', coef: 9 } },
    special: { name: '蟹甲の加護', color: 'pink', shape: 'corners', power: 120, difficulty: 'easy' },
    description: '仲間を固い甲羅のように守る、面倒見のよい癒やし手。',
  },
  leo: {
    id: 'leo',
    name: 'しし座',
    latin: 'Leo',
    symbol: '♌︎',
    role: 'attacker',
    maxHpContribution: 100,
    actions: attack('red', { red: '獅子の爪', blue: '威圧', green: '跳びかかり' }, ['green', 'blue']),
    special: { name: '獅子王の咆哮', color: 'red', shape: 'line5', power: 160, difficulty: 'hard' },
    description: '百獣の王の誇りを胸に、正面から敵を討つ。',
  },
  virgo: {
    id: 'virgo',
    name: 'おとめ座',
    latin: 'Virgo',
    symbol: '♍︎',
    role: 'healer',
    maxHpContribution: 110,
    actions: {
      pink: { name: '癒やしの光', coef: 9 },
    },
    special: { name: '聖女の祝福', color: 'pink', shape: 'square', power: 110, difficulty: 'easy' },
    description: '祈りで仲間を包む、やさしい癒やし手。',
  },
  libra: {
    id: 'libra',
    name: 'てんびん座',
    latin: 'Libra',
    symbol: '♎︎',
    role: 'attacker',
    maxHpContribution: 100,
    actions: attack('green', { red: '断罪', blue: '均衡の刃', green: '天秤の一閃' }, ['blue', 'red']),
    special: { name: '天秤の審判', color: 'green', shape: 'smallT', power: 110, difficulty: 'easy' },
    description: '何ごとも公平に量る、冷静な裁き手。',
  },
  scorpio: {
    id: 'scorpio',
    name: 'さそり座',
    latin: 'Scorpio',
    symbol: '♏︎',
    role: 'attacker',
    maxHpContribution: 90,
    actions: attack('blue', { red: '毒針', blue: '闇の一刺し', green: '忍び寄り' }, ['red', 'green']),
    special: { name: '蠍毒の尾撃', color: 'blue', shape: 'Z', power: 160, difficulty: 'hard' },
    description: '静かに狙いすまし、一撃で仕留める。',
  },
  sagittarius: {
    id: 'sagittarius',
    name: 'いて座',
    latin: 'Sagittarius',
    symbol: '♐︎',
    role: 'attacker',
    maxHpContribution: 90,
    actions: {
      red: { name: '拡散射撃', coef: 10 },
      blue: { name: '貫通射撃', coef: 11 },
      green: { name: '連射', coef: 10 },
    },
    special: { name: '天穿つ星矢', color: 'blue', shape: 'cross', power: 160, difficulty: 'hard' },
    description: '星をも射抜く、誇り高き弓の名手。',
  },
  capricorn: {
    id: 'capricorn',
    name: 'やぎ座',
    latin: 'Capricorn',
    symbol: '♑︎',
    role: 'attacker',
    maxHpContribution: 100,
    actions: attack('green', { red: '岩砕き', blue: '山風', green: '山羊の跳撃' }, ['red', 'blue']),
    special: { name: '山嶺の双角', color: 'green', shape: 'horns', power: 140, difficulty: 'normal' },
    description: '険しい山も駆け上がる、粘り強い戦士。',
  },
  aquarius: {
    id: 'aquarius',
    name: 'みずがめ座',
    latin: 'Aquarius',
    symbol: '♒︎',
    // 2026-11-03 攻撃（青）から回復役に
    role: 'healer',
    maxHpContribution: 110,
    actions: { pink: { name: '命の水', coef: 9 } },
    special: { name: '宝瓶の慈雨', color: 'pink', shape: 'line4', power: 110, difficulty: 'easy' },
    description: '水がめからあふれる清らかな水で仲間を癒やす、型にはまらない自由な賢者。',
  },
  pisces: {
    id: 'pisces',
    name: 'うお座',
    latin: 'Pisces',
    symbol: '♓︎',
    role: 'attacker',
    maxHpContribution: 100,
    actions: attack('green', { red: '紅鱗の一撃', blue: '泡の弾', green: '潮の渦' }, ['blue', 'red']),
    special: { name: '双魚の渦潮', color: 'green', shape: 'S', power: 110, difficulty: 'easy' },
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
  taurus: 'later',
  gemini: 'later',
  cancer: 'later',
  // 最初の新しい仲間は第2章の最後（第2章のステージ数は未定。5つなら 2-5）。緑のキャラが入り、4人目の枠が使えるようになる（2026-11-03）
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

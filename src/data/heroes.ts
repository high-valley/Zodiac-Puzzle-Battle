// キャラの設定データ（数値は仮）
import type { HeroId, OrbColor, SpecialShape } from '../game/types';

export interface ColorAction {
  /** 技名（表示用） */
  name: string;
  /** 消したオーブ1個あたりの基礎係数 */
  coef: number;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  /** 星座記号（テキスト表示） */
  symbol: string;
  role: 'attacker' | 'healer';
  /** パーティー最大HPへの寄与値 */
  maxHpContribution: number;
  /** 色ごとの通常効果。無い色は直接効果なし（連鎖には寄与する） */
  actions: Partial<Record<OrbColor, ColorAction>>;
  special: {
    name: string;
    color: OrbColor;
    shape: SpecialShape;
    /** 攻撃キャラはダメージ、ヒーラーは回復量 */
    power: number;
  };
}

export const HEROES: Record<HeroId, HeroDef> = {
  aries: {
    id: 'aries',
    name: 'おひつじ座',
    symbol: '♈︎',
    role: 'attacker',
    maxHpContribution: 100,
    actions: {
      red: { name: '高威力攻撃', coef: 12 },
      // 防御低下は後のフェーズで追加する（MVP ではダメージのみ）
      blue: { name: '防御低下の一撃', coef: 9 },
      green: { name: '連続斬撃', coef: 10 },
    },
    special: { name: '炎角・紅蓮衝', color: 'red', shape: 'L', power: 140 },
  },
  sagittarius: {
    id: 'sagittarius',
    name: 'いて座',
    symbol: '♐︎',
    role: 'attacker',
    maxHpContribution: 90,
    actions: {
      red: { name: '拡散射撃', coef: 10 },
      blue: { name: '貫通射撃', coef: 11 },
      green: { name: '連射', coef: 10 },
    },
    special: { name: '天穿つ星矢', color: 'blue', shape: 'cross', power: 140 },
  },
  virgo: {
    id: 'virgo',
    name: 'おとめ座',
    symbol: '♍︎',
    role: 'healer',
    maxHpContribution: 110,
    actions: {
      pink: { name: '癒やしの光', coef: 9 },
    },
    special: { name: '聖女の祝福', color: 'pink', shape: 'square', power: 110 },
  },
};

/** MVP の固定編成 */
export const PARTY: readonly HeroId[] = ['aries', 'sagittarius', 'virgo'];

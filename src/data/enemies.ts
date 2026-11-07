// 敵の設定データ（数値は仮。tools/bench.ts で計測して調整する）
// 2026-11-02 の調整の目安（1ターン3回まで回す新しいルールで、上手な自動プレイヤー skilled で150戦）：
// 1-1 勝率100%・約5ターン → 1-5 勝率約75〜80%・約14ターン。でたらめに回すと 1-1 でも勝率は1割未満
// 2026-11-04 防御力と色の弱点を入れたので、攻撃を約1.3倍、赤が弱点の敵の HP を上げた（仕様書 12.11）

import type { OrbColor } from '../game/types';

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** 毎ターンの攻撃量 */
  attack: number;
  /** 強攻撃：every ターンごとに、ふつうの攻撃の代わりに attack の量で攻撃する */
  heavy?: { every: number; attack: number };
  /**
   * お邪魔の星屑（仕様書 12.12）：every ターンごとに、敵の攻撃のあとで盤面のオーブ count 個を星屑に変える。
   * 盤面の星屑は max 個まで（それ以上はまぜない）
   */
  junk?: { every: number; count: number; max: number };
  /** 色の弱点と耐性（仕様書 12.11）。その色の仲間の攻撃（通常・必殺）が弱点なら ×1.5、耐性なら ×0.7（data/balance の WEAKNESS）。回復には効かない */
  weak?: OrbColor;
  resist?: OrbColor;
  /** 仮の見た目の色（本番の絵が届くまで） */
  tint: string;
}

export const ENEMIES: Record<string, EnemyDef> = {
  stardust: { id: 'stardust', name: '星屑のかけら', maxHp: 9800, attack: 260, weak: 'red', resist: 'green', tint: '#7fb5ff' },
  mistbeast: { id: 'mistbeast', name: '夜霧の獣', maxHp: 11200, attack: 340, weak: 'blue', resist: 'red', tint: '#8fd0c0' },
  moonwarden: {
    id: 'moonwarden',
    name: '欠けた月の番人',
    maxHp: 17000,
    attack: 340,
    heavy: { every: 3, attack: 920 },
    weak: 'red',
    resist: 'blue',
    tint: '#d8c27a',
  },
  hunter: {
    id: 'hunter',
    name: '流れ星の狩人',
    maxHp: 18200,
    attack: 440,
    heavy: { every: 3, attack: 1200 },
    weak: 'blue',
    resist: 'red',
    tint: '#ff9a76',
  },
  shadow: {
    id: 'shadow',
    name: '星喰いの影',
    maxHp: 26000,
    attack: 470,
    heavy: { every: 3, attack: 1430 },
    weak: 'red',
    resist: 'green',
    tint: '#a37cf0',
  },
  // 2026-11-07 HP・攻撃を全体に10倍にした（強さのつり合いは変えない）
  // 第2章「天秤の審判」（2026-11-07）。どの敵もお邪魔の星屑をまぜる（仕様書 12.12）。数値は仮。
  // 第1章を1回ずつクリアすると最初の3人は約レベル4。skilled・レベル4〜5・80戦で、2-1 勝率100%・約11ターン → 2-5 約93〜96%・約15〜16ターン
  // （レベルの伸びを 10% にした 2026-11-07 の値。5% のときは 2-5 約86%・約17ターン）
  falsescale: {
    id: 'falsescale',
    name: '偽りの秤',
    maxHp: 25000,
    attack: 460,
    junk: { every: 3, count: 1, max: 3 },
    weak: 'blue',
    resist: 'red',
    tint: '#c9b16a',
  },
  brokenverdict: {
    id: 'brokenverdict',
    name: '割れた裁きの像',
    maxHp: 28000,
    attack: 500,
    junk: { every: 2, count: 2, max: 4 },
    weak: 'red',
    resist: 'blue',
    tint: '#b8c2cc',
  },
  chainwarden: {
    id: 'chainwarden',
    name: '鎖の牢番',
    maxHp: 33000,
    attack: 500,
    heavy: { every: 4, attack: 1500 },
    junk: { every: 2, count: 2, max: 5 },
    weak: 'blue',
    resist: 'red',
    tint: '#8a9bb0',
  },
  irongiant: {
    id: 'irongiant',
    name: '鉄の時代の巨人',
    maxHp: 35500,
    attack: 540,
    heavy: { every: 3, attack: 1600 },
    junk: { every: 3, count: 3, max: 6 },
    weak: 'red',
    resist: 'green',
    tint: '#9c8f86',
  },
  scaleeater: {
    id: 'scaleeater',
    name: '天秤喰らい',
    maxHp: 39000,
    attack: 560,
    heavy: { every: 3, attack: 1700 },
    junk: { every: 2, count: 2, max: 6 },
    weak: 'blue',
    resist: 'green',
    tint: '#7c5cc4',
  },
};

export const DEFAULT_ENEMY_ID = 'shadow';

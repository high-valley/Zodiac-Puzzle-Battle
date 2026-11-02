// 敵の設定データ（数値は仮。tools/bench.ts で計測して調整する）
// 2026-11-02 の調整の目安（1ターン3回まで回す新しいルールで、上手な自動プレイヤー skilled で150戦）：
// 1-1 勝率100%・約5ターン → 1-5 勝率約75〜80%・約14ターン。でたらめに回すと 1-1 でも勝率は1割未満

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** 毎ターンの攻撃量 */
  attack: number;
  /** 強攻撃：every ターンごとに、ふつうの攻撃の代わりに attack の量で攻撃する */
  heavy?: { every: number; attack: number };
  /** 仮の見た目の色（本番の絵が届くまで） */
  tint: string;
}

export const ENEMIES: Record<string, EnemyDef> = {
  stardust: { id: 'stardust', name: '星屑のかけら', maxHp: 780, attack: 20, tint: '#7fb5ff' },
  mistbeast: { id: 'mistbeast', name: '夜霧の獣', maxHp: 1120, attack: 26, tint: '#8fd0c0' },
  moonwarden: {
    id: 'moonwarden',
    name: '欠けた月の番人',
    maxHp: 1480,
    attack: 26,
    heavy: { every: 3, attack: 70 },
    tint: '#d8c27a',
  },
  hunter: {
    id: 'hunter',
    name: '流れ星の狩人',
    maxHp: 1820,
    attack: 34,
    heavy: { every: 3, attack: 92 },
    tint: '#ff9a76',
  },
  shadow: {
    id: 'shadow',
    name: '星喰いの影',
    maxHp: 2100,
    attack: 36,
    heavy: { every: 3, attack: 110 },
    tint: '#a37cf0',
  },
};

export const DEFAULT_ENEMY_ID = 'shadow';

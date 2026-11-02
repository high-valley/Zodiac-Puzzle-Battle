// 敵の設定データ（数値は仮。tools/bench.ts で計測して調整する）
// 2026-11-02 の調整の目安（1手先だけ見る自動プレイヤー skilled で300戦。必殺の形を角・×字に変えたあとの値）：
// 1-1 勝率100%・約6ターン → 1-5 勝率約80%・約18ターン。でたらめに回すと 1-1 でも勝率は約2割

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
  stardust: { id: 'stardust', name: '星屑のかけら', maxHp: 480, attack: 14, tint: '#7fb5ff' },
  mistbeast: { id: 'mistbeast', name: '夜霧の獣', maxHp: 720, attack: 18, tint: '#8fd0c0' },
  moonwarden: {
    id: 'moonwarden',
    name: '欠けた月の番人',
    maxHp: 920,
    attack: 16,
    heavy: { every: 4, attack: 50 },
    tint: '#d8c27a',
  },
  hunter: {
    id: 'hunter',
    name: '流れ星の狩人',
    maxHp: 1110,
    attack: 18,
    heavy: { every: 4, attack: 60 },
    tint: '#ff9a76',
  },
  shadow: {
    id: 'shadow',
    name: '星喰いの影',
    maxHp: 1500,
    attack: 17,
    heavy: { every: 4, attack: 60 },
    tint: '#a37cf0',
  },
};

export const DEFAULT_ENEMY_ID = 'shadow';

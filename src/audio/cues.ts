// 戦闘の出来事 → 鳴らす効果音の対応（純粋な関数。鳴らし方は sound.ts）
import type { BattleEvent } from '../game/types';

export type SoundCue =
  | { name: 'select' }
  | { name: 'rotate' }
  /** step は連鎖の段数。段が進むほど音が高くなる。必殺に使ったオーブだけの消去は 0（別の音） */
  | { name: 'clear'; step: number }
  | { name: 'special' }
  | { name: 'hit'; big: boolean }
  | { name: 'heal'; big: boolean }
  /** heavy は敵の強攻撃 */
  | { name: 'hurt'; heavy: boolean }
  | { name: 'victory' }
  | { name: 'defeat' };

/** そのターンに必殺が出たか（出たターンは攻撃・回復の数値と音を大きくする） */
export function turnHasSpecial(events: readonly BattleEvent[]): boolean {
  return events.some((e) => e.type === 'special');
}

/** 出来事1つに対する効果音。specialThisTurn は turnHasSpecial の結果を渡す */
export function cueForEvent(ev: BattleEvent, specialThisTurn: boolean): SoundCue | null {
  switch (ev.type) {
    case 'rotate':
      return { name: 'rotate' };
    case 'special':
      return { name: 'special' };
    case 'clear':
      return { name: 'clear', step: ev.chain };
    case 'damage':
      return { name: 'hit', big: specialThisTurn };
    case 'heal':
      return { name: 'heal', big: specialThisTurn };
    case 'poison':
      return { name: 'hit', big: false };
    case 'rain':
      return { name: 'heal', big: false };
    case 'junk':
    case 'rock':
      return { name: 'rotate' };
    case 'enemyAttack':
      return { name: 'hurt', heavy: ev.heavy };
    case 'end':
      return { name: ev.status === 'victory' ? 'victory' : 'defeat' };
  }
}

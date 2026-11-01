// 戦闘の出来事 → 鳴らす効果音の対応（純粋な関数。鳴らし方は sound.ts）
import type { BattleEvent } from '../game/types';

export type SoundCue =
  | { name: 'select' }
  | { name: 'rotate' }
  /** step は連鎖の段数。段が進むほど音が高くなる。必殺だけの消去は 0 */
  | { name: 'clear'; step: number }
  | { name: 'special' }
  | { name: 'hit'; big: boolean }
  | { name: 'heal'; big: boolean }
  | { name: 'hurt' }
  | { name: 'victory' }
  | { name: 'defeat' };

/**
 * 出来事1つに対する効果音。
 * hit・heal は、そのターンに必殺が出ていれば強い音（big）にする
 */
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
    case 'enemyAttack':
      return { name: 'hurt' };
    case 'end':
      return { name: ev.status === 'victory' ? 'victory' : 'defeat' };
  }
}

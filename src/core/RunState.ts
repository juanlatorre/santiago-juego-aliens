// GAME STATE (GDD §39): run-scoped state, independent from Phaser rendering.
import type { WeaponId } from '../data/weapons';

export type RunPhase = 'playing' | 'boss' | 'gameover' | 'complete';

export interface RunStats {
  timeSurvived: number; // seconds
  kills: number;
  shipsStolen: number;
  shipsDestroyed: number; // player's ships lost
  weaponUses: Record<string, number>; // shots per weapon id
  bossDefeated: boolean;
}

export class RunState {
  phase: RunPhase = 'playing';
  elapsed = 0; // seconds since run start
  stats: RunStats = {
    timeSurvived: 0,
    kills: 0,
    shipsStolen: 0,
    shipsDestroyed: 0,
    weaponUses: {},
    bossDefeated: false,
  };
  // Player control mode (GDD §2.2): on foot vs inside a ship.
  playerMode: 'foot' | 'ship' = 'foot';
  shipId: number | null = null; // id of the player-controlled ship, if any

  recordShot(weapon: WeaponId): void {
    this.stats.weaponUses[weapon] = (this.stats.weaponUses[weapon] ?? 0) + 1;
  }

  mostUsedWeapon(): WeaponId | null {
    let best: WeaponId | null = null;
    let bestCount = 0;
    for (const [id, count] of Object.entries(this.stats.weaponUses)) {
      if (count > bestCount) {
        best = id as WeaponId;
        bestCount = count;
      }
    }
    return best;
  }
}

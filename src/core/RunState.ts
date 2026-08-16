// GAME STATE (GDD §39): run-scoped state, independent from Phaser rendering.
import type { WeaponId } from "../data/weapons";

export type RunPhase = "playing" | "boss" | "gameover" | "complete";

export interface RunStats {
  timeSurvived: number; // seconds
  kills: number;
  shipsStolen: number;
  shipsDestroyed: number; // player's ships lost
  weaponUses: Record<string, number>; // shots per weapon id
  bossDefeated: boolean;
  score: number; // run score (GDD §33)
  maxCombo: number; // highest kill-streak multiplier reached
}

// Kill streak window: a kill refreshes it; it expires and the combo resets.
export const COMBO_WINDOW_MS = 3500;

export class RunState {
  phase: RunPhase = "playing";
  elapsed = 0; // seconds since run start
  stats: RunStats = {
    timeSurvived: 0,
    kills: 0,
    shipsStolen: 0,
    shipsDestroyed: 0,
    weaponUses: {},
    bossDefeated: false,
    score: 0,
    maxCombo: 0,
  };
  // Player control mode (GDD §2.2): on foot vs inside a ship.
  playerMode: "foot" | "ship" = "foot";
  shipId: number | null = null; // id of the player-controlled ship, if any
  combo = 0; // current kill streak (0 = none)
  comboUntil = 0; // scene time ms — combo expires after COMBO_WINDOW_MS
  scoreMult = 1; // difficulty score multiplier (GDD §22), set by the scene
  powerUps: Record<string, number> = {}; // PowerUpKind → expiry (scene ms)

  grantPower(kind: string, now: number): void {
    this.powerUps[kind] = now + 10000;
  }

  hasPower(kind: string, now: number): boolean {
    return (this.powerUps[kind] ?? 0) > now;
  }

  /** Kinds still active at `now`; expired entries are pruned. */
  activePowerUps(now: number): string[] {
    const active: string[] = [];
    for (const [k, until] of Object.entries(this.powerUps)) {
      if (until > now) active.push(k);
      else delete this.powerUps[k];
    }
    return active;
  }

  recordShot(weapon: WeaponId): void {
    this.stats.weaponUses[weapon] = (this.stats.weaponUses[weapon] ?? 0) + 1;
  }

  /** A kill: adds baseScore × combo multiplier (x1..x5) and extends the streak. */
  noteKill(now: number, baseScore: number): void {
    const mult = 1 + Math.min(4, this.combo);
    this.combo++;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    this.comboUntil = now + COMBO_WINDOW_MS;
    this.stats.score += Math.round(baseScore * mult * this.scoreMult);
  }

  /** Flat score (ships stolen, boss, ...) without touching the combo. */
  addScore(base: number): void {
    this.stats.score += Math.round(base * this.scoreMult);
  }

  /** Taking damage breaks the streak. */
  resetCombo(): void {
    this.combo = 0;
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

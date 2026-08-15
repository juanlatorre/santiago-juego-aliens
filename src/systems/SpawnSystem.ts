// SPAWN SYSTEM (GDD §22): time-based difficulty ramp and enemy spawning.
import Phaser from 'phaser';
import { TIERS, type DifficultyTier, type EnemyKind } from '../data/enemies';import type { EnemyActor, EnemySystem } from './EnemySystem';
import type { ShipActor, ShipSystem } from './ShipSystem';
import type { ObstacleDef } from '../data/level';
import { ARENA_WIDTH, ARENA_HEIGHT, BOSS_ARENA_MAX_Y } from '../config';

export interface SpawnWorld {
  getPlayer(): { x: number; y: number };
  getElapsedSeconds: () => number;
  enemies: EnemyActor[];
  ships: ShipActor[];
  obstacles: ObstacleDef[];
  bossActive: () => boolean;
}

export class SpawnSystem {
  private world: SpawnWorld;
  private enemies: EnemySystem;
  private ships: ShipSystem;
  private nextSpawnAt = 0;
  private nextShipAt = 0;
  private shipSpawnIntervalMs = 24000;

  constructor(world: SpawnWorld, enemies: EnemySystem, ships: ShipSystem) {
    this.world = world;
    this.enemies = enemies;
    this.ships = ships;
  }

  tier(): DifficultyTier {
    const minutes = this.elapsedMinutes();
    let t = TIERS[0];
    for (const tier of TIERS) {
      if (minutes >= tier.min) t = tier;
    }
    return t;
  }

  elapsedMinutes(): number {
    return this.world.getElapsedSeconds() / 60;
  }

  update(now: number): void {
    const tier = this.tier();
    if (now >= this.nextSpawnAt) {
      this.nextSpawnAt = now + tier.spawnInterval * 1000;
      this.trySpawnEnemy(tier);
    }
    // Enemy ships fly in from the later tiers (GDD §22: 6–8 min Scout Ships, 8+ Bomber).
    if (now >= this.nextShipAt) {
      this.nextShipAt = now + this.shipSpawnIntervalMs;
      const scouts = this.world.ships.filter((s) => s.kind === 'scout' && !s.parked && s.state === 'ENEMY').length;
      const bombers = this.world.ships.filter((s) => s.kind === 'bomber' && !s.parked && s.state === 'ENEMY').length;
      if (scouts < tier.enemyScoutCap) {
        const pos = this.pickSpawnPos(320, false);
        if (pos) this.ships.spawnShip('scout', pos.x, pos.y, false);
      } else if (bombers < tier.enemyBomberCap) {
        const pos = this.pickSpawnPos(320, false);
        if (pos) this.ships.spawnShip('bomber', pos.x, pos.y, false);
      }
    }
  }

  private trySpawnEnemy(tier: DifficultyTier): void {
    const counts: Record<EnemyKind, number> = { grunt: 0, charger: 0, gunner: 0 };
    for (const e of this.world.enemies) if (e.alive) counts[e.kind]++;
    const allowed: EnemyKind[] = [];
    if (counts.grunt < tier.gruntCap) allowed.push('grunt');
    if (tier.chargerCap > 0 && counts.charger < tier.chargerCap) allowed.push('charger');
    if (tier.gunnerCap > 0 && counts.gunner < tier.gunnerCap) allowed.push('gunner');
    if (allowed.length === 0) return;
    const kind = allowed[Math.floor(Math.random() * allowed.length)];
    const pos = this.pickSpawnPos(270, true);
    if (!pos) return;
    const elite = tier.elites && Math.random() < 0.22;
    this.enemies.spawnEnemy(kind, pos.x, pos.y, { elite });
  }

  /** Random position around the player, biased upward (GDD §10), with obstacle clearance. */
  pickSpawnPos(minDist: number, biasUp: boolean): { x: number; y: number } | null {
    const p = this.world.getPlayer();
    for (let attempt = 0; attempt < 10; attempt++) {
      const upper = biasUp && Math.random() < 0.55;
      const a = upper
        ? Math.PI + Math.random() * Math.PI // top half (screen up = -y)
        : Math.random() * Math.PI * 2;
      const r = minDist + Math.random() * 70;
      const x = Phaser.Math.Clamp(p.x + Math.cos(a) * r, 30, ARENA_WIDTH - 30);
      let y = Phaser.Math.Clamp(p.y + Math.sin(a) * r, 40, ARENA_HEIGHT - 40);
      if (this.world.bossActive() && y < BOSS_ARENA_MAX_Y + 160) y = BOSS_ARENA_MAX_Y + 160;
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < minDist * 0.55) continue;
      if (this.overlapsObstacle(x, y, 16)) continue;
      return { x, y };
    }
    return null;
  }

  private overlapsObstacle(x: number, y: number, pad: number): boolean {
    for (const o of this.world.obstacles) {
      if (x > o.x - o.w / 2 - pad && x < o.x + o.w / 2 + pad && y > o.y - o.h / 2 - pad && y < o.y + o.h / 2 + pad) {
        return true;
      }
    }
    return false;
  }
}

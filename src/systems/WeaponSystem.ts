// WEAPON SYSTEM (GDD §39): firing cadence for player, ships and enemies.
// Pure logic over the declarative WeaponDef data — no rendering here.
import { WEAPONS, type WeaponDef, type WeaponId } from '../data/weapons';
import { playSound } from '../core/audio';
import type { CombatSystem } from './CombatSystem';
import type { Fx } from '../core/fx';

interface ShooterState {
  nextShotAt: number;
  burstRemaining: number;
  nextBurstAt: number;
}

export class WeaponSystem {
  private states = new Map<number, ShooterState>();
  private combat: CombatSystem;
  private fx: Fx;
  private recordShot: ((w: WeaponId) => void) | null = null;

  constructor(combat: CombatSystem, fx: Fx) {
    this.combat = combat;
    this.fx = fx;
  }

  setShotRecorder(record: (w: WeaponId) => void): void {
    this.recordShot = record;
  }

  private state(id: number): ShooterState {
    let s = this.states.get(id);
    if (!s) {
      s = { nextShotAt: 0, burstRemaining: 0, nextBurstAt: 0 };
      this.states.set(id, s);
    }
    return s;
  }

  /**
   * Continuous firing (player on foot / player-controlled ship).
   * Returns true when a shot was actually fired this frame.
   */
  tryFire(
    shooterId: number,
    x: number,
    y: number,
    angle: number,
    weapon: WeaponId,
    team: 'player' | 'enemy',
    now: number,
  ): boolean {
    const def = WEAPONS[weapon];
    const s = this.state(shooterId);
    if (now < s.nextShotAt) return false;
    s.nextShotAt = now + 1000 / def.fireRate;
    this.fireWeapon(x, y, angle, def, team);
    if (team === 'player' && this.recordShot) this.recordShot(weapon);
    return true;
  }

  /**
   * Enemy burst firing (Gunner). Manages burst chains and cooldowns.
   */
  enemyShoot(
    enemyId: number,
    x: number,
    y: number,
    angle: number,
    weapon: NonNullable<import('../data/enemies').EnemyDef['weapon']>,
    team: 'enemy',
    now: number,
  ): void {
    const s = this.state(enemyId);
    if (now < s.nextBurstAt) return;
    if (s.burstRemaining > 0 && now >= s.nextShotAt) {
      this.combat.spawnProjectile(
        x, y, angle + (Math.random() - 0.5) * 0.22,
        {
          damage: weapon.damage,
          projectileSpeed: weapon.projectileSpeed,
          projectileKey: 'proj_enemy',
          projectileRadius: 4,
          life: 1.4,
        },
        team,
      );
      s.burstRemaining--;
      s.nextShotAt = now + (weapon.burstGapMs ?? 200);
      playSound('pistol');
      return;
    }
    if (s.burstRemaining === 0) {
      const burst = weapon.burst ?? 1;
      s.burstRemaining = burst;
      s.nextBurstAt = now + (weapon.burstCooldownMs ?? 1000 / weapon.fireRate);
      s.nextShotAt = now;
    }
  }

  /**
   * Fire a single weapon def from a position (used by ships and boss).
   */
  fireWeapon(
    x: number,
    y: number,
    angle: number,
    def: WeaponDef,
    team: 'player' | 'enemy',
  ): void {
    const pellets = def.pellets ?? 1;
    for (let i = 0; i < pellets; i++) {
      const offset = pellets === 1 ? 0 : (i / (pellets - 1) - 0.5) * def.spread;
      const a = angle + offset;
      const parallel = def.parallel ?? 1;
      for (let p = 0; p < parallel; p++) {
        const gap = def.parallelGap ?? 0;
        const perp = p === 0 ? 0 : p % 2 === 0 ? (p / 2) * gap : -((p + 1) / 2) * gap;
        const ox = Math.cos(a + Math.PI / 2) * perp;
        const oy = Math.sin(a + Math.PI / 2) * perp;
        this.combat.spawnProjectile(
          x + ox,
          y + oy,
          a,
          {
            damage: def.damage,
            projectileSpeed: def.projectileSpeed,
            projectileKey: def.projectileKey,
            projectileRadius: def.projectileRadius,
            life: def.life,
            knockback: def.knockback ?? 0,
          },
          team,
        );
      }
    }
    // Muzzle flash + sound feedback (GDD §30).
    this.fx.muzzleFlash(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, angle);
    playSound(def.sound);
  }
}

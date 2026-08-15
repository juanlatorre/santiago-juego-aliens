// COMBAT SYSTEM (GDD §14, §39): projectiles, damage, deaths, weapon drops.
import Phaser from 'phaser';
import { allocId, type Actor, type Projectile, type WeaponDrop } from '../core/types';
import type { Fx } from '../core/fx';
import { playSound } from '../core/audio';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { EnemyActor } from './EnemySystem';
import type { ShipActor } from './ShipSystem';
import type { BossActor, BossSystem } from './BossSystem';

export interface ProjectileSpawnDef {
  damage: number;
  projectileSpeed: number;
  projectileKey: string;
  projectileRadius: number;
  life: number;
  knockback?: number;
}

export interface CombatWorld {
  scene: Phaser.Scene;
  player: Actor;
  enemies: EnemyActor[];
  ships: ShipActor[];
  getBossSystem: () => BossSystem | null;
  onEnemyKilled: (e: EnemyActor) => void;
  onShipDestroyed: (ship: ShipActor, x: number, y: number) => void;
  onBossHit: (boss: BossActor, dmg: number, hitCore: boolean) => void;
  onPlayerHit: (dmg: number, fromX: number, fromY: number) => void;
  onPilotNeutralized: (ship: ShipActor) => void;
}

export class CombatSystem {
  projectiles: Projectile[] = [];
  drops: WeaponDrop[] = [];
  private group: Phaser.Physics.Arcade.Group;
  private world: CombatWorld;
  private fx: Fx;
  private nextDropId = 1;

  constructor(world: CombatWorld, walls: Phaser.Physics.Arcade.StaticGroup, fx: Fx) {
    this.world = world;
    this.fx = fx;
    this.group = world.scene.physics.add.group();
    // Projectiles die against solid obstacles (GDD §27).
    world.scene.physics.add.overlap(this.group, walls, (obj) => {
      const sprite = obj as Phaser.GameObjects.Sprite;
      const p = this.projectiles.find((q) => q.sprite === sprite);
      if (p && !p.dead) {
        p.dead = true;
        this.fx.burst(p.sprite.x, p.sprite.y, 0x9fb0c8, 3, 60, 160, 0.5);
      }
    });
  }

  spawnProjectile(
    x: number,
    y: number,
    angle: number,
    def: ProjectileSpawnDef,
    team: 'player' | 'enemy',
  ): void {
    const sprite = this.group.create(x, y, def.projectileKey) as Phaser.GameObjects.Sprite;
    sprite.setAngle((angle * 180) / Math.PI + 90);
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(def.projectileRadius);
    sprite.setDepth(8);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * def.projectileSpeed, Math.sin(angle) * def.projectileSpeed);
    this.projectiles.push({
      id: allocId(),
      team,
      sprite,
      body,
      damage: def.damage,
      knockback: def.knockback ?? 0,
      lifeMs: def.life * 1000,
      dead: false,
      hitIds: new Set(),
      radius: def.projectileRadius,
    });
  }

  update(dtMs: number, now: number): void {
    const { player } = this.world;
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.lifeMs -= dtMs;
      if (p.lifeMs <= 0) {
        p.dead = true;
        continue;
      }
      const x = p.sprite.x;
      const y = p.sprite.y;

      // --- vs player (enemy fire) ---
      if (p.team === 'enemy' && !p.hitIds.has(player.id)) {
        const pr = player.sprite.displayWidth / 2 - 4;
        if (Phaser.Math.Distance.Between(x, y, player.sprite.x, player.sprite.y) < pr + p.radius) {
          p.hitIds.add(player.id);
          p.dead = true;
          this.hitPlayer(p, x, y);
          continue;
        }
      }

      // --- vs enemies (player fire) ---
      if (p.team === 'player') {
        for (const e of this.world.enemies) {
          if (!e.alive || p.hitIds.has(e.id)) continue;
          if (Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y) < e.def.radius + p.radius) {
            p.hitIds.add(e.id);
            p.dead = true;
            this.hitEnemy(e, p, now);
            break;
          }
        }
        if (p.dead) continue;
        // --- vs ships (player fire): pilot cockpit first, hull second (GDD §18) ---
        for (const s of this.world.ships) {
          if (s.state === 'DESTROYED' || s.team === 'player' || p.hitIds.has(s.id)) continue;
          if (Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y) > s.def.radius + p.radius + 6) continue;
          p.hitIds.add(s.id);
          p.dead = true;
          const pilotRadius = s.def.radius * 0.55;
          if (s.state === 'ENEMY' && s.pilotHp > 0 &&
            Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y) <= pilotRadius) {
            this.hitPilot(s, p.damage, now);
          } else {
            this.hitShipHull(s, p.damage, now);
          }
          break;
        }
        if (p.dead) continue;
        // --- vs boss (player fire): weak core = full damage (GDD §23) ---
        const bs = this.world.getBossSystem();
        const boss = bs?.boss ?? null;
        if (boss && boss.alive) {
          const core = bs!.coreWorld();
          const distCore = Phaser.Math.Distance.Between(x, y, core.x, core.y);
          const distHull = Phaser.Math.Distance.Between(x, y, boss.sprite.x, boss.sprite.y);
          if (distCore < boss.def.coreRadius + p.radius) {
            p.hitIds.add(boss.id);
            p.dead = true;
            this.hitBoss(boss, p.damage, true, now);
          } else if (distHull < boss.radius + p.radius) {
            p.hitIds.add(boss.id);
            p.dead = true;
            this.hitBoss(boss, p.damage * boss.def.hullDamageMult, false, now);
          }
        }
        if (p.dead) continue;
        // --- vs player-controlled ship (enemy fire) handled below ---
      } else {
        // Enemy fire vs player-controlled ship
        for (const s of this.world.ships) {
          if (s.state !== 'PLAYER_CONTROLLED' || p.hitIds.has(s.id)) continue;
          if (Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y) < s.def.radius + p.radius) {
            p.hitIds.add(s.id);
            p.dead = true;
            this.hitShipHull(s, p.damage, now);
            break;
          }
        }
      }
    }

    // Cleanup dead projectiles + drops bob handled by scene; remove here:
    for (const p of this.projectiles) {
      if (p.dead) {
        p.sprite.destroy();
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  private hitPlayer(p: Projectile, x: number, y: number): void {
    this.fx.burst(x, y, 0xff5577, 6, 90, 260);
    this.world.onPlayerHit(p.damage, x, y);
  }

  private hitEnemy(e: EnemyActor, p: Projectile, now: number): void {
    if (now < e.invulnUntil) return;
    e.hp -= p.damage;
    e.flashUntil = now + 120;
    this.fx.burst(p.sprite.x, p.sprite.y, 0xffd25f, 5, 80, 220);
    playSound(e.def.hitSound);
    if (p.knockback > 0) {
      const a = Math.atan2(p.sprite.y - e.sprite.y, p.sprite.x - e.sprite.x);
      e.body.velocity.x += Math.cos(a) * p.knockback;
      e.body.velocity.y += Math.sin(a) * p.knockback;
    }
    if (e.hp <= 0) {
      e.alive = false;
      this.world.onEnemyKilled(e);
    }
  }

  private hitPilot(s: ShipActor, dmg: number, now: number): void {
    s.pilotHp -= dmg;
    s.pilotFlashUntil = now + 120;
    this.fx.burst(s.sprite.x, s.sprite.y, 0xff5577, 6, 100, 260);
    playSound('hit');
    if (s.pilotHp <= 0) {
      s.pilotHp = 0;
      // Pilot neutralized → ship becomes stealable (GDD §18).
      this.world.onPilotNeutralized(s);
    }
  }

  private hitShipHull(s: ShipActor, dmg: number, now: number): void {
    if (now < s.invulnUntil) return;
    s.hp -= dmg;
    s.flashUntil = now + 120;
    this.fx.burst(s.sprite.x, s.sprite.y, 0xff9a4f, 5, 90, 240, 0.7);
    playSound('heavyHit');
    if (s.hp <= 0) {
      s.hp = 0;
      s.alive = false;
      this.world.onShipDestroyed(s, s.sprite.x, s.sprite.y);
    }
  }

  private hitBoss(b: BossActor, dmg: number, hitCore: boolean, now: number): void {
    if (now < b.invulnUntil) return;
    b.hp -= dmg;
    b.flashUntil = now + 90;
    b.coreFlashUntil = hitCore ? now + 200 : b.coreFlashUntil;
    this.fx.burst(b.sprite.x, b.sprite.y, hitCore ? 0x48e0ff : 0xff9a4f, hitCore ? 8 : 4, 110, 280);
    playSound('heavyHit');
    this.world.onBossHit(b, dmg, hitCore);
  }

  /** Roll the drop table when an enemy dies (GDD §15 Drops). */
  rollDrop(e: EnemyActor): WeaponId | null {
    const mult = e.elite ? 1.8 : 1;
    for (const entry of e.def.dropTable) {
      if (Math.random() < Math.min(1, entry.chance * mult)) return entry.weapon;
    }
    return null;
  }

  spawnDrop(x: number, y: number, weaponId: WeaponId): WeaponDrop {
    const sprite = this.world.scene.physics.add.sprite(x, y, 'drop_glow');
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(10);
    sprite.setDepth(3);
    sprite.setScale(1.6);
    const drop: WeaponDrop = {
      id: this.nextDropId++,
      weaponId,
      sprite,
      body: sprite.body as Phaser.Physics.Arcade.Body,
      x,
      y,
      taken: false,
      bobT: Math.random() * 10,
    };
    // draw the weapon icon as a child label
    const label = this.world.scene.add.text(x, y - 2, WEAPONS[weaponId].icon, {
      fontFamily: 'monospace',
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(4);
    label.setStroke('#000000', 3);
    drop.sprite.setData('label', label);
    this.drops.push(drop);
    return drop;
  }

  removeDrop(drop: WeaponDrop): void {
    drop.taken = true;
    drop.sprite.destroy();
    const label = drop.sprite.getData('label') as Phaser.GameObjects.Text | null;
    label?.destroy();
  }

  /** Accessor for spawn-time definitions. */
  static defs(): typeof WEAPONS {
    return WEAPONS;
  }
}

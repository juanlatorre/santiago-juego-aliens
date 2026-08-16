// COMBAT SYSTEM (GDD §14, §39): projectiles, damage, deaths, weapon drops.
import Phaser from "phaser";
import {
  allocId,
  type Actor,
  type Drop,
  type MedkitDrop,
  type PowerUpDrop,
  type Projectile,
  type ShieldDrop,
  type WeaponDrop,
} from "../core/types";
import { POWERUPS, type PowerUpKind } from "../core/powerups";
import type { Fx } from "../core/fx";
import { playSound } from "../core/audio";
import { playerDamageMult } from "../core/difficulty";
import { WEAPONS, type WeaponId } from "../data/weapons";
import type { EnemyActor } from "./EnemySystem";
import type { ShipActor } from "./ShipSystem";
import type { BossActor, BossSystem } from "./BossSystem";

export interface ProjectileSpawnDef {
  damage: number;
  projectileSpeed: number;
  projectileKey: string;
  projectileRadius: number;
  life: number;
  knockback?: number;
  pierce?: boolean; // railgun: passes through enemies (GDD §15.5)
  homing?: boolean; // missile: steers toward the nearest enemy (GDD §15.6)
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
  drops: Drop[] = [];
  private group: Phaser.Physics.Arcade.Group;
  private world: CombatWorld;
  private fx: Fx;
  private nextDropId = 1;

  constructor(
    world: CombatWorld,
    walls: Phaser.Physics.Arcade.StaticGroup,
    fx: Fx,
  ) {
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
    team: "player" | "enemy",
  ): void {
    const sprite = this.group.create(
      x,
      y,
      def.projectileKey,
    ) as Phaser.GameObjects.Sprite;
    sprite.setAngle((angle * 180) / Math.PI + 90);
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(def.projectileRadius);
    sprite.setDepth(8);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(
      Math.cos(angle) * def.projectileSpeed,
      Math.sin(angle) * def.projectileSpeed,
    );
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
      pierce: def.pierce ?? false,
      homing: def.homing ?? false,
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

      // --- homing (player missiles, GDD §15.6): steer toward the nearest
      // alive enemy, capped turn rate so it can be dodged.
      if (p.homing && p.team === "player") {
        let tx: number | null = null;
        let ty = 0;
        let bd = Infinity;
        for (const e of this.world.enemies) {
          if (!e.alive || p.hitIds.has(e.id)) continue;
          const d = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
          if (d < bd) {
            bd = d;
            tx = e.sprite.x;
            ty = e.sprite.y;
          }
        }
        if (tx !== null) {
          const cur = Math.atan2(p.body.velocity.y, p.body.velocity.x);
          const want = Math.atan2(ty - y, tx - x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = 5.2 * (dtMs / 1000);
          const na = cur + Math.max(-turn, Math.min(turn, diff));
          const sp = Math.hypot(p.body.velocity.x, p.body.velocity.y) || 1;
          p.body.setVelocity(Math.cos(na) * sp, Math.sin(na) * sp);
          p.sprite.setAngle((na * 180) / Math.PI + 90);
        }
      }

      // --- vs player (enemy fire) ---
      // body.enable is false while flying a stolen ship: the hidden player
      // must not absorb stray shots at the boarding spot (GDD §18).
      if (
        p.team === "enemy" &&
        player.body.enable &&
        !p.hitIds.has(player.id)
      ) {
        const pr = player.sprite.displayWidth / 2 - 4;
        if (
          Phaser.Math.Distance.Between(x, y, player.sprite.x, player.sprite.y) <
          pr + p.radius
        ) {
          p.hitIds.add(player.id);
          p.dead = true;
          this.hitPlayer(p, x, y);
          continue;
        }
      }

      // --- vs enemies (player fire) ---
      if (p.team === "player") {
        for (const e of this.world.enemies) {
          if (!e.alive || p.hitIds.has(e.id)) continue;
          if (
            Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y) <
            e.def.radius + p.radius
          ) {
            p.hitIds.add(e.id);
            // Piercing shots (railgun) keep flying and hit everything in the
            // line; hitIds prevents hitting the same enemy twice (GDD §15.5).
            if (!p.pierce) p.dead = true;
            this.hitEnemy(e, p, now);
            if (p.homing) {
              // Missile impact: bigger fireball (GDD §15.6).
              this.fx.burst(
                p.sprite.x,
                p.sprite.y,
                0xff9a4f,
                10,
                120,
                380,
                0.8,
              );
            }
            break;
          }
        }
        if (p.dead) continue;
        // --- vs ships (player fire): pilot cockpit first, hull second (GDD §18) ---
        for (const s of this.world.ships) {
          if (
            s.state === "DESTROYED" ||
            s.team === "player" ||
            p.hitIds.has(s.id)
          )
            continue;
          if (
            Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y) >
            s.def.radius + p.radius + 6
          )
            continue;
          p.hitIds.add(s.id);
          p.dead = true;
          if (s.state === "ENEMY" && s.pilotHp > 0) {
            // Crewed ship: any hit neutralizes the pilot (GDD §18). The whole
            // ship is the cockpit — projectiles stop at the hull edge, so a
            // small center-only hitbox was geometrically unreachable and
            // ships just exploded instead of becoming stealable.
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
          const distHull = Phaser.Math.Distance.Between(
            x,
            y,
            boss.sprite.x,
            boss.sprite.y,
          );
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
          if (s.state !== "PLAYER_CONTROLLED" || p.hitIds.has(s.id)) continue;
          if (
            Phaser.Math.Distance.Between(x, y, s.sprite.x, s.sprite.y) <
            s.def.radius + p.radius
          ) {
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
    const dmg = Math.round(p.damage * playerDamageMult()); // difficulty
    e.hp -= dmg;
    e.flashUntil = now + 120;
    this.fx.burst(p.sprite.x, p.sprite.y, 0xffd25f, 5, 80, 220);
    this.fx.floatText(e.sprite.x, e.sprite.y - 14, String(dmg), "#ffd25f");
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
    this.fx.floatText(s.sprite.x, s.sprite.y - 12, String(dmg), "#ffffff");
    playSound("hit");
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
    this.fx.floatText(s.sprite.x, s.sprite.y - 18, String(dmg), "#ff9a4f");
    playSound("heavyHit");
    if (s.hp <= 0) {
      s.hp = 0;
      s.alive = false;
      this.world.onShipDestroyed(s, s.sprite.x, s.sprite.y);
    }
  }

  private hitBoss(
    b: BossActor,
    dmg: number,
    hitCore: boolean,
    now: number,
  ): void {
    if (now < b.invulnUntil) return;
    b.hp -= dmg;
    b.flashUntil = now + 90;
    b.coreFlashUntil = hitCore ? now + 200 : b.coreFlashUntil;
    const dealt = Math.round(dmg * playerDamageMult()); // difficulty
    b.hp -= dealt;
    this.fx.burst(
      b.sprite.x,
      b.sprite.y,
      hitCore ? 0x48e0ff : 0xff9a4f,
      hitCore ? 8 : 4,
      110,
      280,
    );
    this.fx.floatText(
      b.sprite.x,
      b.sprite.y - 22,
      String(dealt),
      hitCore ? "#48e0ff" : "#ff9a4f",
    );
    playSound("heavyHit");
    this.world.onBossHit(b, dmg, hitCore);
  }

  /** Roll the drop table when an enemy dies (GDD §15 Drops). */
  rollDrop(e: EnemyActor): WeaponId | "shield" | "medkit" | PowerUpKind | null {
    const mult = e.elite ? 1.8 : 1;
    for (const entry of e.def.dropTable) {
      if (Math.random() < Math.min(1, entry.chance * mult)) {
        if (entry.kind === "weapon") return entry.weapon;
        if (entry.kind === "shield") return "shield";
        if (entry.kind === "medkit") return "medkit";
        return entry.powerUp;
      }
    }
    return null;
  }

  spawnDrop(x: number, y: number, weaponId: WeaponId): WeaponDrop {
    const sprite = this.world.scene.physics.add.sprite(x, y, "drop_glow");
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(10);
    sprite.setDepth(3);
    sprite.setScale(1.6);
    const drop: WeaponDrop = {
      id: this.nextDropId++,
      kind: "weapon",
      weaponId,
      sprite,
      body: sprite.body as Phaser.Physics.Arcade.Body,
      x,
      y,
      taken: false,
      bobT: Math.random() * 10,
    };
    // draw the weapon icon as a child label
    const label = this.world.scene.add
      .text(x, y - 2, WEAPONS[weaponId].icon, {
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(4);
    label.setStroke("#000000", 3);
    drop.sprite.setData("label", label);
    this.drops.push(drop);
    return drop;
  }

  /** Shield pickup (GDD §16 Drops): grants the player absorb HP. */
  spawnShieldDrop(x: number, y: number): ShieldDrop {
    const sprite = this.world.scene.physics.add.sprite(x, y, "drop_shield");
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(10);
    sprite.setDepth(3);
    sprite.setScale(1.6);
    const drop: ShieldDrop = {
      id: this.nextDropId++,
      kind: "shield",
      sprite,
      body: sprite.body as Phaser.Physics.Arcade.Body,
      x,
      y,
      taken: false,
      bobT: Math.random() * 10,
    };
    const label = this.world.scene.add
      .text(x, y - 2, "🛡", {
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(4);
    label.setStroke("#000000", 3);
    drop.sprite.setData("label", label);
    this.drops.push(drop);
    return drop;
  }

  /** Medkit pickup (GDD §16 Drops): heals the player. */
  spawnMedkitDrop(x: number, y: number): MedkitDrop {
    const sprite = this.world.scene.physics.add.sprite(x, y, "drop_medkit");
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(10);
    sprite.setDepth(3);
    sprite.setScale(1.6);
    const drop: MedkitDrop = {
      id: this.nextDropId++,
      kind: "medkit",
      sprite,
      body: sprite.body as Phaser.Physics.Arcade.Body,
      x,
      y,
      taken: false,
      bobT: Math.random() * 10,
    };
    const label = this.world.scene.add
      .text(x, y - 2, "✚", {
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(4);
    label.setStroke("#000000", 3);
    drop.sprite.setData("label", label);
    this.drops.push(drop);
    return drop;
  }

  /** Power-up pickup (GDD §24-lite): grants a temporary buff. */
  spawnPowerUpDrop(x: number, y: number, powerUp: PowerUpKind): PowerUpDrop {
    const sprite = this.world.scene.physics.add.sprite(x, y, "drop_powerup");
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(10);
    sprite.setDepth(3);
    sprite.setScale(1.6);
    const drop: PowerUpDrop = {
      id: this.nextDropId++,
      kind: "powerup",
      powerUp,
      sprite,
      body: sprite.body as Phaser.Physics.Arcade.Body,
      x,
      y,
      taken: false,
      bobT: Math.random() * 10,
    };
    const label = this.world.scene.add
      .text(x, y - 2, POWERUPS[powerUp].icon, {
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(4);
    label.setStroke("#000000", 3);
    drop.sprite.setData("label", label);
    this.drops.push(drop);
    return drop;
  }

  removeDrop(drop: Drop): void {
    drop.taken = true;
    // Read the label BEFORE destroying the sprite — getData() on a destroyed
    // GameObject returns undefined, which leaked the floating weapon icon.
    const label = drop.sprite.getData(
      "label",
    ) as Phaser.GameObjects.Text | null;
    drop.sprite.destroy();
    label?.destroy();
    const idx = this.drops.indexOf(drop);
    if (idx >= 0) this.drops.splice(idx, 1);
  }

  /** Accessor for spawn-time definitions. */
  static defs(): typeof WEAPONS {
    return WEAPONS;
  }
}

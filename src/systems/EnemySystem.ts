// ENEMY SYSTEM (GDD §16, §39): enemy AI — Grunt, Charger, Gunner.
import Phaser from "phaser";
import { allocId, type Actor } from "../core/types";
import { enemyHpMult } from "../core/difficulty";
import {
  ENEMIES,
  ELITE_HP_MULT,
  type EnemyDef,
  type EnemyKind,
} from "../data/enemies";
import type { WeaponSystem } from "./WeaponSystem";
import { playSound } from "../core/audio";

export type EnemyAiState =
  | "approach"
  | "strafe"
  | "telegraph"
  | "dash"
  | "stun";

export interface EnemyActor extends Actor {
  kind: EnemyKind;
  def: EnemyDef;
  elite: boolean;
  summoned: boolean; // spawned by the boss
  aiState: EnemyAiState;
  stateUntil: number;
  dashDirX: number;
  dashDirY: number;
  dashHit: boolean;
  strafeDir: number;
  strafeFlipAt: number;
  shakeT: number;
  contactAt: number; // brute body-contact cooldown (scene ms)
}

export interface EnemyWorld {
  scene: Phaser.Scene;
  getPlayer(): {
    x: number;
    y: number;
    alive: boolean;
    radius: number;
    vulnerable: boolean; // false while flying a ship (body hidden)
  };
  onChargerContact: (e: EnemyActor, dmg: number) => void;
  /** Kamikaze blew up on the player: FX + score/drops + removal (GDD §16.5). */
  onKamikazeBlow: (e: EnemyActor) => void;
}

export class EnemySystem {
  enemies: EnemyActor[];
  private world: EnemyWorld;
  private weapons: WeaponSystem;

  constructor(
    world: EnemyWorld,
    weapons: WeaponSystem,
    enemies: EnemyActor[] = [],
  ) {
    this.world = world;
    this.weapons = weapons;
    this.enemies = enemies;
  }

  spawnEnemy(
    kind: EnemyKind,
    x: number,
    y: number,
    opts?: { elite?: boolean; summoned?: boolean },
  ): EnemyActor {
    const def = ENEMIES[kind];
    const elite = opts?.elite ?? false;
    const scene = this.world.scene;
    const sprite = scene.physics.add.sprite(x, y, def.texture);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(def.radius);
    body.setCollideWorldBounds(true);
    sprite.setDepth(6);
    if (elite) sprite.setTint(0xffd25f);
    const e: EnemyActor = {
      id: allocId(),
      kind,
      def,
      elite,
      summoned: opts?.summoned ?? false,
      team: "enemy",
      sprite,
      body,
      hp: Math.round(def.hp * (elite ? ELITE_HP_MULT : 1) * enemyHpMult()),
      maxHp: Math.round(def.hp * (elite ? ELITE_HP_MULT : 1)),
      alive: true,
      invulnUntil: 0,
      flashUntil: 0,
      aiState: "approach",
      stateUntil: 0,
      dashDirX: 0,
      dashDirY: 0,
      dashHit: false,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeFlipAt: scene.time.now + 1200 + Math.random() * 1500,
      shakeT: 0,
      contactAt: 0,
    };
    this.enemies.push(e);
    return e;
  }

  remove(e: EnemyActor): void {
    e.alive = false;
    e.sprite.destroy();
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
  }

  update(now: number): void {
    const player = this.world.getPlayer();
    if (!player.alive) {
      // Player dead: enemies drift to a halt.
      for (const e of this.enemies) {
        if (!e.alive) continue;
        e.body.velocity.x *= 0.92;
        e.body.velocity.y *= 0.92;
      }
      return;
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.updateEnemy(e, now, player);
    }
    this.separate();
  }

  private updateEnemy(
    e: EnemyActor,
    now: number,
    player: {
      x: number;
      y: number;
      alive: boolean;
      radius: number;
      vulnerable: boolean;
    },
  ): void {
    // Hit flash (GDD §14: impacto visible).
    if (now < e.flashUntil) {
      e.sprite.setTintFill(0xffffff);
    } else if (e.elite) e.sprite.setTint(0xffd25f);
    else e.sprite.clearTint();

    const dx = player.x - e.sprite.x;
    const dy = player.y - e.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    switch (e.kind) {
      case "grunt":
        this.updateGrunt(e, now, player, ux, uy, dist);
        break;
      case "charger":
        this.updateCharger(e, now, player, ux, uy, dist);
        break;
      case "gunner":
        this.updateGunner(e, now, player, ux, uy, dist);
        break;
      case "sniper":
        this.updateSniper(e, now, player, ux, uy, dist);
        break;
      case "kamikaze":
        this.updateKamikaze(e, now, player, ux, uy, dist);
        break;
      case "brute":
        this.updateBrute(e, now, player, ux, uy, dist);
        break;
    }
  }

  private updateGrunt(
    e: EnemyActor,
    now: number,
    player: { x: number; y: number; radius: number },
    ux: number,
    uy: number,
    dist: number,
  ): void {
    const { def } = e;
    if (dist > def.engageRange) {
      e.aiState = "approach";
      e.body.velocity.x = ux * def.speed;
      e.body.velocity.y = uy * def.speed;
    } else {
      e.aiState = "strafe";
      // Orbit slowly while keeping range (GDD §16.1: mantiene distancia moderada).
      e.body.velocity.x = -uy * def.speed * 0.5 + ux * def.speed * 0.3;
      e.body.velocity.y = ux * def.speed * 0.5 + uy * def.speed * 0.3;
      if (def.weapon) {
        const aim = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
        this.weapons.enemyShoot(
          e.id,
          e.sprite.x,
          e.sprite.y,
          aim,
          def.weapon,
          "enemy",
          now,
        );
      }
    }
  }

  private updateCharger(
    e: EnemyActor,
    now: number,
    player: {
      x: number;
      y: number;
      alive: boolean;
      radius: number;
      vulnerable: boolean;
    },
    ux: number,
    uy: number,
    dist: number,
  ): void {
    const { def } = e;
    switch (e.aiState) {
      case "approach":
        e.body.velocity.x = ux * def.speed;
        e.body.velocity.y = uy * def.speed;
        if (dist < def.engageRange * 0.85 && now > e.stateUntil) {
          e.aiState = "telegraph";
          e.stateUntil = now + 480;
          e.body.velocity.x = 0;
          e.body.velocity.y = 0;
        }
        break;
      case "telegraph": {
        // Charging up: flash and shake so the player can read it (GDD §16.2).
        e.body.velocity.x = 0;
        e.body.velocity.y = 0;
        const blink = Math.floor((now / 80) % 2) === 0;
        e.sprite.setTint(blink ? 0xffffff : 0xff8a4f);
        const shake = Math.sin(now / 24) * 2;
        e.sprite.x += shake;
        e.shakeT = shake;
        if (now >= e.stateUntil) {
          const a = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
          e.dashDirX = Math.cos(a);
          e.dashDirY = Math.sin(a);
          e.dashHit = false;
          e.aiState = "dash";
          e.stateUntil = now + 420;
          playSound("plasma");
        }
        break;
      }
      case "dash":
        e.body.velocity.x = e.dashDirX * 430;
        e.body.velocity.y = e.dashDirY * 430;
        if (!e.dashHit && player.alive && player.vulnerable) {
          const pr = player.radius;
          if (
            Phaser.Math.Distance.Between(
              e.sprite.x,
              e.sprite.y,
              player.x,
              player.y,
            ) <
            def.radius + pr + 2
          ) {
            e.dashHit = true;
            this.world.onChargerContact(e, def.contactDamage ?? 20);
          }
        }
        if (now >= e.stateUntil) {
          if (e.dashHit) {
            e.aiState = "approach";
            e.stateUntil = now + 900;
          } else {
            // Missed: vulnerable after the charge (GDD §16.2).
            e.aiState = "stun";
            e.stateUntil = now + 1100;
            e.body.velocity.x = 0;
            e.body.velocity.y = 0;
          }
        }
        break;
      case "stun":
        e.body.velocity.x = 0;
        e.body.velocity.y = 0;
        if (Math.floor(now / 120) % 2 === 0) e.sprite.setTintFill(0xffffff);
        else if (e.elite) e.sprite.setTint(0xffd25f);
        else e.sprite.clearTint();
        if (now >= e.stateUntil) {
          e.aiState = "approach";
          e.stateUntil = now + 400;
        }
        break;
    }
  }

  private updateGunner(
    e: EnemyActor,
    now: number,
    player: { x: number; y: number; radius: number },
    ux: number,
    uy: number,
    dist: number,
  ): void {
    const { def } = e;
    let vx = 0;
    let vy = 0;
    if (dist < 200) {
      vx = -ux * def.speed;
      vy = -uy * def.speed;
    } else if (dist > 285) {
      vx = ux * def.speed;
      vy = uy * def.speed;
    } else {
      // Strafe perpendicular, flip direction periodically (GDD §16.3: se reposiciona).
      if (now > e.strafeFlipAt) {
        e.strafeDir *= -1;
        e.strafeFlipAt = now + 1400 + Math.random() * 1200;
      }
      vx = -uy * def.speed * 0.7 * e.strafeDir;
      vy = ux * def.speed * 0.7 * e.strafeDir;
    }
    e.body.velocity.x = vx;
    e.body.velocity.y = vy;
    if (def.weapon) {
      const aim = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
      this.weapons.enemyShoot(
        e.id,
        e.sprite.x,
        e.sprite.y,
        aim,
        def.weapon,
        "enemy",
        now,
      );
    }
  }

  private updateSniper(
    e: EnemyActor,
    now: number,
    player: { x: number; y: number; radius: number },
    ux: number,
    uy: number,
    dist: number,
  ): void {
    const { def } = e;
    let vx = 0;
    let vy = 0;
    if (dist < 240) {
      vx = -ux * def.speed;
      vy = -uy * def.speed;
    } else if (dist > 340) {
      vx = ux * def.speed;
      vy = uy * def.speed;
    } else {
      // Orbit at long range (GDD §16.4: mantiene distancia larga).
      vx = -uy * def.speed * 0.5;
      vy = ux * def.speed * 0.5;
    }
    e.body.velocity.x = vx;
    e.body.velocity.y = vy;
    if (dist < 380 && def.weapon) {
      const aim = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
      this.weapons.enemyShoot(
        e.id,
        e.sprite.x,
        e.sprite.y,
        aim,
        def.weapon,
        "enemy",
        now,
      );
    }
  }

  private updateKamikaze(
    e: EnemyActor,
    now: number,
    player: {
      x: number;
      y: number;
      alive: boolean;
      radius: number;
      vulnerable: boolean;
    },
    ux: number,
    uy: number,
    dist: number,
  ): void {
    const { def } = e;
    switch (e.aiState) {
      case "approach":
        e.body.velocity.x = ux * def.speed;
        e.body.velocity.y = uy * def.speed;
        if (dist < def.engageRange * 0.9 && now > e.stateUntil) {
          e.aiState = "telegraph";
          e.stateUntil = now + 400;
          e.body.velocity.x = 0;
          e.body.velocity.y = 0;
        }
        break;
      case "telegraph": {
        // Fuse lit: flash so the player can react (GDD §16.5).
        e.body.velocity.x = 0;
        e.body.velocity.y = 0;
        const blink = Math.floor((now / 70) % 2) === 0;
        e.sprite.setTint(blink ? 0xffffff : 0xff8a2f);
        if (now >= e.stateUntil) {
          const a = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
          e.dashDirX = Math.cos(a);
          e.dashDirY = Math.sin(a);
          e.dashHit = false;
          e.aiState = "dash";
          e.stateUntil = now + 600;
          playSound("plasma");
        }
        break;
      }
      case "dash":
        e.body.velocity.x = e.dashDirX * 420;
        e.body.velocity.y = e.dashDirY * 420;
        if (!e.dashHit && player.alive && player.vulnerable) {
          const pr = player.radius;
          if (
            Phaser.Math.Distance.Between(
              e.sprite.x,
              e.sprite.y,
              player.x,
              player.y,
            ) <
            def.radius + pr + 2
          ) {
            e.dashHit = true;
            this.world.onChargerContact(e, def.contactDamage ?? 24);
            this.world.onKamikazeBlow(e);
          }
        }
        if (now >= e.stateUntil && !e.dashHit) {
          e.aiState = "stun";
          e.stateUntil = now + 700;
          e.body.velocity.x = 0;
          e.body.velocity.y = 0;
        }
        break;
      case "stun":
        e.body.velocity.x = 0;
        e.body.velocity.y = 0;
        if (Math.floor(now / 120) % 2 === 0) e.sprite.setTintFill(0xffffff);
        else e.sprite.clearTint();
        if (now >= e.stateUntil) {
          e.aiState = "approach";
          e.stateUntil = now + 300;
        }
        break;
    }
  }

  private updateBrute(
    e: EnemyActor,
    now: number,
    player: {
      x: number;
      y: number;
      alive: boolean;
      radius: number;
      vulnerable: boolean;
    },
    ux: number,
    uy: number,
    dist: number,
  ): void {
    const { def } = e;
    if (dist > def.engageRange) {
      e.body.velocity.x = ux * def.speed;
      e.body.velocity.y = uy * def.speed;
    } else {
      // Slow push forward + close-range burst (GDD §16.6).
      e.body.velocity.x = ux * def.speed * 0.4;
      e.body.velocity.y = uy * def.speed * 0.4;
      if (def.weapon) {
        const aim = Math.atan2(player.y - e.sprite.y, player.x - e.sprite.x);
        this.weapons.enemyShoot(
          e.id,
          e.sprite.x,
          e.sprite.y,
          aim,
          def.weapon,
          "enemy",
          now,
        );
      }
    }
    // Body-contact damage with a cooldown.
    if (
      player.alive &&
      player.vulnerable &&
      now >= e.contactAt &&
      dist < def.radius + player.radius + 2
    ) {
      e.contactAt = now + 800;
      this.world.onChargerContact(e, def.contactDamage ?? 15);
    }
  }

  /** Soft separation so enemies don't stack into one blob. */
  private separate(): void {
    const list = this.enemies.filter((e) => e.alive);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.sprite.x - a.sprite.x;
        const dy = b.sprite.y - a.sprite.y;
        const d = Math.hypot(dx, dy);
        const min = a.def.radius + b.def.radius + 4;
        if (d > 0 && d < min) {
          const push = ((min - d) / d) * 40;
          a.body.velocity.x -= dx * push;
          a.body.velocity.y -= dy * push;
          b.body.velocity.x += dx * push;
          b.body.velocity.y += dy * push;
        }
      }
    }
  }
}

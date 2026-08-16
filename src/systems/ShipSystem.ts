// SHIP SYSTEM (GDD §17–§21, §39): ship lifecycle, enemy ship AI, stealing,
// player control, ejection.
import Phaser from "phaser";
import { allocId, type Actor } from "../core/types";
import {
  SHIPS,
  type ShipDef,
  type ShipKind,
  type ShipState,
} from "../data/ships";
import { WEAPONS } from "../data/weapons";
import type { WeaponSystem } from "./WeaponSystem";
import type { Fx } from "../core/fx";
import { playSound } from "../core/audio";
import type { InputState } from "./InputSystem";
import type { RunState } from "../core/RunState";

// Enemy ship fire cadence per kind (GDD §20).
const FIRE_INTERVAL: Record<ShipKind, number> = {
  scout: 2400,
  interceptor: 1500,
  bomber: 3400,
  gunship: 2600,
};

export interface ShipActor extends Actor {
  kind: ShipKind;
  def: ShipDef;
  state: ShipState;
  parked: boolean; // parked ships stay put (GDD §26: naves estacionadas)
  pilotHp: number;
  pilotSprite: Phaser.GameObjects.Sprite;
  pilotFlashUntil: number;
  strafeDir: number;
  fireAt: number; // next enemy shot (scene time ms)
  stolen: boolean;
  bobT: number;
  baseY: number;
  orbitT: number;
}

export interface ShipWorld {
  scene: Phaser.Scene;
  getPlayer(): { x: number; y: number; alive: boolean };
  playerActor: Actor & {
    weaponId: string;
    mode: "foot" | "ship";
    shipId: number | null;
  };
  input: InputState;
  run: RunState;
  onEject: (x: number, y: number, fromX: number, fromY: number) => void;
  onShipEntered: (ship: ShipActor) => void;
  onShipDestroyedFx: (ship: ShipActor, x: number, y: number) => void;
  onShipRemoved: (ship: ShipActor) => void;
}

export class ShipSystem {
  ships: ShipActor[];
  private world: ShipWorld;
  private weapons: WeaponSystem;
  private fx: Fx;

  constructor(
    world: ShipWorld,
    weapons: WeaponSystem,
    fx: Fx,
    ships: ShipActor[] = [],
  ) {
    this.world = world;
    this.weapons = weapons;
    this.fx = fx;
    this.ships = ships;
  }

  spawnShip(kind: ShipKind, x: number, y: number, parked: boolean): ShipActor {
    const def = SHIPS[kind];
    const scene = this.world.scene;
    const sprite = scene.physics.add.sprite(x, y, def.texture);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(def.radius);
    body.setCollideWorldBounds(true);
    sprite.setDepth(4);
    const pilotSprite = scene.add.sprite(x, y - 2, "pilot").setDepth(5);
    const ship: ShipActor = {
      id: allocId(),
      kind,
      def,
      state: "ENEMY",
      parked,
      team: "enemy",
      sprite,
      body,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      invulnUntil: 0,
      flashUntil: 0,
      pilotHp: def.pilotHp,
      pilotSprite,
      pilotFlashUntil: 0,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      fireAt: scene.time.now + 1200 + Math.random() * 1500,
      stolen: false,
      bobT: Math.random() * 10,
      baseY: y,
      orbitT: Math.random() * 10,
    };
    this.ships.push(ship);
    return ship;
  }

  remove(ship: ShipActor): void {
    ship.alive = false;
    ship.sprite.destroy();
    ship.pilotSprite.destroy();
    const idx = this.ships.indexOf(ship);
    if (idx >= 0) this.ships.splice(idx, 1);
    this.world.onShipRemoved(ship);
  }

  update(now: number, dtMs: number): void {
    const player = this.world.getPlayer();
    for (const s of this.ships) {
      if (!s.alive) continue;
      // Hit flash.
      if (now < s.flashUntil) s.sprite.setTintFill(0xffffff);
      else if (s.state === "DISABLED") s.sprite.setTint(0x9fb0c8);
      else s.sprite.clearTint();

      s.bobT += dtMs / 1000;
      switch (s.state) {
        case "ENEMY":
          this.updateEnemyShip(s, now, player);
          break;
        case "DISABLED":
          // Pilot dead — drifts to rest, gently bobbing (GDD §18). Parked
          // ships bob in place; ships disabled mid-air stay where they were.
          s.body.velocity.x *= 0.9;
          s.body.velocity.y *= 0.9;
          if (s.parked) s.sprite.y = s.baseY + Math.sin(s.bobT * 2) * 3;
          break;
        case "PLAYER_CONTROLLED":
          this.updateControlledShip(s, now);
          break;
        case "DESTROYED":
          break;
      }
    }
  }

  private updateEnemyShip(
    s: ShipActor,
    now: number,
    player: { x: number; y: number },
  ): void {
    // Pilot sprite follows the ship; visible while alive (GDD §18: matar al piloto).
    if (s.pilotHp > 0 && s.state === "ENEMY") {
      s.pilotSprite.setPosition(s.sprite.x, s.sprite.y - 2);
      s.pilotSprite.setVisible(true);
      if (now < s.pilotFlashUntil) s.pilotSprite.setTintFill(0xffffff);
      else s.pilotSprite.clearTint();
    } else {
      s.pilotSprite.setVisible(false);
    }

    if (s.parked) {
      // Parked ships act as area turrets: they defend their ship, they don't
      // snipe the whole arena (GDD §26: aliens defendiendo una nave).
      s.body.velocity.x = 0;
      s.body.velocity.y = 0;
      s.sprite.y = s.baseY + Math.sin(s.bobT * 1.6) * 3;
      if (
        Phaser.Math.Distance.Between(
          s.sprite.x,
          s.sprite.y,
          player.x,
          player.y,
        ) > 380
      )
        return;
    } else {
      // Flying patrol: orbit the player at a safe range (GDD §22: naves enemigas).
      s.orbitT += 0.016 * s.strafeDir;
      const targetDist = 190 + Math.sin(s.orbitT * 0.7) * 40;
      const tx = player.x + Math.cos(s.orbitT) * targetDist;
      const ty = player.y + Math.sin(s.orbitT) * targetDist * 0.8;
      const dx = tx - s.sprite.x;
      const dy = ty - s.sprite.y;
      const d = Math.hypot(dx, dy) || 1;
      const spd = s.def.enemySpeed * Math.min(1, d / 60);
      s.body.velocity.x = (dx / d) * spd;
      s.body.velocity.y = (dy / d) * spd;
      s.sprite.setAngle(
        Math.atan2(s.body.velocity.y, s.body.velocity.x) * (180 / Math.PI) + 90,
      );
    }

    // Fire at the player (turret / strafing runs).
    if (now >= s.fireAt && player.x !== undefined) {
      s.fireAt = now + FIRE_INTERVAL[s.kind];
      const aim = Math.atan2(player.y - s.sprite.y, player.x - s.sprite.x);
      this.weapons.fireWeapon(
        s.sprite.x,
        s.sprite.y,
        aim,
        this.weaponDefOf(s),
        "enemy",
      );
    }
  }

  private weaponDefOf(s: ShipActor) {
    switch (s.kind) {
      case "scout":
        return WEAPONS.saucerLaser;
      case "interceptor":
        return WEAPONS.scatter;
      case "bomber":
        return WEAPONS.bomberPlasma;
      case "gunship":
        return WEAPONS.pulso;
    }
  }

  private updateControlledShip(s: ShipActor, now: number): void {
    const { input, playerActor } = this.world;
    if (playerActor.mode !== "ship" || playerActor.shipId !== s.id) return;
    // Twin-stick control from the ship (GDD §11).
    s.body.velocity.x = input.moveX * s.def.speed * input.speedMult;
    s.body.velocity.y = input.moveY * s.def.speed * input.speedMult;
    const aimLen = Math.hypot(input.aimX, input.aimY);
    if (aimLen > 0.05) {
      const angle = Math.atan2(input.aimY, input.aimX);
      s.sprite.setAngle((angle * 180) / Math.PI + 90);
      if (input.firing) {
        const fired = this.weapons.tryFire(
          s.id,
          s.sprite.x,
          s.sprite.y,
          angle,
          s.def.weapon,
          "player",
          now,
        );
        // Small recoil on fire (GDD §30).
        if (fired) {
          s.body.velocity.x -= Math.cos(angle) * 22;
          s.body.velocity.y -= Math.sin(angle) * 22;
        }
      }
    }
  }

  /** Player boards a stealable ship (GDD §18). */
  board(s: ShipActor): void {
    if (s.state !== "DISABLED") return;
    const player = this.world.playerActor;
    s.state = "PLAYER_CONTROLLED";
    s.team = "player";
    s.sprite.clearTint();
    s.pilotSprite.setVisible(false);
    player.mode = "ship";
    player.shipId = s.id;
    if (!s.stolen) {
      s.stolen = true;
      this.world.run.stats.shipsStolen++;
    }
    this.world.onShipEntered(s);
    this.fx.burst(s.sprite.x, s.sprite.y, 0x48e0ff, 18, 160, 550, 0.9);
    playSound("steal");
  }

  /** Player abandons the ship (core loop: MEJORAR / CAMBIAR NAVE). */
  exitShip(): void {
    const { playerActor } = this.world;
    if (playerActor.mode !== "ship" || playerActor.shipId === null) return;
    const s = this.ships.find(
      (q) => q.id === playerActor.shipId && q.state === "PLAYER_CONTROLLED",
    );
    if (!s) return;
    s.state = "DISABLED";
    s.team = "enemy";
    s.sprite.setTint(0x9fb0c8);
    playerActor.mode = "foot";
    playerActor.shipId = null;
    // Place the pilotless ship back on the ground (still re-stealable).
    s.sprite.x = Phaser.Math.Clamp(s.sprite.x, 30, 330);
    s.sprite.y = Phaser.Math.Clamp(s.sprite.y, 60, 3140);
    this.fx.burst(s.sprite.x, s.sprite.y + 20, 0x48e0ff, 10, 120, 450, 0.7);
    playSound("eject");
    this.world.onEject(s.sprite.x, s.sprite.y + 30, s.sprite.x, s.sprite.y);
  }

  /** Ship destroyed: big explosion; eject the player if inside (GDD §21). */
  destroyShip(s: ShipActor, sourceX: number, sourceY: number): void {
    if (s.state === "DESTROYED") return;
    const wasControlled = s.state === "PLAYER_CONTROLLED";
    s.state = "DESTROYED";
    s.alive = false;
    s.pilotSprite.setVisible(false);
    this.world.onShipDestroyedFx(s, s.sprite.x, s.sprite.y);
    if (wasControlled) {
      this.world.run.stats.shipsDestroyed++;
      this.eject(s.sprite.x, s.sprite.y, sourceX, sourceY);
    }
    // Remove the wreck shortly after the explosion (handled by the scene).
    this.world.scene.time.delayedCall(700, () => this.remove(s));
  }

  /** Nave destruida → eyección → seguir a pie (GDD §21). */
  private eject(x: number, y: number, fromX: number, fromY: number): void {
    const { playerActor, run, scene } = this.world;
    playerActor.mode = "foot";
    playerActor.shipId = null;
    run.playerMode = "foot";
    this.world.onEject(x, y, fromX, fromY);
    playSound("shipDestroy");
    playSound("eject");
    scene.cameras.main.shake(260, 0.01);
  }
}

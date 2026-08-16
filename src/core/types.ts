// Shared entity types (GDD §39: GAME RULES → GAME STATE → SYSTEMS → PHASER).
import type Phaser from "phaser";

export type Team = "player" | "enemy";

let nextId = 1;
export function allocId(): number {
  return nextId++;
}

export interface Actor {
  id: number;
  team: Team;
  sprite: Phaser.GameObjects.Sprite;
  body: Phaser.Physics.Arcade.Body;
  hp: number;
  maxHp: number;
  alive: boolean;
  invulnUntil: number; // scene time ms
  flashUntil: number; // hit flash
}

export interface Projectile {
  id: number;
  team: Team;
  sprite: Phaser.GameObjects.Sprite;
  body: Phaser.Physics.Arcade.Body;
  damage: number;
  knockback: number;
  lifeMs: number;
  dead: boolean;
  hitIds: Set<number>; // actors already hit (one hit per projectile per actor)
  radius: number;
  pierce: boolean; // keeps flying through enemies (GDD §15.5)
  homing: boolean; // steers toward the nearest enemy (GDD §15.6)
}

export interface WeaponDrop {
  id: number;
  kind: "weapon";
  weaponId: string; // WeaponId
  sprite: Phaser.GameObjects.Sprite;
  body: Phaser.Physics.Arcade.Body;
  x: number;
  y: number;
  taken: boolean;
  bobT: number;
}

export interface ShieldDrop {
  id: number;
  kind: "shield";
  sprite: Phaser.GameObjects.Sprite;
  body: Phaser.Physics.Arcade.Body;
  x: number;
  y: number;
  taken: boolean;
  bobT: number;
}

export interface MedkitDrop {
  id: number;
  kind: "medkit";
  sprite: Phaser.GameObjects.Sprite;
  body: Phaser.Physics.Arcade.Body;
  x: number;
  y: number;
  taken: boolean;
  bobT: number;
}

export interface PowerUpDrop {
  id: number;
  kind: "powerup";
  powerUp: string; // PowerUpKind
  sprite: Phaser.GameObjects.Sprite;
  body: Phaser.Physics.Arcade.Body;
  x: number;
  y: number;
  taken: boolean;
  bobT: number;
}

export type Drop = WeaponDrop | ShieldDrop | MedkitDrop | PowerUpDrop;

export interface Interactable {
  kind: "weapon" | "shield" | "medkit" | "powerup" | "ship" | "exit";
  x: number;
  y: number;
  label: string;
  holdMs: number; // hold-to-activate duration (0 = tap)
  ref: unknown;
}

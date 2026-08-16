// Declarative ship data (GDD §17–§21). Ships are resources to capture.

import type { WeaponId } from "./weapons";

export type ShipKind = "scout" | "interceptor" | "bomber" | "gunship";

// Ship lifecycle (GDD §17).
export type ShipState =
  | "ENEMY" // pilot alive, flying and shooting at the player
  | "DISABLED" // pilot dead — available to be stolen
  | "PLAYER_CONTROLLED" // player boarded it
  | "DESTROYED";

export interface ShipDef {
  kind: ShipKind;
  name: string;
  texture: string;
  hp: number;
  speed: number; // player-controlled speed
  enemySpeed: number; // patrol/strafe speed when still hostile
  radius: number;
  weapon: WeaponId;
  pilotHp: number;
  score: number;
}

export const SHIPS: Record<ShipKind, ShipDef> = {
  // 20.3 Interceptor — fast glass cannon, spread shot.
  interceptor: {
    kind: "interceptor",
    name: "Interceptor",
    texture: "ship_interceptor",
    hp: 120,
    speed: 300,
    enemySpeed: 150,
    radius: 22,
    weapon: "scatter",
    pilotHp: 35,
    score: 7,
  },
  // 20.4 Alien Gunship — armored mid-tier, pulse cannon.
  gunship: {
    kind: "gunship",
    name: "Alien Gunship",
    texture: "ship_gunship",
    hp: 280,
    speed: 165,
    enemySpeed: 90,
    radius: 32,
    weapon: "pulso",
    pilotHp: 50,
    score: 12,
  },
  // 20.1 Scout Saucer — fast, fragile, double laser.
  scout: {
    kind: "scout",
    name: "Scout Saucer",
    texture: "ship_scout",
    hp: 150,
    speed: 240,
    enemySpeed: 110,
    radius: 26,
    weapon: "saucerLaser",
    pilotHp: 40,
    score: 5,
  },
  // 20.2 Alien Bomber — slow, tough, heavy plasma.
  bomber: {
    kind: "bomber",
    name: "Alien Bomber",
    texture: "ship_bomber",
    hp: 400,
    speed: 130,
    enemySpeed: 70,
    radius: 38,
    weapon: "bomberPlasma",
    pilotHp: 60,
    score: 10,
  },
};

// Parked ships in the arena (GDD §26: naves estacionadas).
// pilotGuards: enemies defending the ship on the ground.
export interface ParkedShipDef {
  kind: ShipKind;
  x: number;
  y: number;
  guards: {
    kind: "grunt" | "charger" | "gunner";
    x: number;
    y: number;
    elite?: boolean;
  }[];
}

export const PARKED_SHIPS: ParkedShipDef[] = [
  {
    // First ship the player can find — close to the spawn (GDD §6/§26).
    kind: "scout",
    x: 230,
    y: 2650,
    guards: [
      { kind: "grunt", x: 170, y: 2690 },
      { kind: "grunt", x: 285, y: 2620 },
    ],
  },
  {
    // Mid-arena scout on the right-side path.
    kind: "scout",
    x: 150,
    y: 2140,
    guards: [
      { kind: "grunt", x: 100, y: 2200 },
      { kind: "charger", x: 200, y: 2210 },
    ],
  },
  {
    kind: "scout",
    x: 180,
    y: 1650,
    guards: [
      { kind: "grunt", x: 130, y: 1710 },
      { kind: "grunt", x: 230, y: 1700 },
    ],
  },
  {
    // Second bomber, mid-arena.
    kind: "bomber",
    x: 180,
    y: 1210,
    guards: [
      { kind: "gunner", x: 120, y: 1270 },
      { kind: "grunt", x: 240, y: 1270 },
    ],
  },
  {
    kind: "bomber",
    x: 250,
    y: 880,
    guards: [
      { kind: "gunner", x: 130, y: 950 },
      { kind: "grunt", x: 230, y: 990 },
    ],
  },
  {
    // Agile interceptor on the left-side path.
    kind: "interceptor",
    x: 90,
    y: 1950,
    guards: [
      { kind: "grunt", x: 55, y: 2000 },
      { kind: "charger", x: 130, y: 2010 },
    ],
  },
  {
    // Armored gunship guarding the approach to the boss arena.
    kind: "gunship",
    x: 120,
    y: 700,
    guards: [
      { kind: "gunner", x: 70, y: 770 },
      { kind: "charger", x: 190, y: 790 },
    ],
  },
];

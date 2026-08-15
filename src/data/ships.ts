// Declarative ship data (GDD §17–§21). Ships are resources to capture.

import type { WeaponId } from './weapons';

export type ShipKind = 'scout' | 'bomber';

// Ship lifecycle (GDD §17).
export type ShipState =
  | 'ENEMY' // pilot alive, flying and shooting at the player
  | 'DISABLED' // pilot dead — available to be stolen
  | 'PLAYER_CONTROLLED' // player boarded it
  | 'DESTROYED';

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
  // 20.1 Scout Saucer — fast, fragile, double laser.
  scout: {
    kind: 'scout',
    name: 'Scout Saucer',
    texture: 'ship_scout',
    hp: 150,
    speed: 240,
    enemySpeed: 110,
    radius: 26,
    weapon: 'saucerLaser',
    pilotHp: 40,
    score: 5,
  },
  // 20.2 Alien Bomber — slow, tough, heavy plasma.
  bomber: {
    kind: 'bomber',
    name: 'Alien Bomber',
    texture: 'ship_bomber',
    hp: 400,
    speed: 130,
    enemySpeed: 70,
    radius: 38,
    weapon: 'bomberPlasma',
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
  guards: { kind: 'grunt' | 'charger' | 'gunner'; x: number; y: number; elite?: boolean }[];
}

export const PARKED_SHIPS: ParkedShipDef[] = [
  {
    kind: 'scout',
    x: 180,
    y: 1650,
    guards: [
      { kind: 'grunt', x: 130, y: 1710 },
      { kind: 'grunt', x: 230, y: 1700 },
    ],
  },
  {
    kind: 'bomber',
    x: 250,
    y: 880,
    guards: [
      { kind: 'gunner', x: 130, y: 950 },
      { kind: 'grunt', x: 230, y: 990 },
    ],
  },
];

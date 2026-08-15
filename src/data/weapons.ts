// Declarative weapon data (GDD §15, §38). All combat tuning lives here.

export type WeaponId =
  | 'pistol'
  | 'plasma'
  | 'scatter'
  | 'saucerLaser'
  | 'bomberPlasma';

export type SoundId =
  | 'pistol'
  | 'plasma'
  | 'scatter'
  | 'laser'
  | 'heavy'
  | 'hit'
  | 'alienDeath'
  | 'explosion'
  | 'shipEnter'
  | 'shipDestroy'
  | 'pickup'
  | 'steal'
  | 'eject'
  | 'bossWarn'
  | 'complete'
  | 'playerDeath'
  | 'heavyHit';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string; // HUD glyph
  damage: number;
  fireRate: number; // shots per second
  projectileSpeed: number; // px/s
  projectileKey: string; // texture key of the projectile
  projectileRadius: number;
  pellets: number; // projectiles per shot
  spread: number; // radians of total spread across pellets
  life: number; // seconds before the projectile fades
  parallel?: number; // parallel beams (ship weapons), offset perpendicular
  parallelGap?: number; // px between parallel beams
  knockback?: number; // impulse applied on hit
  sound: SoundId;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // 15.1 Human Pistol — functional but unexciting.
  pistol: {
    id: 'pistol',
    name: 'PISTOLA',
    icon: '🔫',
    damage: 10,
    fireRate: 4,
    projectileSpeed: 380,
    projectileKey: 'proj_bullet',
    projectileRadius: 3,
    pellets: 1,
    spread: 0.05,
    life: 0.8,
    knockback: 60,
    sound: 'pistol',
  },
  // 15.2 Alien Plasma Gun — the first obvious upgrade.
  plasma: {
    id: 'plasma',
    name: 'PLASMA',
    icon: '🔵',
    damage: 18,
    fireRate: 3,
    projectileSpeed: 320,
    projectileKey: 'proj_plasma',
    projectileRadius: 5,
    pellets: 1,
    spread: 0.04,
    life: 0.9,
    knockback: 90,
    sound: 'plasma',
  },
  // 15.3 Scatter Blaster — multiple pellets, strong at close range.
  scatter: {
    id: 'scatter',
    name: 'SCATTER',
    icon: '💥',
    damage: 6,
    fireRate: 1.6,
    projectileSpeed: 300,
    projectileKey: 'proj_pellet',
    projectileRadius: 3,
    pellets: 5,
    spread: 0.55,
    life: 0.45,
    knockback: 50,
    sound: 'scatter',
  },
  // 20.1 Scout Saucer — double laser.
  saucerLaser: {
    id: 'saucerLaser',
    name: 'LÁSER DOBLE',
    icon: '⚡',
    damage: 22,
    fireRate: 4,
    projectileSpeed: 520,
    projectileKey: 'proj_laser',
    projectileRadius: 3,
    pellets: 1,
    spread: 0.02,
    life: 0.9,
    parallel: 2,
    parallelGap: 7,
    knockback: 80,
    sound: 'laser',
  },
  // 20.2 Alien Bomber — heavy plasma.
  bomberPlasma: {
    id: 'bomberPlasma',
    name: 'PLASMA PESADO',
    icon: '🔮',
    damage: 60,
    fireRate: 1.2,
    projectileSpeed: 260,
    projectileKey: 'proj_heavy',
    projectileRadius: 9,
    pellets: 1,
    spread: 0.02,
    life: 1.4,
    knockback: 220,
    sound: 'heavy',
  },
};

// Weapon pickups laid out in the world / dropped by enemies.
export interface WeaponDropDef {
  id: WeaponId;
  x: number;
  y: number;
}

export const getWeapon = (id: WeaponId): WeaponDef => WEAPONS[id];

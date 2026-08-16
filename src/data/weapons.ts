// Declarative weapon data (GDD §15, §38). All combat tuning lives here.

export type WeaponId =
  | "pistol"
  | "plasma"
  | "scatter"
  | "rafaga"
  | "penetrador"
  | "misil"
  | "pulso"
  | "saucerLaser"
  | "bomberPlasma";

export type SoundId =
  | "pistol"
  | "plasma"
  | "scatter"
  | "laser"
  | "heavy"
  | "hit"
  | "alienDeath"
  | "explosion"
  | "shipEnter"
  | "shipDestroy"
  | "pickup"
  | "steal"
  | "eject"
  | "bossWarn"
  | "complete"
  | "playerDeath"
  | "heavyHit"
  | "shieldHit"
  | "burst"
  | "rail"
  | "missile";

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
  burst?: number; // shots per burst (player burst weapons, GDD §15.4)
  burstGapMs?: number; // between burst shots
  burstCooldownMs?: number; // between bursts
  pierce?: boolean; // railgun: passes through enemies (GDD §15.5)
  homing?: boolean; // missile: steers toward the nearest enemy (GDD §15.6)
  knockback?: number; // impulse applied on hit
  sound: SoundId;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // 15.1 Human Pistol — functional but unexciting.
  pistol: {
    id: "pistol",
    name: "PISTOLA",
    icon: "🔫",
    damage: 10,
    fireRate: 4,
    projectileSpeed: 380,
    projectileKey: "proj_bullet",
    projectileRadius: 3,
    pellets: 1,
    spread: 0.05,
    life: 0.8,
    knockback: 60,
    sound: "pistol",
  },
  // 15.2 Alien Plasma Gun — the first obvious upgrade.
  plasma: {
    id: "plasma",
    name: "PLASMA",
    icon: "🔵",
    damage: 18,
    fireRate: 3,
    projectileSpeed: 320,
    projectileKey: "proj_plasma",
    projectileRadius: 5,
    pellets: 1,
    spread: 0.04,
    life: 0.9,
    knockback: 90,
    sound: "plasma",
  },
  // 15.3 Scatter Blaster — multiple pellets, strong at close range.
  scatter: {
    id: "scatter",
    name: "SCATTER",
    icon: "💥",
    damage: 6,
    fireRate: 1.6,
    projectileSpeed: 300,
    projectileKey: "proj_pellet",
    projectileRadius: 3,
    pellets: 5,
    spread: 0.55,
    life: 0.45,
    knockback: 50,
    sound: "scatter",
  },
  // 15.4 RÁFAGA — burst rifle: 3-round burst, front-loaded damage.
  rafaga: {
    id: "rafaga",
    name: "RÁFAGA",
    icon: "🔷",
    damage: 9,
    fireRate: 2.2,
    projectileSpeed: 420,
    projectileKey: "proj_bullet",
    projectileRadius: 3,
    pellets: 1,
    spread: 0.02,
    life: 0.8,
    burst: 3,
    burstGapMs: 70,
    burstCooldownMs: 460,
    knockback: 20,
    sound: "burst",
  },
  // 15.5 PENETRADOR — railgun: slow, heavy, pierces every enemy in line.
  penetrador: {
    id: "penetrador",
    name: "PENETRADOR",
    icon: "🔱",
    damage: 40,
    fireRate: 1.1,
    projectileSpeed: 780,
    projectileKey: "proj_rail",
    projectileRadius: 4,
    pellets: 1,
    spread: 0.02,
    life: 0.9,
    pierce: true,
    knockback: 140,
    sound: "rail",
  },
  // 15.6 MISIL — homing rocket: steers to the nearest enemy.
  misil: {
    id: "misil",
    name: "MISIL",
    icon: "🚀",
    damage: 30,
    fireRate: 0.9,
    projectileSpeed: 240,
    projectileKey: "proj_missile",
    projectileRadius: 5,
    pellets: 1,
    spread: 0.02,
    life: 2.2,
    homing: true,
    knockback: 60,
    sound: "missile",
  },
  // 20.4 Alien Gunship — pulse cannon.
  pulso: {
    id: "pulso",
    name: "PULSO",
    icon: "🟣",
    damage: 16,
    fireRate: 3.5,
    projectileSpeed: 340,
    projectileKey: "proj_plasma",
    projectileRadius: 5,
    pellets: 1,
    spread: 0.02,
    life: 1.4,
    knockback: 70,
    sound: "plasma",
  },
  // 20.1 Scout Saucer — double laser.
  saucerLaser: {
    id: "saucerLaser",
    name: "LÁSER DOBLE",
    icon: "⚡",
    damage: 16,
    fireRate: 4,
    projectileSpeed: 520,
    projectileKey: "proj_laser",
    projectileRadius: 3,
    pellets: 1,
    spread: 0.02,
    // Short life = ~286px range: the scout is a close-range shredder, it
    // must not snipe the boss from across the arena (GDD §20.1 tuning).
    life: 0.55,
    parallel: 2,
    parallelGap: 7,
    knockback: 80,
    sound: "laser",
  },
  // 20.2 Alien Bomber — heavy plasma.
  bomberPlasma: {
    id: "bomberPlasma",
    name: "PLASMA PESADO",
    icon: "🔮",
    damage: 60,
    fireRate: 1.2,
    projectileSpeed: 260,
    projectileKey: "proj_heavy",
    projectileRadius: 9,
    pellets: 1,
    spread: 0.02,
    life: 1.4,
    knockback: 220,
    sound: "heavy",
  },
};

// Weapon pickups laid out in the world / dropped by enemies.
export interface WeaponDropDef {
  id: WeaponId;
  x: number;
  y: number;
}

export const getWeapon = (id: WeaponId): WeaponDef => WEAPONS[id];

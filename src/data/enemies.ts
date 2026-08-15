// Declarative enemy data (GDD §16, §22). All enemy tuning lives here.

import type { WeaponId } from './weapons';

export type EnemyKind = 'grunt' | 'charger' | 'gunner';

export interface EnemyWeaponDef {
  damage: number;
  fireRate: number; // shots per second
  projectileSpeed: number;
  burst?: number; // shots per burst
  burstGapMs?: number; // between burst shots
  burstCooldownMs?: number; // between bursts
}

export interface DropEntry {
  weapon: WeaponId;
  chance: number; // 0..1 rolled on death
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  texture: string;
  hp: number;
  speed: number;
  radius: number;
  contactDamage?: number;
  score: number;
  weapon?: EnemyWeaponDef;
  weaponDrop: WeaponId | null;
  dropTable: DropEntry[];
  engageRange: number; // preferred distance to the player
  hitSound: 'hit' | 'heavyHit';
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  // 16.1 Grunt — detects, approaches, keeps moderate distance, shoots.
  grunt: {
    kind: 'grunt',
    name: 'Grunt',
    texture: 'alien_grunt',
    hp: 40,
    speed: 85,
    radius: 11,
    score: 1,
    weapon: { damage: 7, fireRate: 1.4, projectileSpeed: 220 },
    weaponDrop: 'pistol',
    dropTable: [
      { weapon: 'pistol', chance: 0.3 },
      { weapon: 'plasma', chance: 0.12 },
    ],
    engageRange: 190,
    hitSound: 'hit',
  },
  // 16.2 Charger — melee rusher: telegraph, dash, vulnerable after a miss.
  charger: {
    kind: 'charger',
    name: 'Charger',
    texture: 'alien_charger',
    hp: 70,
    speed: 95,
    radius: 12,
    contactDamage: 22,
    score: 2,
    weaponDrop: 'scatter',
    dropTable: [{ weapon: 'scatter', chance: 0.35 }],
    engageRange: 170,
    hitSound: 'heavyHit',
  },
  // 16.3 Gunner — keeps distance, fires bursts, repositions. Better drops.
  gunner: {
    kind: 'gunner',
    name: 'Gunner',
    texture: 'alien_gunner',
    hp: 90,
    speed: 90,
    radius: 12,
    score: 3,
    weapon: {
      damage: 9,
      fireRate: 0.8,
      projectileSpeed: 300,
      burst: 4,
      burstGapMs: 180,
      burstCooldownMs: 1200,
    },
    weaponDrop: 'plasma',
    dropTable: [
      { weapon: 'plasma', chance: 0.5 },
      { weapon: 'scatter', chance: 0.15 },
    ],
    engageRange: 250,
    hitSound: 'heavyHit',
  },
};

// Elites (GDD §22: 8+ min): tougher, gold-tinted versions.
export const ELITE_HP_MULT = 2.5;
export const ELITE_DMG_MULT = 1.5;
export const ELITE_DROP_MULT = 1.8;

// Difficulty ramp over time (GDD §22). Tiers are cumulative.
export interface DifficultyTier {
  min: number; // minutes from run start
  gruntCap: number;
  chargerCap: number;
  gunnerCap: number;
  enemyScoutCap: number;
  enemyBomberCap: number;
  elites: boolean;
  spawnInterval: number; // seconds between spawn attempts
}

export const TIERS: DifficultyTier[] = [
  { min: 0, gruntCap: 6, chargerCap: 0, gunnerCap: 0, enemyScoutCap: 0, enemyBomberCap: 0, elites: false, spawnInterval: 2.2 },
  { min: 2, gruntCap: 7, chargerCap: 3, gunnerCap: 0, enemyScoutCap: 0, enemyBomberCap: 0, elites: false, spawnInterval: 1.8 },
  { min: 4, gruntCap: 8, chargerCap: 3, gunnerCap: 2, enemyScoutCap: 0, enemyBomberCap: 0, elites: false, spawnInterval: 1.6 },
  { min: 6, gruntCap: 9, chargerCap: 4, gunnerCap: 3, enemyScoutCap: 1, enemyBomberCap: 0, elites: false, spawnInterval: 1.35 },
  { min: 8, gruntCap: 10, chargerCap: 5, gunnerCap: 4, enemyScoutCap: 2, enemyBomberCap: 1, elites: true, spawnInterval: 1.1 },
];

// Alien Commander (GDD §23).
export interface BossDef {
  name: string;
  texture: string;
  hp: number;
  coreRadius: number; // weak point: full damage
  hullDamageMult: number; // damage dealt when hitting anywhere but the core
  radialBurstCount: number;
  radialIntervalMs: number;
  radialBulletSpeed: number;
  aimedDamage: number;
  aimedSpeed: number;
  summonIntervalMs: number;
  summonCap: number;
  enrageHpRatio: number;
  enrageFireRateMult: number;
  enrageBulletSpeedMult: number;
}

export const BOSS: BossDef = {
  name: 'COMANDANTE ALIEN',
  texture: 'ship_boss',
  hp: 3000,
  coreRadius: 26,
  hullDamageMult: 0.25,
  radialBurstCount: 14,
  radialIntervalMs: 2400,
  radialBulletSpeed: 150,
  aimedDamage: 16,
  aimedSpeed: 230,
  summonIntervalMs: 8000,
  summonCap: 6,
  enrageHpRatio: 0.5,
  enrageFireRateMult: 1.6,
  enrageBulletSpeedMult: 1.25,
};

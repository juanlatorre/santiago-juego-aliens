// Difficulty select (GDD §22): easy / normal / hard, persisted in localStorage.
// Multipliers are applied at the damage/spawn boundaries so the tuning stays
// declarative.
export type Difficulty = "easy" | "normal" | "hard";

const KEY = "alienheist.difficulty.v1";
const ORDER: Difficulty[] = ["easy", "normal", "hard"];

let current: Difficulty = "normal";

try {
  const saved = localStorage.getItem(KEY);
  if (saved && (ORDER as string[]).includes(saved))
    current = saved as Difficulty;
} catch {
  /* storage unavailable */
}

export function getDifficulty(): Difficulty {
  return current;
}

export function setDifficulty(d: Difficulty): void {
  current = d;
  try {
    localStorage.setItem(KEY, d);
  } catch {
    /* storage unavailable */
  }
}

export function nextDifficulty(): Difficulty {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

const ENEMY_HP = { easy: 0.8, normal: 1, hard: 1.35 };
const ENEMY_DMG = { easy: 0.85, normal: 1, hard: 1.25 };
const SPAWN_INTERVAL = { easy: 1.25, normal: 1, hard: 0.85 };
const PLAYER_DMG = { easy: 1.15, normal: 1, hard: 0.9 };
const SCORE = { easy: 0.75, normal: 1, hard: 1.5 };

export const enemyHpMult = (): number => ENEMY_HP[current];
export const enemyDamageMult = (): number => ENEMY_DMG[current];
export const spawnIntervalMult = (): number => SPAWN_INTERVAL[current];
export const playerDamageMult = (): number => PLAYER_DMG[current];
export const scoreMult = (): number => SCORE[current];

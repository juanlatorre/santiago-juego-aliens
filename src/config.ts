// Global game configuration (GDD §3: portrait 9:16, 360x800 logical resolution).
export const VIEW_WIDTH = 360;
export const VIEW_HEIGHT = 800;

// The MVP world is a single tall arena (GDD §26, §22). Content advances upward.
export const ARENA_WIDTH = 360;
export const ARENA_HEIGHT = 3200;

// Camera zoom (GDD §9): closer on foot, slightly zoomed out in a ship.
export const ZOOM_FOOT = 1;
export const ZOOM_SHIP = 0.85;

// Boss trigger: the commander waits at the top of the arena (GDD §23).
export const BOSS_TRIGGER_Y = 620;
export const BOSS_ARENA_MIN_Y = 120;
export const BOSS_ARENA_MAX_Y = 700;

export const HUD_TOP = 12;

// Player base values (GDD §13 — arbitrary MVP values, tuned in playtests).
export const PLAYER = {
  hp: 100,
  speed: 150,
  radius: 11,
  invulnAfterHit: 700,
  invulnAfterEject: 2500,
  ejectImpulse: 260,
  interactRangePickup: 32,
  interactRangeShip: 48,
  stealHoldMs: 650,
  exitHoldMs: 400,
};

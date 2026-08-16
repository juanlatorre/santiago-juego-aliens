// Level layout for the single MVP arena (GDD §26–§27).
// One zone: alien arena with obstacles, structures and open combat spaces.
// Content composition drives the player upward (GDD §10).

export type ObstacleKind = "rock" | "crate" | "wall" | "structure";

export interface ObstacleDef {
  kind: ObstacleKind;
  x: number; // center
  y: number; // center
  w: number;
  h: number;
}

export const ARENA_MARGIN = 24;

// A hand-authored but deterministic layout: cover clusters, wall segments
// with gaps, and two "outpost" structures further up.
export const OBSTACLES: ObstacleDef[] = [
  // --- Start area (y ~3000–3200): open, a few rocks ---
  { kind: "rock", x: 60, y: 3120, w: 40, h: 36 },
  { kind: "rock", x: 300, y: 3080, w: 34, h: 30 },
  { kind: "crate", x: 150, y: 3150, w: 26, h: 26 },
  { kind: "crate", x: 255, y: 3160, w: 26, h: 26 },

  // --- y 2600–3000: rock clusters + a crate row ---
  { kind: "rock", x: 70, y: 2900, w: 44, h: 40 },
  { kind: "rock", x: 110, y: 2870, w: 30, h: 28 },
  { kind: "crate", x: 210, y: 2820, w: 26, h: 26 },
  { kind: "crate", x: 240, y: 2820, w: 26, h: 26 },
  { kind: "crate", x: 270, y: 2820, w: 26, h: 26 },
  { kind: "rock", x: 300, y: 2700, w: 40, h: 36 },
  { kind: "rock", x: 55, y: 2680, w: 36, h: 32 },
  { kind: "crate", x: 180, y: 2740, w: 26, h: 26 },

  // --- y 2300–2600: wall segments with gaps ---
  { kind: "wall", x: 90, y: 2520, w: 90, h: 18 },
  { kind: "wall", x: 270, y: 2490, w: 100, h: 18 },
  { kind: "crate", x: 180, y: 2550, w: 26, h: 26 },
  { kind: "rock", x: 320, y: 2600, w: 36, h: 32 },
  { kind: "structure", x: 180, y: 2400, w: 70, h: 70 },
  { kind: "rock", x: 50, y: 2360, w: 40, h: 36 },
  { kind: "crate", x: 100, y: 2430, w: 26, h: 26 },

  // --- y 1900–2300: rocks and crates ---
  { kind: "rock", x: 70, y: 2200, w: 44, h: 40 },
  { kind: "crate", x: 150, y: 2240, w: 26, h: 26 },
  { kind: "crate", x: 180, y: 2240, w: 26, h: 26 },
  { kind: "wall", x: 300, y: 2180, w: 90, h: 18 },
  { kind: "rock", x: 55, y: 2060, w: 36, h: 32 },
  { kind: "rock", x: 320, y: 2050, w: 40, h: 36 },
  { kind: "crate", x: 220, y: 2080, w: 26, h: 26 },

  // --- y 1500–1900: outpost cluster + parked Scout ---
  { kind: "structure", x: 70, y: 1820, w: 64, h: 64 },
  { kind: "structure", x: 290, y: 1830, w: 64, h: 64 },
  { kind: "crate", x: 100, y: 1600, w: 26, h: 26 },
  { kind: "crate", x: 260, y: 1580, w: 26, h: 26 },
  { kind: "rock", x: 55, y: 1530, w: 36, h: 32 },
  { kind: "rock", x: 320, y: 1740, w: 40, h: 36 },
  { kind: "wall", x: 180, y: 1920, w: 120, h: 18 },

  // --- y 1100–1500: rocks, walls, crates ---
  { kind: "rock", x: 60, y: 1400, w: 40, h: 36 },
  { kind: "rock", x: 300, y: 1360, w: 44, h: 40 },
  { kind: "wall", x: 90, y: 1260, w: 100, h: 18 },
  { kind: "wall", x: 270, y: 1220, w: 100, h: 18 },
  { kind: "crate", x: 180, y: 1300, w: 26, h: 26 },
  { kind: "crate", x: 210, y: 1300, w: 26, h: 26 },
  { kind: "structure", x: 180, y: 1120, w: 70, h: 70 },
  { kind: "rock", x: 50, y: 1150, w: 36, h: 32 },

  // --- y 700–1100: bomber parking area ---
  { kind: "rock", x: 55, y: 1050, w: 40, h: 36 },
  { kind: "crate", x: 100, y: 1030, w: 26, h: 26 },
  { kind: "wall", x: 90, y: 760, w: 90, h: 18 },
  { kind: "wall", x: 270, y: 730, w: 90, h: 18 },
  { kind: "rock", x: 320, y: 840, w: 40, h: 36 },
  { kind: "crate", x: 120, y: 790, w: 26, h: 26 },

  // --- y 0–700: boss arena — mostly open, edge walls only ---
  { kind: "wall", x: 40, y: 640, w: 80, h: 18 },
  { kind: "wall", x: 320, y: 610, w: 80, h: 18 },
  { kind: "rock", x: 180, y: 550, w: 40, h: 36 },
  { kind: "rock", x: 70, y: 300, w: 40, h: 36 },
  { kind: "rock", x: 290, y: 280, w: 44, h: 40 },
  { kind: "crate", x: 180, y: 420, w: 26, h: 26 },
  { kind: "crate", x: 130, y: 150, w: 26, h: 26 },
  { kind: "crate", x: 230, y: 150, w: 26, h: 26 },
];

// Abandoned weapon caches on the ground — they teach pickups early (GDD §35).
export const WEAPON_CACHES = [
  { id: "plasma" as const, x: 180, y: 2710 },
  { id: "rafaga" as const, x: 90, y: 2050 },
  { id: "misil" as const, x: 285, y: 1420 },
];

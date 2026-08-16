// Run power-ups (GDD §24-lite): temporary buffs picked up from drops.
export type PowerUpKind = "rapid" | "triple" | "pierce" | "speed" | "magnet";

export interface PowerUpDef {
  name: string;
  icon: string;
  durationMs: number;
}

export const POWERUPS: Record<PowerUpKind, PowerUpDef> = {
  rapid: { name: "RÁFAGA RÁPIDA", icon: "⚡", durationMs: 10000 },
  triple: { name: "TIRO TRIPLE", icon: "🔥", durationMs: 10000 },
  pierce: { name: "PENETRANTE", icon: "🔱", durationMs: 10000 },
  speed: { name: "VELOCIDAD", icon: "👟", durationMs: 10000 },
  magnet: { name: "IMÁN", icon: "🧲", durationMs: 10000 },
};

// Modifiers while the power-up is active (applied to the controlled entity).
export const SPEED_MULT = 1.4;
export const FIRE_RATE_MULT = 1.8;
export const TRIPLE_PARALLEL = 2; // extra parallel shots
export const MAGNET_RANGE_MULT = 2.5;

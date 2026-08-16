// Skin packs (GDD §25): player suit + distinct ship designs, selected in
// AJUSTES, persisted. Enemy ships keep the classic textures; stolen ships
// are re-skinned when the player boards them (see GameScene.onShipEntered).
import type { ShipKind } from "../data/ships";

export interface SkinDef {
  id: string;
  name: string;
  player: string; // player texture
  ships: Record<ShipKind, string>; // per-kind ship textures
}

export const SKINS: SkinDef[] = [
  {
    id: "classic",
    name: "CLÁSICO",
    player: "player",
    ships: {
      scout: "ship_scout",
      interceptor: "ship_interceptor",
      bomber: "ship_bomber",
      gunship: "ship_gunship",
    },
  },
  {
    id: "rebel",
    name: "REBELDE",
    player: "player_rebel",
    ships: {
      scout: "ship_scout_rebel",
      interceptor: "ship_interceptor_rebel",
      bomber: "ship_bomber_rebel",
      gunship: "ship_gunship_rebel",
    },
  },
  {
    id: "ghost",
    name: "FANTASMA",
    player: "player_ghost",
    ships: {
      scout: "ship_scout_ghost",
      interceptor: "ship_interceptor_ghost",
      bomber: "ship_bomber_ghost",
      gunship: "ship_gunship_ghost",
    },
  },
  {
    id: "imperial",
    name: "IMPERIAL",
    player: "player_imperial",
    ships: {
      scout: "ship_scout_imperial",
      interceptor: "ship_interceptor_imperial",
      bomber: "ship_bomber_imperial",
      gunship: "ship_gunship_imperial",
    },
  },
];

const KEY = "alienheist.skin.v1";
let currentId = "classic";

try {
  const saved = localStorage.getItem(KEY);
  if (saved && SKINS.some((s) => s.id === saved)) currentId = saved;
} catch {
  /* storage unavailable */
}

export function getSkin(): SkinDef {
  return SKINS.find((s) => s.id === currentId) ?? SKINS[0];
}

export function setSkin(id: string): void {
  if (!SKINS.some((s) => s.id === id)) return;
  currentId = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
}

/** Texture of the ship kind under the current skin pack. */
export function getShipTexture(kind: ShipKind): string {
  return getSkin().ships[kind];
}

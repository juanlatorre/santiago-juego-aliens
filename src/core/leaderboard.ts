// Local leaderboard (GDD §33): top scores persisted on the device.
// Online leaderboards stay out of scope (GDD §36) — this is device-only.
export interface ScoreEntry {
  score: number;
  kills: number;
  shipsStolen: number;
  maxCombo: number;
  date: string; // ISO timestamp
}

const KEY = "alienheist.leaderboard.v1";
export const LEADERBOARD_MAX = 5;

let entries: ScoreEntry[] = [];

function load(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        entries = parsed
          .filter((e) => typeof e?.score === "number")
          .slice(0, LEADERBOARD_MAX);
      }
    }
  } catch {
    entries = [];
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable */
  }
}

load();

export function getLeaderboard(): ScoreEntry[] {
  return [...entries];
}

export function bestScore(): number {
  return entries[0]?.score ?? 0;
}

/**
 * Inserts a run into the leaderboard (sorted desc, capped at
 * LEADERBOARD_MAX). Returns the 1-based rank and the kept entry, or
 * { rank: -1, entry: null } when the score didn't make the top list.
 */
export function submitScore(e: Omit<ScoreEntry, "date">): {
  rank: number;
  entry: ScoreEntry | null;
} {
  if (e.score <= 0) return { rank: -1, entry: null };
  const entry: ScoreEntry = { ...e, date: new Date().toISOString() };
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score);
  const rank = entries.indexOf(entry) + 1;
  if (entries.length > LEADERBOARD_MAX) {
    entries = entries.slice(0, LEADERBOARD_MAX);
  }
  const kept = rank <= LEADERBOARD_MAX;
  save();
  return kept ? { rank, entry } : { rank: -1, entry: null };
}

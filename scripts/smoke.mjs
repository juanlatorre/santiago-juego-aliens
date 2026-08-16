// Smoke test for the Alien Heist prototype.
// Verifies the GDD §35 first-playable flow in a real browser via the debug
// API (window.__ah): boot → menu → play → walk → shoot → kill → pickup →
// steal ship → fly → fire → destroy ship → eject → boss → run complete.
// Run:  npm run smoke   (requires: npm run build first)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdirSync } from "node:fs";

const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = "scripts/shots";
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, cond, extra = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
}

function waitFor(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await waitFor(250);
  }
  throw new Error("server did not start");
}

const server = spawn(
  "npx",
  ["vite", "preview", "--port", String(PORT), "--strictPort"],
  {
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stderr.on("data", () => {});
server.stdout.on("data", () => {});
const httpServer = http.createServer(() => {});

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 400, height: 890 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  // --- 1. Boot → Menu -------------------------------------------------
  await page.goto(BASE, { waitUntil: "load" });
  await waitFor(1200);
  const menuText = await page
    .locator("canvas")
    .count()
    .catch(() => 0);
  check("canvas rendered", menuText > 0, `canvas count=${menuText}`);

  // --- 2. PLAY ----------------------------------------------------------
  // Click the PLAY button (center 180,470 in logical coords; canvas is scaled FIT).
  await page.mouse.click(200, 520);
  await waitFor(1500);
  const state1 = await page.evaluate(() => window.__ah?.getState());
  check(
    "game started (phase=playing)",
    state1?.phase === "playing",
    JSON.stringify({ phase: state1?.phase }),
  );
  check("player starts with pistol", state1?.player?.weapon === "pistol");

  // --- 3. Walk (keyboard) ----------------------------------------------
  const startPos = { ...state1.player };
  await page.keyboard.down("KeyW");
  await waitFor(500);
  await page.keyboard.up("KeyW");
  const state2 = await page.evaluate(() => window.__ah.getState());
  check(
    "player moves (W)",
    state2.player.y < startPos.y - 20,
    `y ${startPos.y} → ${state2.player.y}`,
  );

  // --- 4. Shoot ----------------------------------------------------------
  await page.mouse.move(200, 400); // aim up
  await page.mouse.down();
  await waitFor(400);
  await page.mouse.up();
  const state3 = await page.evaluate(() => window.__ah.getState());
  check(
    "player fires (pistol uses recorded)",
    (state3.stats?.weaponUses?.pistol ?? 0) > 0,
    JSON.stringify(state3.stats.weaponUses),
  );

  // --- 5. Kill enemies → drops ------------------------------------------
  const state4 = await page.evaluate(() => {
    window.__ah.cheat.killAllEnemies();
    return window.__ah.getState();
  });
  check(
    "killing enemies counts kills",
    state4.stats.kills >= 3,
    `kills=${state4.stats.kills}`,
  );
  const weaponDrop = state4.drops.find((d) => d.weapon !== "pistol");
  check(
    "enemies drop weapons",
    Boolean(weaponDrop),
    `drops=${JSON.stringify(state4.drops.map((d) => d.weapon))}`,
  );

  // --- 6. Pick up a weapon (E interact) ----------------------------------
  const cacheDrop =
    state4.drops.find((d) => d.weapon === "plasma") ?? weaponDrop;
  await page.evaluate((d) => window.__ah.cheat.teleport(d.x, d.y), cacheDrop);
  await waitFor(300);
  await page.keyboard.down("KeyE");
  await waitFor(120);
  await page.keyboard.up("KeyE");
  await waitFor(200);
  const state5 = await page.evaluate(() => window.__ah.getState());
  check(
    "weapon picked up",
    state5.player.weapon !== "pistol",
    `weapon=${state5.player.weapon}`,
  );

  // --- 7. Parked scout: kill pilot → DISABLED -----------------------------
  const scout = state5.ships.find((s) => s.kind === "scout" && s.parked);
  check(
    "parked scout exists",
    Boolean(scout),
    JSON.stringify(state5.ships.map((s) => `${s.kind}:${s.state}`)),
  );
  await page.evaluate((p) => window.__ah.cheat.teleport(p.x, p.y), scout);
  await waitFor(300);
  const state6 = await page.evaluate((id) => {
    window.__ah.cheat.killPilot(id);
    return window.__ah.getState();
  }, scout.id);
  const scoutAfter = state6.ships.find((s) => s.id === scout.id);
  check(
    "pilot killed → ship DISABLED",
    scoutAfter?.state === "DISABLED",
    `state=${scoutAfter?.state}`,
  );

  // --- 8. Steal the ship (hold E) -----------------------------------------
  await page.evaluate((p) => window.__ah.cheat.teleport(p.x, p.y), scout);
  await waitFor(250);
  await page.keyboard.down("KeyE");
  await waitFor(900); // stealHoldMs = 650
  await page.keyboard.up("KeyE");
  await waitFor(300);
  const state7 = await page.evaluate(() => window.__ah.getState());
  check(
    "ship stolen → mode=ship",
    state7.player.mode === "ship",
    `mode=${state7.player.mode}`,
  );
  check(
    "ships stolen stat = 1",
    state7.stats.shipsStolen === 1,
    `stolen=${state7.stats.shipsStolen}`,
  );

  // --- 9. Fly the ship + fire from it --------------------------------------
  const shipPosBefore = state7.ships.find(
    (s) => s.state === "PLAYER_CONTROLLED",
  );
  await page.keyboard.down("KeyD");
  await waitFor(600);
  await page.keyboard.up("KeyD");
  const state8 = await page.evaluate(() => window.__ah.getState());
  const shipPosAfter = state8.ships.find(
    (s) => s.state === "PLAYER_CONTROLLED",
  );
  check(
    "ship moves",
    Math.abs(shipPosAfter.x - shipPosBefore.x) > 10,
    `x ${shipPosBefore.x} → ${shipPosAfter.x}`,
  );
  await page.mouse.move(200, 400);
  await page.mouse.down();
  await waitFor(400);
  await page.mouse.up();
  const state9 = await page.evaluate(() => window.__ah.getState());
  check(
    "ship fires laser",
    (state9.stats?.weaponUses?.saucerLaser ?? 0) > 0,
    JSON.stringify(state9.stats.weaponUses),
  );
  await page.screenshot({ path: `${SHOTS}/01-ship.png` });

  // --- 10. Ship destroyed → ejected → keep playing --------------------------
  await page.evaluate(() => window.__ah.cheat.destroyPlayerShip());
  await waitFor(300);
  const state10 = await page.evaluate(() => window.__ah.getState());
  check(
    "ship destroyed → mode=foot again",
    state10.player.mode === "foot",
    `mode=${state10.player.mode}`,
  );
  check(
    "player survived ejection",
    state10.player.hp > 0,
    `hp=${state10.player.hp}`,
  );
  check(
    "ships destroyed stat = 1",
    state10.stats.shipsDestroyed === 1,
    `destroyed=${state10.stats.shipsDestroyed}`,
  );
  await page.screenshot({ path: `${SHOTS}/02-ejected.png` });

  // --- 11. Re-steal a parked bomber ---------------------------------------
  const state11 = await page.evaluate(() => window.__ah.getState());
  const bomber = state11.ships.find(
    (q) => q.kind === "bomber" && q.parked && q.state === "ENEMY",
  );
  await page.evaluate((p) => window.__ah.cheat.teleport(p.x, p.y), bomber);
  await waitFor(300);
  await page.evaluate((id) => {
    window.__ah.cheat.killPilot(id);
  }, bomber.id);
  await waitFor(200);
  await page.keyboard.down("KeyE");
  await waitFor(900);
  await page.keyboard.up("KeyE");
  await waitFor(300);
  const state12 = await page.evaluate(() => window.__ah.getState());
  check(
    "bomber stolen (2nd ship)",
    state12.player.mode === "ship" && state12.stats.shipsStolen === 2,
    `stolen=${state12.stats.shipsStolen}`,
  );
  await page.evaluate(() => window.__ah.cheat.destroyPlayerShip());
  await waitFor(300);

  // --- 12. Boss -----------------------------------------------------------------
  await page.evaluate(() => window.__ah.cheat.startBoss());
  await waitFor(700);
  const state13 = await page.evaluate(() => window.__ah.getState());
  check("boss spawned", state13.boss !== null, JSON.stringify(state13.boss));
  await page.screenshot({ path: `${SHOTS}/03-boss.png` });

  // --- 13. Boss defeated → RUN COMPLETE ---------------------------------------
  await page.evaluate(() => window.__ah.cheat.killBoss());
  await waitFor(3500); // defeat fx (800ms) + banner (1800ms) before GameOver
  const afterBoss = await page.evaluate(
    () => window.__ah?.scene?.() ?? "no-api",
  );
  const goData = await page.evaluate(() => window.__ah);
  check("RUN COMPLETE screen", afterBoss === "GameOver", `scene=${afterBoss}`);
  check(
    "run marked complete",
    goData?.complete === true,
    JSON.stringify(goData?.complete),
  );
  await page.screenshot({ path: `${SHOTS}/04-complete.png` });

  // --- 14. PLAY AGAIN → fresh run ----------------------------------------------
  await page.mouse.click(200, 570);
  await waitFor(1500);
  const state14 = await page.evaluate(() => window.__ah?.getState());
  check(
    "play again → fresh run",
    state14?.phase === "playing" &&
      state14.stats.shipsStolen === 0 &&
      state14.stats.shipsDestroyed === 0 &&
      state14.stats.kills <= 2,
    JSON.stringify({
      phase: state14?.phase,
      kills: state14?.stats?.kills,
      stolen: state14?.stats?.shipsStolen,
    }),
  );

  // --- 15. Death → GAME OVER -----------------------------------------------------
  await page.evaluate(() => window.__ah.cheat.killPlayer());
  await waitFor(2200);
  const afterDeath = await page.evaluate(
    () => window.__ah?.scene?.() ?? "no-api",
  );
  const deathData = await page.evaluate(() => window.__ah);
  check("GAME OVER screen", afterDeath === "GameOver", `scene=${afterDeath}`);
  check(
    "game over shows stats",
    deathData?.stats && typeof deathData.stats.kills === "number",
    JSON.stringify({ kills: deathData?.stats?.kills }),
  );
  check(
    "game over shows ships stolen",
    typeof deathData?.stats?.shipsStolen === "number",
    `stolen=${deathData?.stats?.shipsStolen}`,
  );
  await page.screenshot({ path: `${SHOTS}/05-gameover.png` });

  // --- Console errors -----------------------------------------------------------
  const realErrors = consoleErrors.filter(
    (e) => !e.includes("favicon") && !e.includes("404"),
  );
  check(
    "no console errors",
    realErrors.length === 0,
    realErrors.slice(0, 5).join(" | "),
  );
} catch (err) {
  failures++;
  console.error("SMOKE CRASH:", err);
} finally {
  await browser?.close();
  server.kill();
  httpServer.close();
}

console.log(
  failures === 0
    ? "\nSMOKE OK — all checks passed"
    : `\nSMOKE FAILED — ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);

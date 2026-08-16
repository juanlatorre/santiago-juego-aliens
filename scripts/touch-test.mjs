// Touch-control test: verifies the twin virtual sticks and the contextual
// button (GDD §11) using real CDP touch events, plus the difficulty ramp
// (GDD §22) and Charger AI (GDD §16.2).
// Run:  npm run build && node scripts/touch-test.mjs
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4318;
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;
const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, cond, extra = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await waitFor(250);
  }
  throw new Error("server did not start");
}

const server = spawn(
  "npx",
  ["vite", "preview", "--port", String(PORT), "--strictPort"],
  { stdio: "ignore" },
);
let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 400, height: 890 },
    hasTouch: true,
    isMobile: true,
  });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(BASE, { waitUntil: "load" });
  await waitFor(1200);
  await page.mouse.click(200, 520); // PLAY
  await waitFor(1200);

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });

  // --- Move stick (left half): touch down at (50,450) → drag right -----------
  const before = await page.evaluate(() => window.__ah.getState());
  await touch("touchStart", [{ x: 50, y: 450, id: 1 }]);
  await touch("touchMove", [{ x: 150, y: 450, id: 1 }]);
  await waitFor(500);
  await touch("touchEnd", []);
  const afterMove = await page.evaluate(() => window.__ah.getState());
  check(
    "move stick moves player right",
    afterMove.player.x > before.player.x + 20,
    `x ${before.player.x} → ${afterMove.player.x}`,
  );

  // --- Aim stick (right half): down at (350,500) → drag up = fire ------------
  const beforeFire = await page.evaluate(() => window.__ah.getState());
  const shots0 = beforeFire.stats.weaponUses?.pistol ?? 0;
  await touch("touchStart", [{ x: 350, y: 500, id: 2 }]);
  await touch("touchMove", [{ x: 350, y: 320, id: 2 }]); // magnitude > threshold
  await waitFor(500);
  await touch("touchEnd", []);
  const afterFire = await page.evaluate(() => window.__ah.getState());
  const shots1 = afterFire.stats.weaponUses?.pistol ?? 0;
  check(
    "aim stick fires",
    shots1 > shots0,
    `pistol shots ${shots0} → ${shots1}`,
  );

  // --- Context button (touch): pick up the plasma cache ----------------------
  const cacheDrop = (
    await page.evaluate(() => window.__ah.getState())
  ).drops.find((d) => d.weapon === "plasma");
  await page.evaluate((d) => window.__ah.cheat.teleport(d.x, d.y), cacheDrop);
  await waitFor(400);
  const btnPos = { x: 200, y: 822 }; // logical (180, 738) scaled by 1.111
  await touch("touchStart", [{ x: btnPos.x, y: btnPos.y, id: 3 }]);
  await waitFor(150);
  await touch("touchEnd", []);
  await waitFor(300);
  const afterPickup = await page.evaluate(() => window.__ah.getState());
  check(
    "context button picks up weapon",
    afterPickup.player.weapon === "plasma",
    `weapon=${afterPickup.player.weapon}`,
  );

  // --- Difficulty ramp: flying scout ship at 7 min ---------------------------
  await page.evaluate(() => {
    window.__ah.cheat.god(true);
    window.__ah.cheat.setTime(7 * 60);
    window.__ah.cheat.teleport(180, 2200);
  });
  await waitFor(28000); // ship spawn interval up to 24s
  const stateT4 = await page.evaluate(() => window.__ah.getState());
  const flyingScout = stateT4.ships.find(
    (s) => s.kind === "scout" && !s.parked,
  );
  check(
    "7min tier spawns flying scout",
    Boolean(flyingScout),
    JSON.stringify(
      stateT4.ships.map(
        (s) => `${s.kind}:${s.parked ? "parked" : "flying"}:${s.state}`,
      ),
    ),
  );

  // --- Difficulty ramp: bomber + elites at 9+ min ----------------------------
  await page.evaluate(() => window.__ah.cheat.setTime(9 * 60));
  // ship cadence is 24s: scout cap fills first, bomber next (total ~52s).
  // kill waves between spawn rounds so caps stay open (elite chance 22%/spawn).
  for (const waitMs of [10000, 20000]) {
    await waitFor(waitMs);
    await page.evaluate(() => window.__ah.cheat.killAllEnemies());
  }
  await waitFor(22000);
  const stateT5 = await page.evaluate(() => window.__ah.getState());
  const flyingBomber = stateT5.ships.find(
    (s) => s.kind === "bomber" && !s.parked,
  );
  const elites = stateT5.enemies.filter((e) => e.elite);
  check(
    "9min tier spawns flying bomber",
    Boolean(flyingBomber),
    JSON.stringify(
      stateT5.ships.map((s) => `${s.kind}:${s.parked ? "p" : "f"}`),
    ),
  );
  check(
    "9min tier spawns elites",
    elites.length > 0,
    `elites=${elites.length}`,
  );

  // --- Charger AI: telegraph → dash → stun after a miss -----------------------
  await page.evaluate(() => window.__ah.cheat.killAllEnemies());
  await page.evaluate(() => window.__ah.cheat.teleport(180, 2900));
  await waitFor(400);
  // Spawn a charger via a fresh run? Use the debug: there's no spawn cheat —
  // wait for the spawner (interval 1.1s at tier 5) and look for a charger.
  let chargerState = null;
  for (let i = 0; i < 20 && !chargerState; i++) {
    await waitFor(1500);
    const st = await page.evaluate(() => window.__ah.getState());
    chargerState = st.enemies.find((e) => e.kind === "charger") ?? null;
  }
  check(
    "charger spawns at tier 5",
    Boolean(chargerState),
    chargerState ? `at (${chargerState.x},${chargerState.y})` : "none",
  );
  if (chargerState) {
    // Sample positions to observe the dash (speed >> walk speed).
    const samples = [];
    let sawDash = false;
    for (let i = 0; i < 30 && !sawDash; i++) {
      await waitFor(250);
      const st = await page.evaluate(() => window.__ah.getState());
      const c = st.enemies.find((e) => e.kind === "charger");
      if (!c) break;
      const prev = samples[samples.length - 1];
      if (prev) {
        const speed = Math.hypot(c.x - prev.x, c.y - prev.y) / 0.25;
        if (speed > 280) sawDash = true;
      }
      samples.push({ x: c.x, y: c.y, state: c.aiState });
    }
    check(
      "charger dashes at the player",
      sawDash,
      samples
        .slice(0, 6)
        .map((s) => s.state)
        .join(","),
    );
  }

  check(
    "no page errors",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "),
  );
} catch (err) {
  failures++;
  console.error("TOUCH TEST CRASH:", err);
} finally {
  await browser?.close();
  server.kill();
}

console.log(
  failures === 0
    ? "\nTOUCH OK — all checks passed"
    : `\nTOUCH FAILED — ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);

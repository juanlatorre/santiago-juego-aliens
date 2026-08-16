// GAME SCENE: arena build + update orchestration (GDD §39).
// Gameplay logic lives in systems; this scene wires input, rendering, camera, HUD.
import Phaser from "phaser";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS_TRIGGER_Y,
  PLAYER,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  ZOOM_FOOT,
  ZOOM_SHIP,
} from "../config";
import { RunState } from "../core/RunState";
import { InputState } from "../systems/InputSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { WeaponSystem } from "../systems/WeaponSystem";
import { EnemySystem, type EnemyActor } from "../systems/EnemySystem";
import { ShipSystem, type ShipActor } from "../systems/ShipSystem";
import { SpawnSystem } from "../systems/SpawnSystem";
import { BossSystem } from "../systems/BossSystem";
import { Hud } from "./Hud";
import { Joysticks } from "./Joysticks";
import { OBSTACLES, WEAPON_CACHES, type ObstacleDef } from "../data/level";
import { PARKED_SHIPS } from "../data/ships";
import { BOSS } from "../data/enemies";
import { WEAPONS, type WeaponId } from "../data/weapons";
import type {
  Actor,
  Interactable,
  MedkitDrop,
  PowerUpDrop,
  ShieldDrop,
  WeaponDrop,
} from "../core/types";
import { hapticImpact, ImpactStyle } from "../core/haptics";
import { enemyDamageMult, scoreMult } from "../core/difficulty";
import {
  FIRE_RATE_MULT,
  MAGNET_RANGE_MULT,
  POWERUPS,
  SPEED_MULT,
  TRIPLE_PARALLEL,
  type PowerUpKind,
} from "../core/powerups";
import { getShipTexture, getSkin } from "../core/skins";
import { allocId } from "../core/types";
import type { Fx } from "../core/fx";
import { playSound, startMusic } from "../core/audio";

interface PlayerActor extends Actor {
  weaponId: WeaponId;
  mode: "foot" | "ship";
  shipId: number | null;
  shieldHp: number; // absorb HP from shield pickups (GDD §16 Drops)
}

export class GameScene extends Phaser.Scene {
  run = new RunState();
  inputState = new InputState();
  player!: PlayerActor;
  enemySystem!: EnemySystem;
  shipSystem!: ShipSystem;
  spawnSystem!: SpawnSystem;
  bossSystem!: BossSystem;
  combat!: CombatSystem;
  weapons!: WeaponSystem;
  hud!: Hud;
  joysticks!: Joysticks;
  fx!: Fx;
  walls!: Phaser.Physics.Arcade.StaticGroup;
  obstacles: ObstacleDef[] = OBSTACLES;
  private enemyList: EnemyActor[] = [];
  private shipList: ShipActor[] = [];
  private bossRef: BossSystem | null = null;
  private movingBodies: Phaser.GameObjects.Sprite[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mouseWorld = { x: 0, y: 0 };
  private mouseFiring = false;
  private prevInteractDown = false;
  private holdMs = 0;
  private interactProgMs = 0; // proximity progress (GDD §11)
  private interactRef: unknown = null; // last interactable ref — resets progress
  private holdLatch = false; // ignore residual hold until the button is released
  private godMode = false;
  private prompt!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private interactBar!: Phaser.GameObjects.Graphics;
  private shieldBubble!: Phaser.GameObjects.Sprite;
  private paused = false;
  private pauseBtn!: Phaser.GameObjects.Rectangle;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private pauseHoldTimer: Phaser.Time.TimerEvent | null = null;
  private visHandler: () => void = () => {};
  private debugInteract: {
    label: string;
    holdMs: number;
    progress: number;
  } | null = null;

  constructor() {
    super("Game");
  }

  create(): void {
    this.run = new RunState();
    this.run.scoreMult = scoreMult(); // difficulty (GDD §22)
    this.inputState = new InputState();
    this.holdMs = 0;
    this.interactProgMs = 0;
    this.holdLatch = false;
    this.godMode = false;
    this.mouseFiring = false;
    this.prevInteractDown = false;
    this.enemyList = [];
    this.shipList = [];
    this.bossRef = null;

    this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.cameras.main.setBackgroundColor("#0d0b14");

    // Ground + obstacles (GDD §26–27).
    this.add
      .tileSprite(
        ARENA_WIDTH / 2,
        ARENA_HEIGHT / 2,
        ARENA_WIDTH,
        ARENA_HEIGHT,
        "ground",
      )
      .setDepth(0);
    this.walls = this.physics.add.staticGroup();
    for (const o of OBSTACLES) {
      const key =
        o.kind === "rock"
          ? "rock"
          : o.kind === "crate"
            ? "crate"
            : o.kind === "wall"
              ? "wall"
              : "structure";
      const s = this.add.sprite(o.x, o.y, key).setDepth(2);
      s.setDisplaySize(o.w, o.h);
      this.physics.add.existing(s, true);
      const b = s.body as Phaser.Physics.Arcade.StaticBody;
      b.setSize(o.w, o.h);
      b.updateFromGameObject();
    }
    // Live array: collider picks up newly spawned actors each frame.
    this.physics.add.collider(this.walls, this.movingBodies);

    // Player (GDD §13) — with the skin selected in AJUSTES (GDD §25).
    const ps = this.physics.add.sprite(180, 3050, getSkin().player);
    const pb = ps.body as Phaser.Physics.Arcade.Body;
    pb.setCircle(PLAYER.radius);
    pb.setCollideWorldBounds(true);
    ps.setDepth(7);
    this.shieldBubble = this.add
      .sprite(ps.x, ps.y, "shield_bubble")
      .setDepth(6)
      .setVisible(false);
    this.player = {
      id: allocId(),
      team: "player",
      sprite: ps,
      body: pb,
      hp: PLAYER.hp,
      maxHp: PLAYER.hp,
      alive: true,
      invulnUntil: 0,
      flashUntil: 0,
      weaponId: "pistol",
      mode: "foot",
      shipId: null,
      shieldHp: 0,
    };
    this.movingBodies.push(ps);
    this.cameras.main.startFollow(ps, true, 0.12, 0.12);
    this.cameras.main.setZoom(ZOOM_FOOT);

    // Feedback helpers (GDD §30).
    this.fx = this.makeFx();

    // Systems (GDD §39: RULES → STATE → SYSTEMS → PRESENTATION).
    this.combat = new CombatSystem(
      {
        scene: this,
        player: this.player,
        enemies: this.enemyList,
        ships: this.shipList,
        getBossSystem: () => this.bossRef,
        onEnemyKilled: (e) => this.onEnemyKilled(e),
        onShipDestroyed: (s, x, y) => this.onShipDestroyed(s, x, y),
        onBossHit: (b, _dmg, _core) => this.hud.setBossHp(b.hp, b.maxHp),
        onPlayerHit: (dmg, fx, fy) => this.onPlayerHit(dmg, fx, fy),
        onPilotNeutralized: (s) => this.neutralizePilot(s),
      },
      this.walls,
      this.fx,
    );
    this.weapons = new WeaponSystem(this.combat, this.fx);
    this.weapons.setShotRecorder((w) => this.run.recordShot(w));
    // Power-up modifiers for player fire (GDD §24-lite).
    this.weapons.setModsProvider(() => {
      const now = this.time.now;
      return {
        fireRateMult: this.run.hasPower("rapid", now) ? FIRE_RATE_MULT : 1,
        extraParallel: this.run.hasPower("triple", now) ? TRIPLE_PARALLEL : 0,
        pierce: this.run.hasPower("pierce", now),
      };
    });
    this.enemySystem = new EnemySystem(
      {
        scene: this,
        getPlayer: () => {
          const c = this.controlled();
          return {
            x: c.x,
            y: c.y,
            alive: c.alive,
            radius: c.radius,
            vulnerable: this.player.mode === "foot",
          };
        },
        onChargerContact: (e, dmg) =>
          this.onPlayerHit(dmg, e.sprite.x, e.sprite.y),
        onKamikazeBlow: (e) => {
          // Kamikaze self-destruct (GDD §16.5): big fireball + score/drops.
          this.fx.burst(e.sprite.x, e.sprite.y, 0xff9a4f, 16, 180, 500, 1);
          this.fx.burst(e.sprite.x, e.sprite.y, 0xff3f5f, 10, 140, 400, 0.8);
          playSound("explosion");
          hapticImpact(ImpactStyle.Medium);
          this.onEnemyKilled(e);
          this.enemySystem.remove(e);
        },
      },
      this.weapons,
      this.enemyList,
    );
    this.shipSystem = new ShipSystem(
      {
        scene: this,
        getPlayer: () => {
          const c = this.controlled();
          return { x: c.x, y: c.y, alive: c.alive };
        },
        playerActor: this.player,
        input: this.inputState,
        run: this.run,
        onEject: (x, y, fx, fy) => this.onEject(x, y, fx, fy),
        onShipEntered: (s) => this.onShipEntered(s),
        onShipDestroyedFx: (_s, x, y) => this.onShipDestroyedFx(x, y),
        onShipRemoved: (s) => this.untrackSprite(s.sprite),
      },
      this.weapons,
      this.fx,
      this.shipList,
    );
    this.bossSystem = new BossSystem(
      {
        scene: this,
        getPlayer: () => {
          const c = this.controlled();
          return { x: c.x, y: c.y, alive: c.alive };
        },
        spawnSummon: (k, x, y) => this.spawnSummon(k, x, y),
        countSummons: () =>
          this.enemySystem.enemies.filter((e) => e.summoned && e.alive).length,
        onBossStarted: () => this.onBossStarted(),
        onBossDefeated: () => this.onBossDefeated(),
      },
      this.fx,
    );
    this.bossRef = this.bossSystem;
    this.spawnSystem = new SpawnSystem(
      {
        getPlayer: () => ({ x: this.player.sprite.x, y: this.player.sprite.y }),
        getElapsedSeconds: () => this.run.elapsed,
        enemies: this.enemyList,
        ships: this.shipList,
        obstacles: this.obstacles,
        bossActive: () => this.bossRef?.boss !== null,
      },
      this.enemySystem,
      this.shipSystem,
    );

    // Weapon caches on the ground (teaches pickups early, GDD §35).
    for (const c of WEAPON_CACHES) this.combat.spawnDrop(c.x, c.y, c.id);

    // Parked ships + their ground guards (GDD §26).
    for (const p of PARKED_SHIPS) {
      const ship = this.shipSystem.spawnShip(p.kind, p.x, p.y, true);
      this.trackSprite(ship.sprite);
      for (const g of p.guards) {
        const e = this.enemySystem.spawnEnemy(g.kind, g.x, g.y, {
          elite: g.elite ?? false,
        });
        this.trackSprite(e.sprite);
      }
    }

    // Boss bullets route through the scene (decoupling).
    this.events.off("bossBullet");
    this.events.on(
      "bossBullet",
      (x: number, y: number, a: number, speed: number, dmg: number) => {
        this.combat.spawnProjectile(
          x,
          y,
          a,
          {
            damage: dmg,
            projectileSpeed: speed,
            projectileKey: "proj_enemy",
            projectileRadius: 5,
            life: 1.6,
          },
          "enemy",
        );
      },
    );

    // Input: keyboard (desktop) + mouse aim + touch sticks (mobile).
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,LEFT,DOWN,RIGHT,E,SPACE",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      const w = this.cameras.main.getWorldPoint(
        p.x,
        p.y,
      ) as Phaser.Math.Vector2;
      this.mouseWorld.x = w.x;
      this.mouseWorld.y = w.y;
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch && p.leftButtonDown()) this.mouseFiring = true;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.mouseFiring = false;
    });

    this.joysticks = new Joysticks(this, this.inputState);
    this.hud = new Hud(this);
    this.hud.setPlayerHp(this.player.hp, this.player.maxHp);
    this.hud.setFootWeapon(WEAPONS.pistol);

    // Floating interaction prompt (GDD §2.3: interacciones visuales).
    this.prompt = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffd25f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false)
      .setStroke("#000000", 4);
    // Progress bar for proximity interactions (GDD §11).
    this.interactBar = this.add.graphics().setDepth(21);
    // Event banner (boss warning / run complete).
    this.banner = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 90, "", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ff7a5f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setScrollFactor(0)
      .setVisible(false)
      .setAlpha(0)
      .setStroke("#000000", 5);

    // Pause (GDD §32): button + overlay; auto-pause when the app hides.
    // Pausing requires HOLDING ⏸ ~0.3s — quick touches (very common during
    // the boss fight with the full-screen stick) must not pause by accident.
    this.pauseBtn = this.add
      .rectangle(VIEW_WIDTH - 16, 62, 30, 26, 0x1f1f2e)
      .setStrokeStyle(2, 0x7ae8ff)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(VIEW_WIDTH - 16, 62, "⏸", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#7ae8ff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);
    this.pauseBtn.on("pointerdown", () => {
      this.pauseHoldTimer = this.time.delayedCall(300, () =>
        this.setPaused(true),
      );
    });
    this.pauseBtn.on("pointerup", () => this.cancelPauseHold());
    this.pauseBtn.on("pointerout", () => this.cancelPauseHold());
    this.pauseOverlay = this.add
      .container(0, 0)
      .setDepth(200)
      .setVisible(false);
    const ov = this.add
      .rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.65)
      .setOrigin(0);
    const pTitle = this.add
      .text(VIEW_WIDTH / 2, 250, "PAUSA", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#7ae8ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setStroke("#000000", 6);
    this.pauseOverlay.add([ov, pTitle]);
    const mkPauseBtn = (label: string, y: number, cb: () => void) => {
      const b = this.add
        .rectangle(VIEW_WIDTH / 2, y, 190, 48, 0x2f6fd8)
        .setStrokeStyle(3, 0x7ae8ff)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(VIEW_WIDTH / 2, y, label, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setStroke("#000000", 3);
      b.on("pointerdown", cb);
      // BOTH go in the overlay container — a label left on the scene leaks
      // into the world (it used to float at the boss arena!).
      this.pauseOverlay.add([b, t]);
    };
    mkPauseBtn("CONTINUAR", 350, () => this.setPaused(false));
    mkPauseBtn("REINICIAR", 420, () => this.scene.restart());
    mkPauseBtn("MENÚ", 490, () => this.scene.start("Menu"));
    this.visHandler = () => {
      if (document.hidden && !this.paused && this.run.phase === "playing") {
        this.setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", this.visHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      document.removeEventListener("visibilitychange", this.visHandler),
    );

    this.setupDebugApi();
  }

  // ---------------------------------------------------------------- update

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.paused) return;
    if (this.run.phase === "gameover" || this.run.phase === "complete") return;
    this.run.elapsed += dt / 1000;
    const now = time;
    // Kill streak expiry + score HUD (GDD §33).
    if (this.run.combo > 0 && now > this.run.comboUntil) this.run.combo = 0;
    this.hud.setScore(this.run.stats.score, this.run.combo);
    // Power-ups (GDD §24-lite): speed multiplier + HUD indicator.
    this.inputState.speedMult = this.run.hasPower("speed", now)
      ? SPEED_MULT
      : 1;
    const powerKinds = this.run.activePowerUps(now);
    const icons = powerKinds
      .map((k) => POWERUPS[k as PowerUpKind].icon)
      .join("");
    let powerSecs = 0;
    if (powerKinds.length > 0) {
      powerSecs = Math.ceil(
        Math.min(...powerKinds.map((k) => (this.run.powerUps[k] - now) / 1000)),
      );
    }
    this.hud.setPowerUps(icons, powerSecs);

    this.collectInput();
    this.updateAutoAim();
    this.spawnSystem.update(now);
    this.enemySystem.update(now);
    this.shipSystem.update(now, dt);
    this.bossSystem.update(now, dt);
    this.combat.update(dt, now);
    this.updatePlayer(now);

    // Boss trigger (GDD §23): reaching the top of the arena summons the
    // commander — measured from the controlled entity (ship counts too).
    if (
      !this.bossSystem.boss &&
      (this.controlled().y < BOSS_TRIGGER_Y || this.run.elapsed > 660)
    ) {
      this.bossSystem.start(180, 320);
    }

    this.updateInteractions(now, dt);

    // Drops bob and pulse.
    for (const d of this.combat.drops) {
      d.bobT += dt / 1000;
      const label = d.sprite.getData("label") as Phaser.GameObjects.Text | null;
      if (label) label.setPosition(d.sprite.x, d.sprite.y - 2);
      d.sprite.setScale(1.5 + Math.sin(d.bobT * 4) * 0.12);
    }

    // Camera: slightly zoomed out while flying a ship (GDD §9).
    const targetZoom = this.player.mode === "ship" ? ZOOM_SHIP : ZOOM_FOOT;
    this.cameras.main.setZoom(
      Phaser.Math.Linear(
        this.cameras.main.zoom,
        targetZoom,
        Math.min(1, dt / 160),
      ),
    );

    this.hud.setPlayerHp(this.player.hp, this.player.maxHp);
    if (this.player.mode === "ship" && this.player.shipId !== null) {
      const s = this.shipSystem.ships.find((q) => q.id === this.player.shipId);
      if (s) this.hud.setMode("ship", WEAPONS[s.def.weapon], s.hp / s.maxHp);
    } else {
      this.hud.setMode("foot", null, 0);
    }
  }

  private collectInput(): void {
    const k = this.keys;
    const kx =
      (k.A.isDown || k.LEFT.isDown ? -1 : 0) +
      (k.D.isDown || k.RIGHT.isDown ? 1 : 0);
    const ky =
      (k.W.isDown || k.UP.isDown ? -1 : 0) +
      (k.S.isDown || k.DOWN.isDown ? 1 : 0);
    if (!this.joysticks.touchActive) {
      const len = Math.hypot(kx, ky);
      if (len > 0) {
        this.inputState.moveX = kx / len;
        this.inputState.moveY = ky / len;
      } else {
        this.inputState.moveX = 0;
        this.inputState.moveY = 0;
      }
      // Mouse aim (desktop).
      const dx = this.mouseWorld.x - this.player.sprite.x;
      const dy = this.mouseWorld.y - this.player.sprite.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        this.inputState.aimX = dx / d;
        this.inputState.aimY = dy / d;
      }
      this.inputState.firing = this.mouseFiring && d > 4;
    }
    // Interact: E / Space (desktop), context button (touch).
    const eDown = k.E.isDown || k.SPACE.isDown;
    if (eDown && !this.prevInteractDown) this.inputState.interactPressed = true;
    if (!this.joysticks.touchActive) {
      this.inputState.interactHeld = eDown;
    }
    this.prevInteractDown = eDown;
  }

  private updatePlayer(now: number): void {
    const p = this.player;
    if (p.mode !== "foot") return; // ship movement handled by ShipSystem
    p.body.velocity.x =
      this.inputState.moveX * PLAYER.speed * this.inputState.speedMult;
    p.body.velocity.y =
      this.inputState.moveY * PLAYER.speed * this.inputState.speedMult;
    const aimLen = Math.hypot(this.inputState.aimX, this.inputState.aimY);
    if (aimLen > 0.05) {
      const angle = Math.atan2(this.inputState.aimY, this.inputState.aimX);
      p.sprite.setAngle((angle * 180) / Math.PI + 90);
      if (this.inputState.firing) {
        const fired = this.weapons.tryFire(
          p.id,
          p.sprite.x,
          p.sprite.y,
          angle,
          p.weaponId,
          "player",
          now,
        );
        // Small recoil on fire (GDD §30).
        if (fired) {
          p.body.velocity.x -= Math.cos(angle) * 30;
          p.body.velocity.y -= Math.sin(angle) * 30;
        }
      }
    }
    // Invulnerability blink (GDD §21).
    if (now < p.invulnUntil)
      p.sprite.setAlpha(0.35 + 0.4 * Math.abs(Math.sin(now / 60)));
    else p.sprite.setAlpha(1);
    // Shield bubble follows the player while a shield is active (GDD §16 Drops).
    this.shieldBubble.setPosition(p.sprite.x, p.sprite.y);
    if (p.shieldHp > 0) {
      this.shieldBubble.setVisible(true);
      this.shieldBubble.setScale(1 + Math.sin(now / 220) * 0.05);
    } else {
      this.shieldBubble.setVisible(false);
    }
  }

  // -------------------------------------------------------- interactions

  /** Freezes gameplay (physics, tweens, clock) while keeping input alive. */
  private setPaused(p: boolean): void {
    this.cancelPauseHold();
    this.paused = p;
    this.physics.world.pause();
    if (p) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = p;
    this.inputState.firing = false; // no phantom aim while paused
    this.pauseOverlay.setVisible(p);
  }

  private cancelPauseHold(): void {
    if (this.pauseHoldTimer) {
      this.pauseHoldTimer.remove();
      this.pauseHoldTimer = null;
    }
  }

  // ---------------------------------------------- automatic firing (GDD §11)

  /**
   * Always-on auto-aim + auto-fire: aim at and fire at the nearest hostile
   * (enemy, enemy ship or boss) within range. The full-screen move stick is
   * the only touch control, so this is the firing mechanism.
   */
  private updateAutoAim(): void {
    const c = this.controlled();
    if (!c.alive) return;
    const RANGE = 430;
    let tx: number | null = null;
    let ty = 0;
    let bd = Infinity;
    const consider = (x: number, y: number) => {
      const d = Phaser.Math.Distance.Between(c.x, c.y, x, y);
      if (d < RANGE && d < bd) {
        bd = d;
        tx = x;
        ty = y;
      }
    };
    for (const e of this.enemyList)
      if (e.alive) consider(e.sprite.x, e.sprite.y);
    for (const s of this.shipList)
      if (s.state === "ENEMY") consider(s.sprite.x, s.sprite.y);
    const boss = this.bossSystem.boss;
    if (boss && boss.alive) consider(boss.sprite.x, boss.sprite.y);
    if (tx === null) {
      // No target nearby: keep facing, stop firing.
      this.inputState.firing = false;
    } else {
      const dx = tx - c.x;
      const dy = ty - c.y;
      const len = Math.hypot(dx, dy) || 1;
      this.inputState.aimX = dx / len;
      this.inputState.aimY = dy / len;
      this.inputState.firing = true;
    }
  }

  private computeInteractable(): Interactable | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    if (this.player.mode === "ship") {
      const s = this.shipSystem.ships.find((q) => q.id === this.player.shipId);
      if (s)
        return {
          kind: "exit",
          x: s.sprite.x,
          y: s.sprite.y - 44,
          label: "SALIR DE LA NAVE",
          holdMs: PLAYER.exitHoldMs,
          ref: s,
        };
      return null;
    }
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const d of this.combat.drops) {
      if (d.taken) continue;
      const dist = Phaser.Math.Distance.Between(px, py, d.sprite.x, d.sprite.y);
      const range =
        PLAYER.interactRangePickup *
        (this.run.hasPower("magnet", this.time.now) ? MAGNET_RANGE_MULT : 1);
      if (dist < range && dist < bestDist) {
        bestDist = dist;
        if (d.kind === "weapon") {
          best = {
            kind: "weapon",
            x: d.sprite.x,
            y: d.sprite.y,
            label: `RECOGER ${WEAPONS[d.weaponId as WeaponId].icon} ${WEAPONS[d.weaponId as WeaponId].name}`,
            holdMs: 0,
            ref: d,
          };
        } else if (d.kind === "shield") {
          best = {
            kind: "shield",
            x: d.sprite.x,
            y: d.sprite.y,
            label: "RECOGER 🛡 ESCUDO",
            holdMs: 0,
            ref: d,
          };
        } else if (d.kind === "medkit") {
          best = {
            kind: "medkit",
            x: d.sprite.x,
            y: d.sprite.y,
            label: "RECOGER ✚ BOTIQUÍN",
            holdMs: 0,
            ref: d,
          };
        } else {
          best = {
            kind: "powerup",
            x: d.sprite.x,
            y: d.sprite.y,
            label: `RECOGER ${POWERUPS[d.powerUp as PowerUpKind].icon} ${POWERUPS[d.powerUp as PowerUpKind].name}`,
            holdMs: 0,
            ref: d,
          };
        }
      }
    }
    for (const s of this.shipSystem.ships) {
      if (s.state !== "DISABLED") continue;
      const dist = Phaser.Math.Distance.Between(px, py, s.sprite.x, s.sprite.y);
      if (dist < PLAYER.interactRangeShip && dist < bestDist) {
        bestDist = dist;
        best = {
          kind: "ship",
          x: s.sprite.x,
          y: s.sprite.y - 34,
          label: "ROBAR NAVE",
          holdMs: PLAYER.stealHoldMs,
          ref: s,
        };
      }
    }
    return best;
  }

  private updateInteractions(now: number, dt: number): void {
    const inter = this.computeInteractable();
    const auto = inter !== null && inter.kind !== "exit";
    const autoNeed = auto
      ? inter.kind === "ship"
        ? PLAYER.stealHoldMs
        : PLAYER.autoPickupMs
      : 0;
    this.debugInteract = inter
      ? {
          label: inter.label,
          holdMs: inter.holdMs,
          progress: auto
            ? Math.min(1, this.interactProgMs / autoNeed)
            : inter.holdMs > 0
              ? Math.min(1, this.holdMs / inter.holdMs)
              : 0,
        }
      : null;
    if (inter) {
      this.prompt.setText(inter.label).setPosition(inter.x, inter.y);
      this.prompt.setVisible(true);
      this.prompt.setScale(1 + Math.sin(now / 180) * 0.06);
    } else {
      this.prompt.setVisible(false);
    }
    const pressing = this.inputState.interactHeld;
    if (!pressing) this.holdLatch = false;
    if (inter && !this.holdLatch) {
      if (auto) {
        // Proximity interaction (GDD §11): staying in range picks up a
        // weapon / shield or steals a ship — no central button on touch.
        // Progress only resets when leaving the item's area (or switching
        // to a different one), not while moving.
        if (this.inputState.interactPressed) {
          this.activateInteractable(inter);
          this.interactProgMs = 0;
          this.holdLatch = true;
        } else {
          if (this.interactRef !== inter.ref) {
            this.interactRef = inter.ref;
            this.interactProgMs = 0;
          }
          this.interactProgMs += dt;
          if (this.interactProgMs >= autoNeed) {
            this.activateInteractable(inter);
            this.interactProgMs = 0;
            this.holdLatch = true;
          }
        }
        this.interactBar
          .clear()
          .fillStyle(0x000000, 0.6)
          .fillRect(inter.x - 30, inter.y + 26, 60, 5)
          .fillStyle(0xffd25f, 1)
          .fillRect(
            inter.x - 30,
            inter.y + 26,
            60 * Math.min(1, this.interactProgMs / autoNeed),
            5,
          );
      } else {
        // Exit keeps hold-to-activate (desktop E or the ship-mode button).
        this.interactBar.clear();
        if (this.inputState.interactPressed) {
          if (inter.holdMs === 0) {
            this.activateInteractable(inter);
            this.holdMs = 0;
            this.holdLatch = true;
          }
        }
        if (pressing) {
          this.holdMs += dt;
          if (inter.holdMs > 0 && this.holdMs >= inter.holdMs) {
            this.activateInteractable(inter);
            this.holdMs = 0;
            // A stolen ship must not immediately eject because the finger is
            // still holding the button (GDD §18: robar requiere mantener).
            this.holdLatch = true;
          }
        } else {
          this.holdMs = 0;
        }
      }
    } else {
      this.holdMs = 0;
      this.interactProgMs = 0;
      this.interactRef = null;
      this.interactBar.clear();
    }
    // The central button survives only for exiting a stolen ship.
    this.joysticks.setContextButton(
      inter && inter.kind === "exit"
        ? {
            glyph: "🚪",
            label: inter.label,
            progress:
              inter.holdMs > 0 ? Math.min(1, this.holdMs / inter.holdMs) : 0,
          }
        : null,
    );
    this.inputState.interactPressed = false;
  }

  private activateInteractable(inter: Interactable): void {
    if (inter.kind === "weapon") {
      const d = inter.ref as WeaponDrop;
      const newId = d.weaponId as WeaponId;
      if (this.player.weaponId !== newId) {
        // One weapon equipped: the old one drops back to the ground (GDD §15),
        // just outside auto-pickup range so it can't immediately re-trigger
        // the proximity pickup and swap back in a loop.
        const ang = Math.random() * Math.PI * 2;
        const dist = PLAYER.interactRangePickup + 16;
        this.combat.spawnDrop(
          this.player.sprite.x + Math.cos(ang) * dist,
          this.player.sprite.y + Math.sin(ang) * dist,
          this.player.weaponId,
        );
        this.player.weaponId = newId;
        this.hud.setFootWeapon(WEAPONS[newId]);
      }
      this.combat.removeDrop(d);
      this.fx.burst(d.sprite.x, d.sprite.y, 0xffd25f, 8, 90, 300, 0.6);
      playSound("pickup");
    } else if (inter.kind === "shield") {
      // Refill the shield to max; the bubble pops back on (GDD §16 Drops).
      const d = inter.ref as ShieldDrop;
      this.player.shieldHp = PLAYER.shieldMax;
      this.hud.setShield(this.player.shieldHp, PLAYER.shieldMax);
      this.combat.removeDrop(d);
      this.fx.burst(d.sprite.x, d.sprite.y, 0x48e0ff, 10, 100, 320, 0.7);
      playSound("pickup");
    } else if (inter.kind === "medkit") {
      // Heal up to max; the float text shows the real amount (GDD §16 Drops).
      const d = inter.ref as MedkitDrop;
      const p = this.player;
      const healed = Math.min(p.maxHp - p.hp, PLAYER.medkitHeal);
      if (healed > 0) {
        p.hp += healed;
        this.hud.setPlayerHp(p.hp, p.maxHp);
        this.fx.floatText(p.sprite.x, p.sprite.y - 20, `+${healed}`, "#7aff9a");
      }
      this.combat.removeDrop(d);
      this.fx.burst(d.sprite.x, d.sprite.y, 0x48e06a, 8, 90, 300, 0.6);
      playSound("pickup");
      hapticImpact(ImpactStyle.Light);
    } else if (inter.kind === "powerup") {
      // Temporary buff (GDD §24-lite): 10s, tracked by the run state.
      const d = inter.ref as PowerUpDrop;
      const kind = d.powerUp as PowerUpKind;
      this.run.grantPower(kind, this.time.now);
      this.combat.removeDrop(d);
      this.fx.burst(d.sprite.x, d.sprite.y, 0xffd25f, 12, 110, 340, 0.8);
      this.fx.floatText(
        d.sprite.x,
        d.sprite.y - 18,
        POWERUPS[kind].name,
        "#ffd25f",
      );
      playSound("pickup");
      hapticImpact(ImpactStyle.Light);
    } else if (inter.kind === "ship") {
      this.shipSystem.board(inter.ref as ShipActor);
    } else if (inter.kind === "exit") {
      this.shipSystem.exitShip();
    }
  }

  // ----------------------------------------------------------- callbacks

  private onEnemyKilled(e: EnemyActor): void {
    this.run.stats.kills++;
    this.run.noteKill(this.time.now, e.def.score);
    this.fx.burst(e.sprite.x, e.sprite.y, 0x6fbf3f, 12, 140, 420, 0.9);
    this.fx.burst(e.sprite.x, e.sprite.y, 0xffd25f, 6, 90, 300, 0.6);
    playSound("alienDeath");
    hapticImpact(ImpactStyle.Light);
    const drop = this.combat.rollDrop(e);
    if (drop === "shield") this.combat.spawnShieldDrop(e.sprite.x, e.sprite.y);
    else if (drop === "medkit")
      this.combat.spawnMedkitDrop(e.sprite.x, e.sprite.y);
    else if (
      drop === "rapid" ||
      drop === "triple" ||
      drop === "pierce" ||
      drop === "speed" ||
      drop === "magnet"
    )
      this.combat.spawnPowerUpDrop(e.sprite.x, e.sprite.y, drop);
    else if (drop) this.combat.spawnDrop(e.sprite.x, e.sprite.y, drop);
    this.untrackSprite(e.sprite);
    this.enemySystem.remove(e);
  }

  private onPlayerHit(dmg: number, fromX: number, fromY: number): void {
    const p = this.player;
    if (!p.alive) return;
    const now = this.time.now;
    if (now < p.invulnUntil) return;
    p.invulnUntil = now + PLAYER.invulnAfterHit;
    // Difficulty scales incoming damage (GDD §22).
    dmg = Math.round(dmg * enemyDamageMult());
    if (dmg <= 0) return;
    // Taking any damage breaks the kill streak (GDD §33).
    this.run.resetCombo();
    // Shield absorbs damage before HP (GDD §16 Drops).
    if (p.shieldHp > 0) {
      const absorbed = Math.min(p.shieldHp, dmg);
      p.shieldHp -= absorbed;
      dmg -= absorbed;
      this.fx.burst(p.sprite.x, p.sprite.y, 0x7ae8ff, 8, 90, 280, 0.7);
      this.fx.floatText(p.sprite.x, p.sprite.y - 20, `-${absorbed}`, "#7ae8ff");
      playSound("shieldHit");
      hapticImpact(ImpactStyle.Light);
      this.hud.setShield(p.shieldHp, PLAYER.shieldMax);
      if (dmg <= 0) {
        // Fully absorbed: no knockback, no shake — the shield did its job.
        return;
      }
    }
    p.hp -= dmg;
    this.fx.floatText(p.sprite.x, p.sprite.y - 20, `-${dmg}`, "#ff5577");
    const a = Math.atan2(p.sprite.y - fromY, p.sprite.x - fromX);
    p.body.velocity.x += Math.cos(a) * 170;
    p.body.velocity.y += Math.sin(a) * 170;
    // Subtle punch on hit — heavy shakes on every hit feel excessive (GDD §30).
    this.fx.shake(40, 90);
    playSound("hit");
    hapticImpact(ImpactStyle.Medium);
    if (p.hp <= 0) this.killPlayer();
  }

  private killPlayer(): void {
    this.player.hp = 0;
    this.player.alive = false;
    this.run.phase = "gameover";
    this.fx.burst(
      this.player.sprite.x,
      this.player.sprite.y,
      0xff3f5f,
      26,
      240,
      800,
      1.4,
    );
    this.fx.burst(
      this.player.sprite.x,
      this.player.sprite.y,
      0xffd25f,
      14,
      150,
      600,
      1,
    );
    this.fx.shake(320, 420);
    playSound("playerDeath");
    this.joysticks.setContextButton(null);
    this.prompt.setVisible(false);
    this.time.delayedCall(1300, () => {
      this.run.stats.timeSurvived = Math.floor(this.run.elapsed);
      this.scene.start("GameOver", { stats: this.run.stats, complete: false });
    });
  }

  private neutralizePilot(s: ShipActor): void {
    if (s.state === "ENEMY") {
      s.state = "DISABLED";
      s.team = "enemy";
      s.sprite.setTint(0x9fb0c8);
      s.pilotSprite.setVisible(false);
      s.body.setVelocity(0, 0);
      this.fx.burst(s.sprite.x, s.sprite.y, 0x48e0ff, 14, 140, 500, 0.8);
      playSound("alienDeath");
      this.run.addScore(50); // pilot neutralized (GDD §33)
      hapticImpact(ImpactStyle.Light);
    }
  }

  private onShipDestroyed(s: ShipActor, x: number, y: number): void {
    this.shipSystem.destroyShip(s, x, y);
    void x;
    void y;
  }

  private onShipDestroyedFx(x: number, y: number): void {
    this.fx.burst(x, y, 0xff9a4f, 30, 260, 800, 1.4);
    this.fx.burst(x, y, 0xff3f5f, 18, 180, 600, 1);
    this.fx.burst(x, y, 0xffd25f, 12, 120, 500, 0.8);
    // Solid punch, not a seizure — ships explode often (GDD §30).
    this.fx.shake(120, 260);
    playSound("explosion");
  }

  /**
   * Position/radius of the controlled entity — the foot player, or the stolen
   * ship while flying it (GDD §18). Enemies, turrets and the boss aim here,
   * so flying a ship actually gets attacked instead of an empty spot.
   */
  private controlled(): {
    x: number;
    y: number;
    radius: number;
    alive: boolean;
  } {
    const p = this.player;
    if (p.mode === "ship" && p.shipId !== null) {
      const s = this.shipList.find((sh) => sh.id === p.shipId);
      if (s)
        return {
          x: s.sprite.x,
          y: s.sprite.y,
          radius: s.def.radius,
          alive: s.alive,
        };
    }
    return {
      x: p.sprite.x,
      y: p.sprite.y,
      radius: PLAYER.radius,
      alive: p.alive,
    };
  }

  private onShipEntered(s: ShipActor): void {
    this.player.sprite.setVisible(false);
    this.shieldBubble.setVisible(false);
    this.player.body.enable = false;
    this.player.mode = "ship";
    this.player.shipId = s.id;
    // Claim the ship: repaint it with the selected skin pack (GDD §25).
    s.sprite.setTexture(getShipTexture(s.kind));
    this.cameras.main.startFollow(s.sprite, true, 0.12, 0.12);
    this.prompt.setVisible(false);
    this.joysticks.setContextButton(null);
    this.run.addScore(150); // ship stolen (GDD §33)
    hapticImpact(ImpactStyle.Medium);
  }

  private onEject(x: number, y: number, fromX: number, fromY: number): void {
    const p = this.player;
    p.sprite.setPosition(x, y).setVisible(true);
    this.shieldBubble.setVisible(p.shieldHp > 0);
    p.body.enable = true;
    p.mode = "foot";
    p.shipId = null;
    p.invulnUntil = this.godMode
      ? Number.POSITIVE_INFINITY
      : this.time.now + PLAYER.invulnAfterEject;
    const a = Math.atan2(y - fromY, x - fromX) + (Math.random() - 0.5) * 0.8;
    p.body.velocity.x = Math.cos(a) * PLAYER.ejectImpulse;
    p.body.velocity.y = Math.sin(a) * PLAYER.ejectImpulse;
    this.cameras.main.startFollow(p.sprite, true, 0.12, 0.12);
    this.fx.burst(x, y, 0x48e0ff, 14, 160, 550, 0.9);
  }

  private spawnSummon(kind: "grunt" | "charger", x: number, y: number): void {
    const e = this.enemySystem.spawnEnemy(kind, x, y, { summoned: true });
    this.trackSprite(e.sprite);
  }

  private onBossStarted(): void {
    this.hud.showBoss(BOSS.name);
    startMusic("boss"); // the fight has its own theme (GDD §23)
    this.banner
      .setText("⚠ COMANDANTE ALIEN ⚠")
      .setColor("#ff7a5f")
      .setVisible(true)
      .setAlpha(0);
    this.tweens.add({
      targets: this.banner,
      alpha: { from: 0, to: 1 },
      duration: 300,
      yoyo: true,
      hold: 700,
      onComplete: () => this.banner.setVisible(false),
    });
  }

  private onBossDefeated(): void {
    this.run.phase = "complete";
    this.run.stats.bossDefeated = true;
    this.run.addScore(1000); // commander down (GDD §33)
    this.hud.hideBoss();
    startMusic("ambient");
    playSound("complete");
    hapticImpact(ImpactStyle.Heavy);
    this.banner
      .setText("RUN COMPLETE")
      .setColor("#7ae8ff")
      .setVisible(true)
      .setAlpha(1);
    this.time.delayedCall(1800, () => {
      this.run.stats.timeSurvived = Math.floor(this.run.elapsed);
      this.scene.start("GameOver", { stats: this.run.stats, complete: true });
    });
  }

  // ------------------------------------------------------------ helpers

  private trackSprite(s: Phaser.GameObjects.Sprite): void {
    if (!this.movingBodies.includes(s)) this.movingBodies.push(s);
  }

  private untrackSprite(s: Phaser.GameObjects.Sprite): void {
    const i = this.movingBodies.indexOf(s);
    if (i >= 0) this.movingBodies.splice(i, 1);
  }

  private makeFx(): Fx {
    return {
      burst: (x, y, color, count, speed, life, scale = 1) => {
        const em = this.add.particles(x, y, "px", {
          speed: { min: speed * 0.4, max: speed },
          lifespan: life,
          scale: { start: 0.55 * scale, end: 0 },
          tint: color,
          quantity: count,
          emitting: false,
        });
        em.setDepth(9);
        em.explode(count);
        this.time.delayedCall(life + 150, () => em.destroy());
      },
      shake: (intensity, ms) => this.cameras.main.shake(ms, intensity / 1000),
      muzzleFlash: (x, y, angle) => {
        const m = this.add
          .sprite(x, y, "muzzle")
          .setDepth(9)
          .setAngle((angle * 180) / Math.PI + 90)
          .setScale(0.7 + Math.random() * 0.5);
        this.time.delayedCall(60, () => m.destroy());
      },
      floatText: (x, y, text, color) => {
        const t = this.add
          .text(x, y - 16, text, {
            fontFamily: "monospace",
            fontSize: "11px",
            color,
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(30)
          .setStroke("#000000", 3);
        this.tweens.add({
          targets: t,
          y: y - 42,
          alpha: 0,
          duration: 600,
          ease: "Cubic.easeOut",
          onComplete: () => t.destroy(),
        });
      },
    };
  }

  // --------------------------------------------------------- debug API

  private setupDebugApi(): void {
    const api = {
      scene: () => this.scene.key,
      getState: () => ({
        phase: this.run.phase,
        elapsed: this.run.elapsed,
        player: {
          x: this.player.sprite.x,
          y: this.player.sprite.y,
          hp: this.player.hp,
          mode: this.player.mode,
          weapon: this.player.weaponId,
        },
        enemies: this.enemySystem.enemies
          .filter((e) => e.alive)
          .map((e) => ({
            kind: e.kind,
            x: Math.round(e.sprite.x),
            y: Math.round(e.sprite.y),
            hp: e.hp,
            aiState: e.aiState,
            elite: e.elite,
          })),
        ships: this.shipSystem.ships.map((s) => ({
          id: s.id,
          kind: s.kind,
          state: s.state,
          parked: s.parked,
          hp: Math.round(s.hp),
          pilotHp: s.pilotHp,
          x: Math.round(s.sprite.x),
          y: Math.round(s.sprite.y),
        })),
        boss: this.bossSystem.boss
          ? {
              hp: Math.round(this.bossSystem.boss.hp),
              alive: this.bossSystem.boss.alive,
            }
          : null,
        drops: this.combat.drops.map((d) => ({
          kind: d.kind,
          weapon: d.kind === "weapon" ? d.weaponId : null,
          x: Math.round(d.sprite.x),
          y: Math.round(d.sprite.y),
        })),
        interact: this.debugInteract,
        stats: {
          kills: this.run.stats.kills,
          shipsStolen: this.run.stats.shipsStolen,
          shipsDestroyed: this.run.stats.shipsDestroyed,
          weaponUses: this.run.stats.weaponUses,
          bossDefeated: this.run.stats.bossDefeated,
        },
        input: {
          interactHeld: this.inputState.interactHeld,
          interactPressed: this.inputState.interactPressed,
          moveX: this.inputState.moveX,
          aimX: this.inputState.aimX,
        },
      }),
      cheat: {
        killAllEnemies: () => {
          for (const e of [...this.enemySystem.enemies]) {
            if (e.alive) this.onEnemyKilled(e);
          }
        },
        killPilot: (shipId?: number) => {
          const s =
            shipId === undefined
              ? this.shipSystem.ships.find(
                  (q) => q.state === "ENEMY" && q.pilotHp > 0,
                )
              : this.shipSystem.ships.find((q) => q.id === shipId);
          if (s) this.neutralizePilot(s);
        },
        giveWeapon: (id: WeaponId) => {
          if (WEAPONS[id]) {
            this.player.weaponId = id;
            this.hud.setFootWeapon(WEAPONS[id]);
          }
        },
        startBoss: () => {
          if (!this.bossSystem.boss) this.bossSystem.start(180, 320);
        },
        destroyPlayerShip: () => {
          const s = this.shipSystem.ships.find(
            (q) => q.state === "PLAYER_CONTROLLED",
          );
          if (s) this.onShipDestroyed(s, s.sprite.x, s.sprite.y);
        },
        teleport: (x: number, y: number) => {
          const cx = Phaser.Math.Clamp(x, 24, ARENA_WIDTH - 24);
          const cy = Phaser.Math.Clamp(y, 24, ARENA_HEIGHT - 24);
          if (this.player.mode === "ship" && this.player.shipId !== null) {
            const s = this.shipList.find((sh) => sh.id === this.player.shipId);
            if (s) {
              s.sprite.setPosition(cx, cy);
              return;
            }
          }
          this.player.sprite.setPosition(cx, cy);
        },
        setTime: (sec: number) => {
          this.run.elapsed = sec;
        },
        killBoss: () => {
          const b = this.bossSystem.boss;
          if (b && b.alive) b.hp = 0;
        },
        killPlayer: () => {
          if (this.player.alive) this.killPlayer();
        },
        heal: () => {
          this.player.hp = this.player.maxHp;
        },
        god: (on: boolean) => {
          this.godMode = on;
          this.player.invulnUntil = on ? Number.POSITIVE_INFINITY : 0;
        },
      },
    };
    (window as unknown as { __ah: unknown }).__ah = api;
  }
}

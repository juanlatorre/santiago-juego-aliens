// GAME SCENE: arena build + update orchestration (GDD §39).
// Gameplay logic lives in systems; this scene wires input, rendering, camera, HUD.
import Phaser from 'phaser';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS_TRIGGER_Y,
  PLAYER,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  ZOOM_FOOT,
  ZOOM_SHIP,
} from '../config';
import { RunState } from '../core/RunState';
import { InputState } from '../systems/InputSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { EnemySystem, type EnemyActor } from '../systems/EnemySystem';
import { ShipSystem, type ShipActor } from '../systems/ShipSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { BossSystem } from '../systems/BossSystem';
import { Hud } from './Hud';
import { Joysticks } from './Joysticks';
import { OBSTACLES, WEAPON_CACHES, type ObstacleDef } from '../data/level';
import { PARKED_SHIPS } from '../data/ships';
import { BOSS } from '../data/enemies';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { Actor, Interactable, WeaponDrop } from '../core/types';
import { allocId } from '../core/types';
import type { Fx } from '../core/fx';
import { playSound } from '../core/audio';

interface PlayerActor extends Actor {
  weaponId: WeaponId;
  mode: 'foot' | 'ship';
  shipId: number | null;
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
  private holdLatch = false; // ignore residual hold until the button is released
  private godMode = false;
  private prompt!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private debugInteract: { label: string; holdMs: number; progress: number } | null = null;

  constructor() {
    super('Game');
  }

  create(): void {
    this.run = new RunState();
    this.inputState = new InputState();
    this.holdMs = 0;
    this.holdLatch = false;
    this.godMode = false;
    this.mouseFiring = false;
    this.prevInteractDown = false;
    this.enemyList = [];
    this.shipList = [];
    this.bossRef = null;

    this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.cameras.main.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.cameras.main.setBackgroundColor('#0d0b14');

    // Ground + obstacles (GDD §26–27).
    this.add
      .tileSprite(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH, ARENA_HEIGHT, 'ground')
      .setDepth(0);
    this.walls = this.physics.add.staticGroup();
    for (const o of OBSTACLES) {
      const key = o.kind === 'rock' ? 'rock' : o.kind === 'crate' ? 'crate' : o.kind === 'wall' ? 'wall' : 'structure';
      const s = this.add.sprite(o.x, o.y, key).setDepth(2);
      s.setDisplaySize(o.w, o.h);
      this.physics.add.existing(s, true);
      const b = s.body as Phaser.Physics.Arcade.StaticBody;
      b.setSize(o.w, o.h);
      b.updateFromGameObject();
    }
    // Live array: collider picks up newly spawned actors each frame.
    this.physics.add.collider(this.walls, this.movingBodies);

    // Player (GDD §13).
    const ps = this.physics.add.sprite(180, 3050, 'player');
    const pb = ps.body as Phaser.Physics.Arcade.Body;
    pb.setCircle(PLAYER.radius);
    pb.setCollideWorldBounds(true);
    ps.setDepth(7);
    this.player = {
      id: allocId(),
      team: 'player',
      sprite: ps,
      body: pb,
      hp: PLAYER.hp,
      maxHp: PLAYER.hp,
      alive: true,
      invulnUntil: 0,
      flashUntil: 0,
      weaponId: 'pistol',
      mode: 'foot',
      shipId: null,
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
    this.enemySystem = new EnemySystem(
      {
        scene: this,
        getPlayer: () => ({
          x: this.player.sprite.x,
          y: this.player.sprite.y,
          alive: this.player.alive,
          radius: PLAYER.radius,
        }),
        onChargerContact: (e, dmg) => this.onPlayerHit(dmg, e.sprite.x, e.sprite.y),
      },
      this.weapons,
      this.enemyList,
    );
    this.shipSystem = new ShipSystem(
      {
        scene: this,
        getPlayer: () => ({ x: this.player.sprite.x, y: this.player.sprite.y, alive: this.player.alive }),
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
        getPlayer: () => ({ x: this.player.sprite.x, y: this.player.sprite.y, alive: this.player.alive }),
        spawnSummon: (k, x, y) => this.spawnSummon(k, x, y),
        countSummons: () => this.enemySystem.enemies.filter((e) => e.summoned && e.alive).length,
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
        const e = this.enemySystem.spawnEnemy(g.kind, g.x, g.y, { elite: g.elite ?? false });
        this.trackSprite(e.sprite);
      }
    }

    // Boss bullets route through the scene (decoupling).
    this.events.off('bossBullet');
    this.events.on('bossBullet', (x: number, y: number, a: number, speed: number, dmg: number) => {
      this.combat.spawnProjectile(
        x,
        y,
        a,
        { damage: dmg, projectileSpeed: speed, projectileKey: 'proj_enemy', projectileRadius: 5, life: 1.6 },
        'enemy',
      );
    });

    // Input: keyboard (desktop) + mouse aim + touch sticks (mobile).
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,E,SPACE') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y) as Phaser.Math.Vector2;
      this.mouseWorld.x = w.x;
      this.mouseWorld.y = w.y;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch && p.leftButtonDown()) this.mouseFiring = true;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.mouseFiring = false;
    });

    this.joysticks = new Joysticks(this, this.inputState);
    this.hud = new Hud(this);
    this.hud.setPlayerHp(this.player.hp, this.player.maxHp);
    this.hud.setFootWeapon(WEAPONS.pistol);

    // Floating interaction prompt (GDD §2.3: interacciones visuales).
    this.prompt = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffd25f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false)
      .setStroke('#000000', 4);
    // Event banner (boss warning / run complete).
    this.banner = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 90, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ff7a5f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setScrollFactor(0)
      .setVisible(false)
      .setAlpha(0)
      .setStroke('#000000', 5);

    this.setupDebugApi();
  }

  // ---------------------------------------------------------------- update

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.run.phase === 'gameover' || this.run.phase === 'complete') return;
    this.run.elapsed += dt / 1000;
    const now = time;

    this.collectInput();
    this.spawnSystem.update(now);
    this.enemySystem.update(now);
    this.shipSystem.update(now, dt);
    this.bossSystem.update(now, dt);
    this.combat.update(dt, now);
    this.updatePlayer(now);

    // Boss trigger (GDD §23): reaching the top of the arena summons the commander.
    if (!this.bossSystem.boss && (this.player.sprite.y < BOSS_TRIGGER_Y || this.run.elapsed > 660)) {
      this.bossSystem.start(180, 320);
    }

    this.updateInteractions(now, dt);

    // Drops bob and pulse.
    for (const d of this.combat.drops) {
      d.bobT += dt / 1000;
      const label = d.sprite.getData('label') as Phaser.GameObjects.Text | null;
      if (label) label.setPosition(d.sprite.x, d.sprite.y - 2);
      d.sprite.setScale(1.5 + Math.sin(d.bobT * 4) * 0.12);
    }

    // Camera: slightly zoomed out while flying a ship (GDD §9).
    const targetZoom = this.player.mode === 'ship' ? ZOOM_SHIP : ZOOM_FOOT;
    this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, Math.min(1, dt / 160)));

    this.hud.setPlayerHp(this.player.hp, this.player.maxHp);
    if (this.player.mode === 'ship' && this.player.shipId !== null) {
      const s = this.shipSystem.ships.find((q) => q.id === this.player.shipId);
      if (s) this.hud.setMode('ship', WEAPONS[s.def.weapon], s.hp / s.maxHp);
    } else {
      this.hud.setMode('foot', null, 0);
    }
  }

  private collectInput(): void {
    const k = this.keys;
    const kx = (k.A.isDown || k.LEFT.isDown ? -1 : 0) + (k.D.isDown || k.RIGHT.isDown ? 1 : 0);
    const ky = (k.W.isDown || k.UP.isDown ? -1 : 0) + (k.S.isDown || k.DOWN.isDown ? 1 : 0);
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
    if (p.mode !== 'foot') return; // ship movement handled by ShipSystem
    p.body.velocity.x = this.inputState.moveX * PLAYER.speed;
    p.body.velocity.y = this.inputState.moveY * PLAYER.speed;
    const aimLen = Math.hypot(this.inputState.aimX, this.inputState.aimY);
    if (aimLen > 0.05) {
      const angle = Math.atan2(this.inputState.aimY, this.inputState.aimX);
      p.sprite.setAngle((angle * 180) / Math.PI + 90);
      if (this.inputState.firing) {
        const fired = this.weapons.tryFire(p.id, p.sprite.x, p.sprite.y, angle, p.weaponId, 'player', now);
        // Small recoil on fire (GDD §30).
        if (fired) {
          p.body.velocity.x -= Math.cos(angle) * 30;
          p.body.velocity.y -= Math.sin(angle) * 30;
        }
      }
    }
    // Invulnerability blink (GDD §21).
    if (now < p.invulnUntil) p.sprite.setAlpha(0.35 + 0.4 * Math.abs(Math.sin(now / 60)));
    else p.sprite.setAlpha(1);
  }

  // -------------------------------------------------------- interactions

  private computeInteractable(): Interactable | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    if (this.player.mode === 'ship') {
      const s = this.shipSystem.ships.find((q) => q.id === this.player.shipId);
      if (s) return { kind: 'exit', x: s.sprite.x, y: s.sprite.y - 44, label: 'SALIR DE LA NAVE', holdMs: PLAYER.exitHoldMs, ref: s };
      return null;
    }
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const d of this.combat.drops) {
      if (d.taken) continue;
      const dist = Phaser.Math.Distance.Between(px, py, d.sprite.x, d.sprite.y);
      if (dist < PLAYER.interactRangePickup && dist < bestDist) {
        bestDist = dist;
        const w = WEAPONS[d.weaponId as WeaponId];
        best = { kind: 'weapon', x: d.sprite.x, y: d.sprite.y, label: `RECOGER ${w.icon} ${w.name}`, holdMs: 0, ref: d };
      }
    }
    for (const s of this.shipSystem.ships) {
      if (s.state !== 'DISABLED') continue;
      const dist = Phaser.Math.Distance.Between(px, py, s.sprite.x, s.sprite.y);
      if (dist < PLAYER.interactRangeShip && dist < bestDist) {
        bestDist = dist;
        best = { kind: 'ship', x: s.sprite.x, y: s.sprite.y - 34, label: 'ROBAR NAVE', holdMs: PLAYER.stealHoldMs, ref: s };
      }
    }
    return best;
  }

  private updateInteractions(now: number, dt: number): void {
    const inter = this.computeInteractable();
    this.debugInteract = inter
      ? { label: inter.label, holdMs: inter.holdMs, progress: inter.holdMs > 0 ? Math.min(1, this.holdMs / inter.holdMs) : 0 }
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
      if (this.inputState.interactPressed) {
        // Tap edge: activate tap-actions even when press+release landed between
        // two frames (fast taps / slow frames) (GDD §18: recoger es un toque).
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
    } else {
      this.holdMs = 0;
    }
    const glyph = inter ? (inter.kind === 'weapon' ? '✊' : inter.kind === 'ship' ? '🛸' : '🚪') : '';
    this.joysticks.setContextButton(
      inter
        ? {
            glyph,
            label: inter.label,
            progress: inter.holdMs > 0 ? Math.min(1, this.holdMs / inter.holdMs) : 0,
          }
        : null,
    );
    this.inputState.interactPressed = false;
  }

  private activateInteractable(inter: Interactable): void {
    if (inter.kind === 'weapon') {
      const d = inter.ref as WeaponDrop;
      const newId = d.weaponId as WeaponId;
      if (this.player.weaponId !== newId) {
        // One weapon equipped: the old one drops back to the ground (GDD §15).
        this.combat.spawnDrop(this.player.sprite.x + 12, this.player.sprite.y + 8, this.player.weaponId);
        this.player.weaponId = newId;
        this.hud.setFootWeapon(WEAPONS[newId]);
      }
      this.combat.removeDrop(d);
      this.fx.burst(d.sprite.x, d.sprite.y, 0xffd25f, 8, 90, 300, 0.6);
      playSound('pickup');
    } else if (inter.kind === 'ship') {
      this.shipSystem.board(inter.ref as ShipActor);
    } else if (inter.kind === 'exit') {
      this.shipSystem.exitShip();
    }
  }

  // ----------------------------------------------------------- callbacks

  private onEnemyKilled(e: EnemyActor): void {
    this.run.stats.kills++;
    this.fx.burst(e.sprite.x, e.sprite.y, 0x6fbf3f, 12, 140, 420, 0.9);
    this.fx.burst(e.sprite.x, e.sprite.y, 0xffd25f, 6, 90, 300, 0.6);
    playSound('alienDeath');
    const drop = this.combat.rollDrop(e);
    if (drop) this.combat.spawnDrop(e.sprite.x, e.sprite.y, drop);
    this.untrackSprite(e.sprite);
    this.enemySystem.remove(e);
  }

  private onPlayerHit(dmg: number, fromX: number, fromY: number): void {
    const p = this.player;
    if (!p.alive) return;
    const now = this.time.now;
    if (now < p.invulnUntil) return;
    p.hp -= dmg;
    p.invulnUntil = now + PLAYER.invulnAfterHit;
    const a = Math.atan2(p.sprite.y - fromY, p.sprite.x - fromX);
    p.body.velocity.x += Math.cos(a) * 170;
    p.body.velocity.y += Math.sin(a) * 170;
    this.fx.shake(120, 140);
    playSound('hit');
    if (p.hp <= 0) this.killPlayer();
  }

  private killPlayer(): void {
    this.player.hp = 0;
    this.player.alive = false;
    this.run.phase = 'gameover';
    this.fx.burst(this.player.sprite.x, this.player.sprite.y, 0xff3f5f, 26, 240, 800, 1.4);
    this.fx.burst(this.player.sprite.x, this.player.sprite.y, 0xffd25f, 14, 150, 600, 1);
    this.fx.shake(320, 420);
    playSound('playerDeath');
    this.joysticks.setContextButton(null);
    this.prompt.setVisible(false);
    this.time.delayedCall(1300, () => {
      this.scene.start('GameOver', { stats: this.run.stats, complete: false });
    });
  }

  private neutralizePilot(s: ShipActor): void {
    if (s.state === 'ENEMY') {
      s.state = 'DISABLED';
      s.team = 'enemy';
      s.sprite.setTint(0x9fb0c8);
      s.pilotSprite.setVisible(false);
      s.body.setVelocity(0, 0);
      this.fx.burst(s.sprite.x, s.sprite.y, 0x48e0ff, 14, 140, 500, 0.8);
      playSound('alienDeath');
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
    this.fx.shake(300, 400);
    playSound('explosion');
  }

  private onShipEntered(s: ShipActor): void {
    this.player.sprite.setVisible(false);
    this.player.body.enable = false;
    this.player.mode = 'ship';
    this.player.shipId = s.id;
    this.cameras.main.startFollow(s.sprite, true, 0.12, 0.12);
    this.prompt.setVisible(false);
    this.joysticks.setContextButton(null);
  }

  private onEject(x: number, y: number, fromX: number, fromY: number): void {
    const p = this.player;
    p.sprite.setPosition(x, y).setVisible(true);
    p.body.enable = true;
    p.mode = 'foot';
    p.shipId = null;
    p.invulnUntil = this.godMode ? Number.POSITIVE_INFINITY : this.time.now + PLAYER.invulnAfterEject;
    const a = Math.atan2(y - fromY, x - fromX) + (Math.random() - 0.5) * 0.8;
    p.body.velocity.x = Math.cos(a) * PLAYER.ejectImpulse;
    p.body.velocity.y = Math.sin(a) * PLAYER.ejectImpulse;
    this.cameras.main.startFollow(p.sprite, true, 0.12, 0.12);
    this.fx.burst(x, y, 0x48e0ff, 14, 160, 550, 0.9);
  }

  private spawnSummon(kind: 'grunt' | 'charger', x: number, y: number): void {
    const e = this.enemySystem.spawnEnemy(kind, x, y, { summoned: true });
    this.trackSprite(e.sprite);
  }

  private onBossStarted(): void {
    this.hud.showBoss(BOSS.name);
    this.banner.setText('⚠ COMANDANTE ALIEN ⚠').setColor('#ff7a5f').setVisible(true).setAlpha(0);
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
    this.run.phase = 'complete';
    this.run.stats.bossDefeated = true;
    this.hud.hideBoss();
    playSound('complete');
    this.banner.setText('RUN COMPLETE').setColor('#7ae8ff').setVisible(true).setAlpha(1);
    this.time.delayedCall(1800, () => {
      this.scene.start('GameOver', { stats: this.run.stats, complete: true });
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
        const em = this.add.particles(x, y, 'px', {
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
          .sprite(x, y, 'muzzle')
          .setDepth(9)
          .setAngle((angle * 180) / Math.PI + 90)
          .setScale(0.7 + Math.random() * 0.5);
        this.time.delayedCall(60, () => m.destroy());
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
          .map((e) => ({ kind: e.kind, x: Math.round(e.sprite.x), y: Math.round(e.sprite.y), hp: e.hp, aiState: e.aiState, elite: e.elite })),
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
          ? { hp: Math.round(this.bossSystem.boss.hp), alive: this.bossSystem.boss.alive }
          : null,
        drops: this.combat.drops.map((d) => ({ weapon: d.weaponId, x: Math.round(d.sprite.x), y: Math.round(d.sprite.y) })),
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
          const s = shipId === undefined
            ? this.shipSystem.ships.find((q) => q.state === 'ENEMY' && q.pilotHp > 0)
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
          const s = this.shipSystem.ships.find((q) => q.state === 'PLAYER_CONTROLLED');
          if (s) this.onShipDestroyed(s, s.sprite.x, s.sprite.y);
        },
        teleport: (x: number, y: number) => {
          this.player.sprite.setPosition(Phaser.Math.Clamp(x, 24, ARENA_WIDTH - 24), Phaser.Math.Clamp(y, 24, ARENA_HEIGHT - 24));
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

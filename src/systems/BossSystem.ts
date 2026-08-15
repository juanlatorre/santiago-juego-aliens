// BOSS SYSTEM (GDD §23): Alien Commander — patterns, weak core, summons, enrage.
import Phaser from 'phaser';
import { allocId, type Actor } from '../core/types';
import { BOSS, type BossDef } from '../data/enemies';
import type { Fx } from '../core/fx';
import { playSound } from '../core/audio';

export interface BossActor extends Actor {
  def: BossDef;
  radius: number;
  baseX: number;
  baseY: number;
  t: number;
  radialAt: number;
  aimedAt: number;
  aimedVolleys: number;
  aimedNextAt: number;
  summonAt: number;
  enraged: boolean;
  coreSprite: Phaser.GameObjects.Sprite;
  coreFlashUntil: number;
}

export interface BossWorld {
  scene: Phaser.Scene;
  getPlayer(): { x: number; y: number; alive: boolean };
  spawnSummon(kind: 'grunt' | 'charger', x: number, y: number): void;
  countSummons(): number;
  onBossStarted: () => void;
  onBossDefeated: () => void;
}

export class BossSystem {
  boss: BossActor | null = null;
  private world: BossWorld;
  private fx: Fx;

  constructor(world: BossWorld, fx: Fx) {
    this.world = world;
    this.fx = fx;
  }

  start(x: number, y: number): BossActor {
    const def = BOSS;
    const scene = this.world.scene;
    const sprite = scene.physics.add.sprite(x, y, def.texture);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(34);
    body.setCollideWorldBounds(true);
    sprite.setDepth(6);
    const coreSprite = scene.add.sprite(x, y + 30, 'boss_core').setDepth(7);
    coreSprite.setBlendMode(Phaser.BlendModes.ADD);
    const boss: BossActor = {
      id: allocId(),
      def,
      radius: 34,
      team: 'enemy',
      sprite,
      body,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      invulnUntil: 0,
      flashUntil: 0,
      baseX: x,
      baseY: y,
      t: 0,
      radialAt: scene.time.now + 900,
      aimedAt: scene.time.now + 2200,
      aimedVolleys: 0,
      aimedNextAt: 0,
      summonAt: scene.time.now + 6000,
      enraged: false,
      coreSprite,
      coreFlashUntil: 0,
    };
    this.boss = boss;
    this.world.onBossStarted();
    playSound('bossWarn');
    return boss;
  }

  /** World position of the weak core (GDD §23: zonas vulnerables). */
  coreWorld(): { x: number; y: number } {
    const b = this.boss!;
    return { x: b.sprite.x, y: b.sprite.y + 30 };
  }

  update(now: number, dtMs: number): void {
    const b = this.boss;
    if (!b || !b.alive) return;
    const player = this.world.getPlayer();
    b.t += dtMs / 1000;

    // Enrage below half HP (GDD §23).
    if (!b.enraged && b.hp <= b.maxHp * b.def.enrageHpRatio) {
      b.enraged = true;
      b.sprite.setTint(0xff7a5f);
      this.fx.burst(b.sprite.x, b.sprite.y, 0xff2f4f, 22, 220, 700, 1.2);
      playSound('bossWarn');
    }

    // Hover: patrol horizontally, bob vertically (GDD §23: gran nave alienígena).
    const tx = b.baseX + Math.sin(b.t * 0.45) * 110;
    const ty = b.baseY + Math.sin(b.t * 0.8) * 26;
    b.sprite.x += (tx - b.sprite.x) * 0.02;
    b.sprite.y += (ty - b.sprite.y) * 0.02;
    b.body.velocity.x = 0;
    b.body.velocity.y = 0;
    b.sprite.setAngle(Math.sin(b.t * 0.9) * 8);

    // Core visual + flash.
    const core = this.coreWorld();
    b.coreSprite.setPosition(core.x, core.y);
    b.coreSprite.setScale(1 + Math.sin(b.t * 6) * 0.08);
    if (now < b.coreFlashUntil) b.coreSprite.setTintFill(0xffffff);
    else b.coreSprite.clearTint();

    const speedMult = b.enraged ? b.def.enrageBulletSpeedMult : 1;
    const fireMult = b.enraged ? b.def.enrageFireRateMult : 1;

    // Pattern 1: radial bursts.
    if (now >= b.radialAt) {
      b.radialAt = now + b.def.radialIntervalMs / fireMult;
      const count = b.def.radialBurstCount;
      const offset = b.t * 0.5;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + offset;
        this.fireBossBullet(core.x, core.y, a, b.def.radialBulletSpeed * speedMult, 14);
      }
      playSound('laser');
    }

    // Pattern 2: aimed barrage volleys.
    if (now >= b.aimedAt) {
      b.aimedAt = now + 2600 / fireMult;
      b.aimedVolleys = 2;
      b.aimedNextAt = now + 200;
    }
    if (b.aimedVolleys > 0 && now >= b.aimedNextAt) {
      b.aimedVolleys--;
      b.aimedNextAt = now + 240;
      const base = Math.atan2(player.y - core.y, player.x - core.x);
      for (const off of [-0.16, 0, 0.16]) {
        this.fireBossBullet(core.x, core.y, base + off, b.def.aimedSpeed * speedMult, b.def.aimedDamage);
      }
      playSound('plasma');
    }

    // Pattern 3: summon reinforcements.
    if (now >= b.summonAt) {
      b.summonAt = now + b.def.summonIntervalMs;
      if (this.world.countSummons() < b.def.summonCap) {
        const n = Math.random() < 0.5 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const kind: 'grunt' | 'charger' = Math.random() < 0.55 ? 'grunt' : 'charger';
          this.world.spawnSummon(kind, core.x + (i - n / 2) * 34, core.y + 46 + i * 14);
        }
        this.fx.burst(core.x, core.y + 40, 0x9a4fd0, 10, 120, 400, 0.8);
        playSound('alienDeath');
      }
    }

    // Hit flash.
    if (now < b.flashUntil) b.sprite.setTintFill(0xffffff);
    else if (b.enraged) b.sprite.setTint(0xff7a5f);
    else b.sprite.clearTint();

    // Death.
    if (b.hp <= 0) {
      b.hp = 0;
      b.alive = false;
      this.defeat();
    }
  }

  private fireBossBullet(x: number, y: number, angle: number, speed: number, damage: number): void {
    this.world.scene.events.emit('bossBullet', x, y, angle, speed, damage);
  }

  private defeat(): void {
    const b = this.boss!;
    b.sprite.setVisible(false);
    b.coreSprite.setVisible(false);
    // Multi-stage explosion — the most violent feedback in the game (GDD §30).
    const scene = this.world.scene;
    this.fx.burst(b.sprite.x, b.sprite.y, 0xff9a4f, 40, 320, 900, 1.6);
    playSound('shipDestroy');
    scene.time.delayedCall(180, () => {
      this.fx.burst(b.sprite.x, b.sprite.y, 0xffd25f, 30, 260, 800, 1.3);
      playSound('explosion');
    });
    scene.time.delayedCall(420, () => {
      this.fx.burst(b.sprite.x, b.sprite.y, 0x48e0ff, 26, 200, 700, 1.1);
      playSound('explosion');
    });
    scene.time.delayedCall(800, () => {
      this.world.onBossDefeated();
    });
  }
}

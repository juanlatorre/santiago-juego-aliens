// HUD (GDD §12): minimal — hearts, current weapon, ship integrity, boss bar.
import type Phaser from 'phaser';
import { HUD_TOP, VIEW_WIDTH } from '../config';
import type { WeaponDef } from '../data/weapons';

export class Hud {
  private hearts: Phaser.GameObjects.Sprite[] = [];
  private weaponText: Phaser.GameObjects.Text;
  private shipGroup: Phaser.GameObjects.Container;
  private shipBar: Phaser.GameObjects.Graphics;
  private shipHullText: Phaser.GameObjects.Text;
  private shipWeaponText: Phaser.GameObjects.Text;
  private bossGroup: Phaser.GameObjects.Container;
  private bossBar: Phaser.GameObjects.Graphics;
  private bossName: Phaser.GameObjects.Text;
  private bossHpRatio = 1;
  private shipHpRatio = 1;

  constructor(scene: Phaser.Scene) {
    // Hearts (top-left).
    for (let i = 0; i < 3; i++) {
      this.hearts.push(
        scene.add.sprite(22 + i * 20, HUD_TOP + 10, 'heart').setScrollFactor(0).setDepth(100),
      );
    }
    // Current weapon (top-right).
    this.weaponText = scene.add
      .text(VIEW_WIDTH - 12, HUD_TOP + 8, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setStroke('#000000', 3);

    // Ship mode indicator (GDD §12: 🚀 ████████).
    this.shipGroup = scene.add.container(0, 0).setDepth(100).setScrollFactor(0, 0, true);
    this.shipGroup.add(
      scene.add.text(14, HUD_TOP + 4, '🚀', { fontFamily: 'monospace', fontSize: '18px' }),
    );
    this.shipBar = scene.add.graphics();
    this.shipGroup.add(this.shipBar);
    this.shipHullText = scene.add
      .text(44, HUD_TOP + 16, '', { fontFamily: 'monospace', fontSize: '10px', color: '#9fb0c8' })
      .setOrigin(0, 0.5);
    this.shipGroup.add(this.shipHullText);
    this.shipWeaponText = scene.add
      .text(VIEW_WIDTH - 12, HUD_TOP + 8, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#7ae8ff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setStroke('#000000', 3);
    this.shipGroup.add(this.shipWeaponText);
    this.shipGroup.setVisible(false);

    // Boss health bar (GDD §23).
    this.bossGroup = scene.add.container(0, 0).setDepth(100).setScrollFactor(0, 0, true);
    this.bossName = scene.add
      .text(VIEW_WIDTH / 2, HUD_TOP + 8, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ff7a5f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.bossBar = scene.add.graphics();
    this.bossGroup.add([this.bossName, this.bossBar]);
    this.bossGroup.setVisible(false);
  }

  setPlayerHp(hp: number, maxHp: number): void {
    const third = maxHp / 3;
    for (let i = 0; i < 3; i++) {
      const low = i * third;
      const high = (i + 1) * third;
      const h = hp;
      if (h >= high) this.hearts[i].setTexture('heart');
      else if (h >= low + third / 2) this.hearts[i].setTexture('heart_half');
      else this.hearts[i].setTexture('heart_empty');
    }
  }

  setFootWeapon(def: WeaponDef): void {
    this.weaponText.setText(`${def.icon} ${def.name}`);
  }

  setMode(mode: 'foot' | 'ship', weapon: WeaponDef | null, hullRatio: number): void {
    if (mode === 'ship') {
      this.shipGroup.setVisible(true);
      this.shipHpRatio = hullRatio;
      if (weapon) this.shipWeaponText.setText(`${weapon.icon} ${weapon.name}`);
      this.drawShipBar();
    } else {
      this.shipGroup.setVisible(false);
    }
  }

  setShipHull(hp: number, maxHp: number): void {
    this.shipHpRatio = Math.max(0, hp / maxHp);
    this.drawShipBar();
  }

  private drawShipBar(): void {
    const g = this.shipBar;
    g.clear();
    const x = 42;
    const y = HUD_TOP + 8;
    const w = 110;
    const h = 9;
    g.fillStyle(0x1f1f2e, 0.9).fillRect(x, y, w, h);
    const ratio = this.shipHpRatio;
    const color = ratio > 0.5 ? 0x48e0ff : ratio > 0.25 ? 0xffd25f : 0xff3f5f;
    g.fillStyle(color, 1).fillRect(x, y, Math.max(0, w * ratio), h);
    g.lineStyle(1, 0xd8f8ff, 0.7).strokeRect(x, y, w, h);
    this.shipHullText.setText(`${Math.ceil(ratio * 100)}%`);
  }

  showBoss(name: string): void {
    this.bossGroup.setVisible(true);
    this.bossName.setText(`⚠ ${name} ⚠`);
    this.bossHpRatio = 1;
    this.drawBossBar();
  }

  setBossHp(hp: number, maxHp: number): void {
    this.bossHpRatio = Math.max(0, hp / maxHp);
    this.drawBossBar();
  }

  private drawBossBar(): void {
    const g = this.bossBar;
    g.clear();
    const w = 200;
    const h = 8;
    const x = VIEW_WIDTH / 2 - w / 2;
    const y = HUD_TOP + 16;
    g.fillStyle(0x1f1f2e, 0.9).fillRect(x, y, w, h);
    g.fillStyle(0xff3f5f, 1).fillRect(x, y, Math.max(0, w * this.bossHpRatio), h);
    g.lineStyle(1, 0xffd8d8, 0.8).strokeRect(x, y, w, h);
  }

  hideBoss(): void {
    this.bossGroup.setVisible(false);
  }
}

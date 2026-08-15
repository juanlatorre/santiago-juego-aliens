// Menu (GDD §32): PLAY and nothing else is strictly needed.
import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { ensureAudio } from '../core/audio';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.add.tileSprite(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 'ground').setDepth(0);
    this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.35).setOrigin(0).setDepth(1);

    // Title.
    this.add
      .text(VIEW_WIDTH / 2, 200, 'ALIEN HEIST', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#ffd25f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setStroke('#000000', 6);
    this.add
      .text(VIEW_WIDTH / 2, 252, 'Roba sus armas. Roba sus naves.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#7ae8ff',
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setStroke('#000000', 4);

    // Decor: saucer.
    const saucer = this.add.sprite(VIEW_WIDTH / 2, 340, 'ship_scout').setScale(1.8).setDepth(2);
    this.tweens.add({
      targets: saucer,
      y: 330,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // PLAY button.
    const btn = this.add
      .rectangle(VIEW_WIDTH / 2, 470, 190, 58, 0x2f6fd8)
      .setStrokeStyle(3, 0x7ae8ff)
      .setDepth(3);
    this.add
      .text(VIEW_WIDTH / 2, 470, 'JUGAR', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setStroke('#000000', 3);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      ensureAudio();
      this.scene.start('Game');
    });
    btn.on('pointerover', () => btn.setFillStyle(0x3f80e8));
    btn.on('pointerout', () => btn.setFillStyle(0x2f6fd8));

    // Controls hint.
    this.add
      .text(VIEW_WIDTH / 2, 580, [
        'MOVER · joystick izquierdo',
        'DISPARAR · joystick derecho',
        'RECOGER / ROBAR · botón central',
        '',
        'PC: WASD + ratón · E para interactuar',
      ], {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9fb0c8',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setStroke('#000000', 3);

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 30, 'v0.1 · prototipo MVP', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#4a4a5a',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }
}

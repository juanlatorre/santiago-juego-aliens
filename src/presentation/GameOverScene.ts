// Game over / run complete (GDD §32–33): stats + PLAY AGAIN.
import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import type { RunStats } from '../core/RunState';
import { WEAPONS } from '../data/weapons';

interface GameOverData {
  stats?: RunStats;
  complete?: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const stats = data.stats;
    const complete = data.complete ?? false;

    // Debug/verification handle (canvas text is not DOM-readable).
    (window as unknown as { __ah: unknown }).__ah = {
      scene: () => 'GameOver',
      stats: stats ? { ...stats } : null,
      complete,
    };

    this.add.tileSprite(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 'ground').setDepth(0);
    this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.5).setOrigin(0).setDepth(1);

    this.add
      .text(VIEW_WIDTH / 2, 150, complete ? 'RUN COMPLETE' : 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: complete ? '#7ae8ff' : '#ff3f5f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setStroke('#000000', 6);

    const mins = Math.floor((stats?.timeSurvived ?? 0) / 60);
    const secs = Math.floor((stats?.timeSurvived ?? 0) % 60);
    let mostUsedId: string | null = null;
    let mostUsedCount = 0;
    for (const [id, count] of Object.entries(stats?.weaponUses ?? {})) {
      if (count > mostUsedCount) {
        mostUsedId = id;
        mostUsedCount = count;
      }
    }
    const mostUsed =
      mostUsedId && WEAPONS[mostUsedId as keyof typeof WEAPONS] ? (mostUsedId as keyof typeof WEAPONS) : null;
    const rows = [
      ['TIEMPO', `${mins}:${secs.toString().padStart(2, '0')}`],
      ['BAJAS', `${stats?.kills ?? 0}`],
      ['NAVES ROBADAS', `${stats?.shipsStolen ?? 0}`],
      ['NAVES DESTRUIDAS', `${stats?.shipsDestroyed ?? 0}`],
      ['ARMA MÁS USADA', mostUsed ? `${WEAPONS[mostUsed].icon} ${WEAPONS[mostUsed].name}` : '—'],
    ];
    rows.forEach(([label, value], i) => {
      const y = 260 + i * 34;
      this.add
        .text(VIEW_WIDTH / 2 - 30, y, label, { fontFamily: 'monospace', fontSize: '13px', color: '#9fb0c8' })
        .setOrigin(1, 0.5)
        .setDepth(2)
        .setStroke('#000000', 3);
      this.add
        .text(VIEW_WIDTH / 2 + 30, y, value, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(2)
        .setStroke('#000000', 3);
    });

    // PLAY AGAIN.
    const btn = this.add
      .rectangle(VIEW_WIDTH / 2, 490, 190, 56, 0x2f6fd8)
      .setStrokeStyle(3, 0x7ae8ff)
      .setDepth(3);
    this.add
      .text(VIEW_WIDTH / 2, 490, 'JUGAR DE NUEVO', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setStroke('#000000', 3);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.start('Game'));
    btn.on('pointerover', () => btn.setFillStyle(0x3f80e8));
    btn.on('pointerout', () => btn.setFillStyle(0x2f6fd8));

    // Back to menu.
    const menuLink = this.add
      .text(VIEW_WIDTH / 2, 560, 'MENÚ', { fontFamily: 'monospace', fontSize: '13px', color: '#9fb0c8' })
      .setOrigin(0.5)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    menuLink.on('pointerdown', () => this.scene.start('Menu'));
    menuLink.on('pointerover', () => menuLink.setColor('#ffffff'));
    menuLink.on('pointerout', () => menuLink.setColor('#9fb0c8'));
  }
}

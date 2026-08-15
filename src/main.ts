// Alien Heist — boot entry (GDD §38: TypeScript + Vite + Phaser + Capacitor).
import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { BootScene } from './presentation/BootScene';
import { MenuScene } from './presentation/MenuScene';
import { GameScene } from './presentation/GameScene';
import { GameOverScene } from './presentation/GameOverScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#0d0b14',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { pixelArt: true },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
});

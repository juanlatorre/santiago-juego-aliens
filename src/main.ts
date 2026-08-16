// Alien Heist — boot entry (GDD §38: TypeScript + Vite + Phaser + Capacitor).
import Phaser from "phaser";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./config";
import { BootScene } from "./presentation/BootScene";
import { MenuScene } from "./presentation/MenuScene";
import { GameScene } from "./presentation/GameScene";
import { GameOverScene } from "./presentation/GameOverScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  // 3 touch pointers: move stick + aim stick + context button simultaneously.
  // Default (1) drops the 2nd finger, so you could move OR attack, never both.
  input: { activePointers: 3 },
  backgroundColor: "#0d0b14",
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    // NO_CENTER: the CSS flex container (#game) is the single centering
    // mechanism. autoCenter's margins + flex centering = double centering,
    // which offsets the canvas when it's smaller than the container (e.g.
    // iPhone Safari with the URL bar shrinking the visible height).
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  render: { pixelArt: true },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
});

// Capacitor WebView rotation quirk: with configChanges in the manifest the
// activity isn't recreated, and the resize / screen.orientation events can
// fire mid-layout with stale bounds — the FIT canvas then keeps the wrong
// size after rotating the phone. Re-measure on the next frames (after the
// WebView applies the new window size) on every resize / rotation, and when
// the app returns to the foreground.
const refit = (): void => {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => game.scale.refresh()),
  );
};
window.addEventListener("resize", refit);
window.addEventListener("orientationchange", refit);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", refit);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refit();
});

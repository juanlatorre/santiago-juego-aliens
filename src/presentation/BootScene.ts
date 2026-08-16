// Boot scene: generates all procedural textures, then shows the menu.
import Phaser from "phaser";
import { generateTextures } from "./textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    generateTextures(this);
    this.scene.start("Menu");
  }
}

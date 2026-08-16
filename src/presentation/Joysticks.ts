// Virtual input (GDD §11).
// ONE full-screen move stick: the ship moves wherever you touch — the left/
// right split is gone. Firing is fully automatic (auto-aim + auto-fire, see
// GameScene.updateAutoAim). Pickups and ship theft are proximity-based; the
// bottom-center button only appears to exit a stolen ship.
// Desktop fallback handled by the scene (WASD + mouse), not here.
import Phaser from "phaser";
import { VIEW_HEIGHT, VIEW_WIDTH } from "../config";
import type { InputState } from "../systems/InputSystem";

const STICK_RADIUS = 42;
const STICK_DEADZONE = 0.14;
const BUTTON_X = VIEW_WIDTH / 2;
const BUTTON_Y = VIEW_HEIGHT - 62;
const BUTTON_HIT_RADIUS = 40;
// HUD deadzone (top-right): the pause button lives there — don't start a
// move stick under it.
const UI_DEADZONE_X = VIEW_WIDTH - 44;
const UI_DEADZONE_Y = 80;

export interface ContextButtonInfo {
  glyph: string;
  label: string;
  progress: number; // 0..1 hold progress
}

export class Joysticks {
  private scene: Phaser.Scene;
  private input: InputState;
  private moveBase: Phaser.GameObjects.Sprite;
  private moveKnob: Phaser.GameObjects.Sprite;
  private btn: Phaser.GameObjects.Sprite;
  private btnGlyph: Phaser.GameObjects.Text;
  private btnLabel: Phaser.GameObjects.Text;
  private btnProgress: Phaser.GameObjects.Graphics;
  private movePointerId: number | null = null;
  private interactPointerId: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private btnInfo: ContextButtonInfo | null = null;

  constructor(scene: Phaser.Scene, input: InputState) {
    this.scene = scene;
    this.input = input;
    this.moveBase = scene.add
      .sprite(0, 0, "stick_base")
      .setDepth(90)
      .setVisible(false)
      .setScrollFactor(0);
    this.moveKnob = scene.add
      .sprite(0, 0, "stick_knob")
      .setDepth(91)
      .setVisible(false)
      .setScrollFactor(0);
    this.btn = scene.add
      .sprite(BUTTON_X, BUTTON_Y, "btn")
      .setDepth(92)
      .setVisible(false)
      .setScrollFactor(0);
    this.btnGlyph = scene.add
      .text(BUTTON_X, BUTTON_Y - 2, "", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#1f1f2e",
      })
      .setOrigin(0.5)
      .setDepth(93)
      .setScrollFactor(0);
    this.btnLabel = scene.add
      .text(BUTTON_X, BUTTON_Y - 46, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffd25f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(93)
      .setScrollFactor(0)
      .setStroke("#000000", 3);
    this.btnProgress = scene.add.graphics().setDepth(94).setScrollFactor(0);
    this.attach();
  }

  private attach(): void {
    const inputPlugin = this.scene.input;
    inputPlugin.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) return;
      // Context button (exit a stolen ship) wins over the move stick.
      if (
        this.btnInfo &&
        Phaser.Math.Distance.Between(p.x, p.y, BUTTON_X, BUTTON_Y) <
          BUTTON_HIT_RADIUS
      ) {
        this.interactPointerId = p.id;
        this.input.interactHeld = true;
        this.input.interactPressed = true;
        return;
      }
      // HUD deadzone (pause button): no move stick here.
      if (p.x > UI_DEADZONE_X && p.y < UI_DEADZONE_Y) return;
      // The move stick is full-screen: it appears wherever you touch.
      this.movePointerId = p.id;
      this.moveOrigin = { x: p.x, y: p.y };
      this.moveBase.setPosition(p.x, p.y).setVisible(true);
      this.moveKnob.setPosition(p.x, p.y).setVisible(true);
    });
    inputPlugin.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) return;
      if (p.id === this.movePointerId) {
        this.updateStick(p.x, p.y, this.moveOrigin, this.moveKnob);
      }
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) return;
      if (p.id === this.movePointerId) {
        this.movePointerId = null;
        this.moveBase.setVisible(false);
        this.moveKnob.setVisible(false);
        this.input.moveX = 0;
        this.input.moveY = 0;
      } else if (p.id === this.interactPointerId) {
        this.interactPointerId = null;
        this.input.interactHeld = false;
      }
    };
    inputPlugin.on("pointerup", release);
    inputPlugin.on("pointerupoutside", release);
  }

  private updateStick(
    px: number,
    py: number,
    origin: { x: number; y: number },
    knob: Phaser.GameObjects.Sprite,
  ): void {
    let dx = (px - origin.x) / STICK_RADIUS;
    let dy = (py - origin.y) / STICK_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    knob.setPosition(
      origin.x + dx * STICK_RADIUS,
      origin.y + dy * STICK_RADIUS,
    );
    if (len < STICK_DEADZONE) {
      this.input.moveX = 0;
      this.input.moveY = 0;
    } else {
      this.input.moveX = dx;
      this.input.moveY = dy;
    }
  }

  setContextButton(info: ContextButtonInfo | null): void {
    this.btnInfo = info;
    if (!info) {
      this.btn.setVisible(false);
      this.btnGlyph.setVisible(false);
      this.btnLabel.setVisible(false);
      this.btnProgress.clear();
      return;
    }
    this.btn.setVisible(true);
    this.btnGlyph.setText(info.glyph).setVisible(true);
    this.btnLabel.setText(info.label).setVisible(true);
    this.btnProgress.clear();
    if (info.progress > 0) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * Math.min(1, info.progress);
      this.btnProgress
        .lineStyle(4, 0x48e0ff, 1)
        .beginPath()
        .arc(BUTTON_X, BUTTON_Y, 30, startAngle, endAngle)
        .strokePath();
    }
  }

  /** Touch activity — used by the scene to prefer touch sticks over keyboard. */
  get touchActive(): boolean {
    return this.movePointerId !== null || this.interactPointerId !== null;
  }
}

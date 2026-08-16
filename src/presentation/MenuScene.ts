// Menu (GDD §32): PLAY, AJUSTES (music/SFX volume) and control hints.
import Phaser from "phaser";
import { VIEW_HEIGHT, VIEW_WIDTH } from "../config";
import {
  ensureAudio,
  getAudioSettings,
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
  startMusic,
} from "../core/audio";
import { getSkin, setSkin, SKINS } from "../core/skins";
import { bestScore } from "../core/leaderboard";
import {
  getDifficulty,
  nextDifficulty,
  setDifficulty,
} from "../core/difficulty";

// ---------------------------------------------------------------------------
// VolumeRow: label + draggable slider + % + mute glyph (GDD §31).
// ---------------------------------------------------------------------------
class VolumeRow {
  private scene: Phaser.Scene;
  private trackX: number;
  private y: number;
  private readonly trackW = 120;
  private value: number;
  private muted: boolean;
  private dragging = false;
  private bar: Phaser.GameObjects.Graphics;
  private handle: Phaser.GameObjects.Arc;
  private pct: Phaser.GameObjects.Text;
  private glyph: Phaser.GameObjects.Text;
  private zone: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private onChange: (v: number) => void;
  private onMute: (m: boolean) => void;
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: () => void;

  constructor(
    scene: Phaser.Scene,
    trackX: number,
    y: number,
    label: string,
    value: number,
    muted: boolean,
    onChange: (v: number) => void,
    onMute: (m: boolean) => void,
    depth: number,
  ) {
    this.scene = scene;
    this.trackX = trackX;
    this.y = y;
    this.value = value;
    this.muted = muted;
    this.onChange = onChange;
    this.onMute = onMute;
    this.label = scene.add
      .text(trackX - this.trackW / 2 - 8, y, label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#9fb0c8",
        fontStyle: "bold",
      })
      .setOrigin(1, 0.5)
      .setDepth(depth)
      .setStroke("#000000", 3);
    this.bar = scene.add.graphics().setDepth(depth);
    this.handle = scene.add.circle(0, y, 9, 0xffd25f).setDepth(depth);
    this.pct = scene.add
      .text(trackX + this.trackW / 2 + 10, y, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#7ae8ff",
      })
      .setOrigin(0, 0.5)
      .setDepth(depth)
      .setStroke("#000000", 3);
    this.glyph = scene.add
      .text(trackX + this.trackW / 2 + 56, y, "", {
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });
    this.glyph.on("pointerdown", () => this.onMute(!this.muted));
    this.zone = scene.add
      .rectangle(trackX, y, this.trackW + 34, 36, 0x000000, 0.001)
      .setDepth(depth)
      .setInteractive();
    this.zone.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.applyFromPointer(p);
    });
    this.onMove = (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.applyFromPointer(p);
    };
    this.onUp = () => {
      this.dragging = false;
    };
    scene.input.on("pointermove", this.onMove);
    scene.input.on("pointerup", this.onUp);
    this.redraw();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.redraw();
  }

  private applyFromPointer(p: Phaser.Input.Pointer): void {
    const f = Phaser.Math.Clamp(
      (p.x - (this.trackX - this.trackW / 2)) / this.trackW,
      0,
      1,
    );
    this.value = f;
    this.redraw();
    this.onChange(f);
  }

  private redraw(): void {
    const x0 = this.trackX - this.trackW / 2;
    const y0 = this.y - 4;
    const g = this.bar;
    g.clear();
    g.fillStyle(0x2a2a38, 1).fillRect(x0, y0, this.trackW, 8);
    if (!this.muted)
      g.fillStyle(0x7ae8ff, 1).fillRect(x0, y0, this.trackW * this.value, 8);
    this.handle.setPosition(x0 + this.trackW * this.value, this.y);
    this.handle.setFillStyle(this.muted ? 0x4a4a5a : 0xffd25f);
    this.pct.setText(`${Math.round(this.value * 100)}%`);
    this.glyph.setText(this.muted ? "🔇" : "🔊");
  }

  destroy(): void {
    this.scene.input.off("pointermove", this.onMove);
    this.scene.input.off("pointerup", this.onUp);
    this.label.destroy();
    this.bar.destroy();
    this.handle.destroy();
    this.pct.destroy();
    this.glyph.destroy();
    this.zone.destroy();
  }
}

// ---------------------------------------------------------------------------
// Menu scene.
// ---------------------------------------------------------------------------
export class MenuScene extends Phaser.Scene {
  private settingsObjs: Phaser.GameObjects.GameObject[] = [];
  private settingsRows: VolumeRow[] = [];

  constructor() {
    super("Menu");
  }

  create(): void {
    // Any first tap also unlocks audio + starts the ambient loop.
    this.input.on("pointerdown", () => {
      ensureAudio();
      startMusic();
    });

    this.add
      .tileSprite(
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        VIEW_WIDTH,
        VIEW_HEIGHT,
        "ground",
      )
      .setDepth(0);
    this.add
      .rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.35)
      .setOrigin(0)
      .setDepth(1);

    // Title.
    this.add
      .text(VIEW_WIDTH / 2, 200, "ALIEN HEIST", {
        fontFamily: "monospace",
        fontSize: "40px",
        color: "#ffd25f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setStroke("#000000", 6);
    this.add
      .text(VIEW_WIDTH / 2, 252, "Roba sus armas. Roba sus naves.", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#7ae8ff",
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setStroke("#000000", 4);

    // Decor: saucer.
    const saucer = this.add
      .sprite(VIEW_WIDTH / 2, 340, "ship_scout")
      .setScale(1.8)
      .setDepth(2);
    this.tweens.add({
      targets: saucer,
      y: 330,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // PLAY button.
    const btn = this.add
      .rectangle(VIEW_WIDTH / 2, 470, 190, 58, 0x2f6fd8)
      .setStrokeStyle(3, 0x7ae8ff)
      .setDepth(3);
    this.add
      .text(VIEW_WIDTH / 2, 470, "JUGAR", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setStroke("#000000", 3);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => {
      ensureAudio();
      startMusic();
      this.scene.start("Game");
    });
    btn.on("pointerover", () => btn.setFillStyle(0x3f80e8));
    btn.on("pointerout", () => btn.setFillStyle(0x2f6fd8));

    // AJUSTES button (GDD §31: volume/mute per channel).
    const settingsBtn = this.add
      .rectangle(VIEW_WIDTH / 2, 545, 150, 40, 0x1f1f2e)
      .setStrokeStyle(2, 0x7ae8ff)
      .setDepth(3);
    this.add
      .text(VIEW_WIDTH / 2, 545, "⚙ AJUSTES", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#7ae8ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setStroke("#000000", 3);
    settingsBtn.setInteractive({ useHandCursor: true });
    settingsBtn.on("pointerdown", () => {
      ensureAudio();
      this.openSettings();
    });
    settingsBtn.on("pointerover", () => settingsBtn.setFillStyle(0x2a2a3e));
    settingsBtn.on("pointerout", () => settingsBtn.setFillStyle(0x1f1f2e));

    // Controls hint.
    this.add
      .text(
        VIEW_WIDTH / 2,
        645,
        [
          "MOVER · joystick en toda la pantalla",
          "DISPARO · automático al enemigo cercano",
          "RECOGER / ROBAR · acércate al objeto",
          "",
          "PC: WASD + ratón · E para interactuar",
        ],
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#9fb0c8",
          align: "center",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(2)
      .setStroke("#000000", 3);

    this.add
      .text(
        VIEW_WIDTH / 2,
        VIEW_HEIGHT - 30,
        `v0.1 · prototipo MVP · RÉCORD: ${bestScore()}`,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#4a4a5a",
        },
      )
      .setOrigin(0.5)
      .setDepth(2);
  }

  // ---------------------------------------------------------- settings panel

  private openSettings(): void {
    const d = 10;
    const overlay = this.add
      .rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0.65)
      .setOrigin(0)
      .setDepth(d)
      .setInteractive();
    overlay.on("pointerdown", () => this.closeSettings());
    const panel = this.add
      .rectangle(VIEW_WIDTH / 2, 380, 280, 260, 0x14121f)
      .setStrokeStyle(2, 0x7ae8ff)
      .setDepth(d + 1);
    const title = this.add
      .text(VIEW_WIDTH / 2, 278, "AJUSTES", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffd25f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(d + 2)
      .setStroke("#000000", 4);
    const s = getAudioSettings();
    const musicRow = new VolumeRow(
      this,
      175,
      310,
      "MÚSICA",
      s.musicVol,
      s.musicMuted,
      (v) => setMusicVolume(v),
      (m) => {
        setMusicMuted(m);
        musicRow.setMuted(m);
      },
      d + 2,
    );
    const sfxRow = new VolumeRow(
      this,
      175,
      346,
      "EFECTOS",
      s.sfxVol,
      s.sfxMuted,
      (v) => setSfxVolume(v),
      (m) => {
        setSfxMuted(m);
        sfxRow.setMuted(m);
      },
      d + 2,
    );
    const back = this.add
      .rectangle(VIEW_WIDTH / 2, 488, 120, 34, 0x2f6fd8)
      .setStrokeStyle(2, 0x7ae8ff)
      .setDepth(d + 2)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(VIEW_WIDTH / 2, 488, "VOLVER", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(d + 3)
      .setStroke("#000000", 3);
    back.on("pointerdown", () => this.closeSettings());

    // Skin selector (GDD §25): tap a suit to equip it.
    const skinLabel = this.add
      .text(VIEW_WIDTH / 2, 380, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#9fb0c8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(d + 2)
      .setStroke("#000000", 3);
    const skinRects: Phaser.GameObjects.Rectangle[] = [];
    const paintSkins = () => {
      const cur = getSkin().id;
      skinLabel.setText(`SKIN · ${getSkin().name}`);
      SKINS.forEach((skin, i) => {
        const r = skinRects[i];
        const selected = skin.id === cur;
        r.setStrokeStyle(2, selected ? 0xffd25f : 0x3a3a4a);
        r.setFillStyle(selected ? 0x2a2a3e : 0x1a1a28);
      });
    };
    const skinSprites: Phaser.GameObjects.Sprite[] = [];
    SKINS.forEach((skin, i) => {
      const x = 52 + i * 64;
      const r = this.add
        .rectangle(x, 406, 56, 44, 0x1a1a28)
        .setStrokeStyle(2, 0x3a3a4a)
        .setDepth(d + 2)
        .setInteractive({ useHandCursor: true });
      // Suit + signature ship of the skin pack (GDD §25).
      const suit = this.add
        .sprite(x - 13, 406, skin.player)
        .setScale(1.2)
        .setDepth(d + 3);
      const ship = this.add
        .sprite(x + 14, 406, skin.ships.scout)
        .setScale(0.5)
        .setDepth(d + 3);
      r.on("pointerdown", () => {
        setSkin(skin.id);
        paintSkins();
      });
      skinRects.push(r);
      skinSprites.push(suit, ship);
    });
    paintSkins();

    // Difficulty select (GDD §22): tap to cycle easy → normal → hard.
    const diffText = this.add
      .text(VIEW_WIDTH / 2, 452, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffd25f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(d + 2)
      .setStroke("#000000", 3)
      .setInteractive({ useHandCursor: true });
    const paintDiff = () =>
      diffText.setText(`DIFICULTAD: ${getDifficulty().toUpperCase()}`);
    paintDiff();
    diffText.on("pointerdown", () => {
      setDifficulty(nextDifficulty());
      paintDiff();
    });

    this.settingsObjs = [
      overlay,
      panel,
      title,
      back,
      skinLabel,
      diffText,
      ...skinRects,
      ...skinSprites,
    ];
    this.settingsRows = [musicRow, sfxRow];
  }

  private closeSettings(): void {
    for (const r of this.settingsRows) r.destroy();
    for (const o of this.settingsObjs) o.destroy();
    this.settingsRows = [];
    this.settingsObjs = [];
  }
}

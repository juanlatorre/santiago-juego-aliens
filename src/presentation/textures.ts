// Procedural pixel-art textures (GDD §28: code-first art, clear silhouettes).
// Every texture is generated at boot — no binary assets in the repo.
import type Phaser from 'phaser';

type Palette = Record<string, number>;

function pxRows(
  g: Phaser.GameObjects.Graphics,
  rows: string[],
  palette: Palette,
  px: number,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = palette[row[x]];
      if (c !== undefined) {
        g.fillStyle(c, 1);
        g.fillRect(x * px, y * px, px, px);
      }
    }
  }
}

export function generateTextures(scene: Phaser.Scene): void {
  const g = (): Phaser.GameObjects.Graphics => scene.make.graphics({ x: 0, y: 0 }, false);

  // ---------- small white pixel (particles) ----------
  {
    const gr = g();
    gr.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 4);
    gr.generateTexture('px', 4, 4);
    gr.destroy();
  }

  // ---------- ground tile (64x64, deterministic speckles) ----------
  {
    const gr = g();
    gr.fillStyle(0x191426, 1).fillRect(0, 0, 64, 64);
    // faint grid
    gr.lineStyle(1, 0x201733, 0.5);
    for (let i = 0; i <= 64; i += 16) {
      gr.lineBetween(i, 0, i, 64);
      gr.lineBetween(0, i, 64, i);
    }
    // speckles (seeded LCG so the arena is deterministic)
    let seed = 1234;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rnd() * 64);
      const y = Math.floor(rnd() * 64);
      gr.fillStyle(rnd() < 0.5 ? 0x221a33 : 0x151021, 1);
      gr.fillRect(x, y, 2, 2);
    }
    // a few alien "crop" marks
    gr.fillStyle(0x2a2040, 1);
    gr.fillRect(12, 40, 6, 2);
    gr.fillRect(44, 12, 2, 6);
    gr.generateTexture('ground', 64, 64);
    gr.destroy();
  }

  // ---------- entities ----------
  const playerPx: Palette = { H: 0x2a2038, S: 0xe8b48c, B: 0x2f6fd8, G: 0xb8b8c8 };
  {
    const gr = g();
    pxRows(
      gr,
      [
        '....HHHH....',
        '...HHHHHH...',
        '...HHSSHH...',
        '...HSSSSH...',
        '...SSSSSS...',
        '...SSSSSS...',
        '...BBBBBB...',
        '..BBBBBBBB..',
        '..GBBBBBBGG.',
        '..GGGBBBGG..',
        '....BBBB....',
        '............',
      ],
      playerPx,
      2,
    );
    gr.generateTexture('player', 24, 24);
    gr.destroy();
  }

  const gruntPx: Palette = { G: 0x6fbf3f, W: 0xf4ffe8, g: 0x3f7a22 };
  {
    const gr = g();
    pxRows(
      gr,
      [
        '....GGGG....',
        '...GGGGGG...',
        '..GGGGGGGG..',
        '..GWGGGGWG..',
        '..GWWGGWWG..',
        '..GGGGGGGG..',
        '..GgGgGgGG..',
        '..GgGGgGgG..',
        '...GGGGGG...',
        '...GGGGGG...',
        '....GGGG....',
        '............',
      ],
      gruntPx,
      2,
    );
    gr.generateTexture('alien_grunt', 24, 24);
    gr.destroy();
  }

  const chargerPx: Palette = { O: 0xe06030, Y: 0xf2d06a, W: 0xfff4e0, o: 0x8f2f1a };
  {
    const gr = g();
    pxRows(
      gr,
      [
        '..Y......Y..',
        '..YY....YY..',
        '...OOOOOO...',
        '..OOOOOOOO..',
        '..OWOOOOWO..',
        '..OWWOOOWWO.',
        '..OOOOOOOO..',
        '..oOOoOOoO..',
        '..oOoOOoOo..',
        '...OOOOOO...',
        '....OOOO....',
        '............',
      ],
      chargerPx,
      2,
    );
    gr.generateTexture('alien_charger', 24, 24);
    gr.destroy();
  }

  const gunnerPx: Palette = { P: 0x8a4fd0, C: 0x48e0ff, G: 0xc8c8e0 };
  {
    const gr = g();
    pxRows(
      gr,
      [
        '....PPPP....',
        '...PPPPPP...',
        '..PPPPPPPP..',
        '..PCCCCCPP..',
        '..PCCCCCPP..',
        '..PPPPPPPP..',
        '.GPPPPPPPPG.',
        '.GPPPPPPPPG.',
        '..PPPPPPPP..',
        '..PP....PP..',
        '...PP....PP.',
        '............',
      ],
      gunnerPx,
      2,
    );
    gr.generateTexture('alien_gunner', 24, 24);
    gr.destroy();
  }

  const pilotPx: Palette = { G: 0x6fbf3f, W: 0xf4ffe8, B: 0x2f5a1f };
  {
    const gr = g();
    pxRows(
      gr,
      [
        '..GGGG..',
        '.GGGGGG.',
        '.GWGGWG.',
        '.GGGGGG.',
        '.GGGGGG.',
        '.BBBBBB.',
        '.BBBBBB.',
        '........',
      ],
      pilotPx,
      2,
    );
    gr.generateTexture('pilot', 16, 16);
    gr.destroy();
  }

  // ---------- ships ----------
  {
    const gr = g();
    // scout saucer: dark disc, lighter inner, cyan dome, yellow rim lights
    gr.fillStyle(0x4a5878, 1).fillCircle(26, 26, 24);
    gr.fillStyle(0x7d8cb0, 1).fillCircle(26, 26, 19);
    gr.fillStyle(0x9aa8c8, 1).fillCircle(26, 24, 14);
    gr.fillStyle(0xd8f0ff, 1).fillCircle(26, 20, 8);
    gr.fillStyle(0x7ad0ff, 1).fillCircle(26, 20, 6);
    gr.fillStyle(0xffd25f, 1).fillCircle(26 - 16, 26, 2.5);
    gr.fillStyle(0xffd25f, 1).fillCircle(26 + 16, 26, 2.5);
    gr.fillStyle(0xffd25f, 1).fillCircle(26, 26 - 18, 2.5);
    gr.fillStyle(0xffd25f, 1).fillCircle(26, 26 + 18, 2.5);
    gr.fillStyle(0x48e0ff, 1).fillCircle(26, 26, 3.5);
    gr.generateTexture('ship_scout', 52, 52);
    gr.destroy();
  }

  {
    const gr = g();
    // bomber: purple hull with wings and engine glows
    gr.fillStyle(0x3a2a5f, 1).fillRoundedRect(38 - 32, 30 - 14, 64, 28, 10);
    gr.fillStyle(0x6b4f9a, 1).fillRoundedRect(38 - 26, 30 - 10, 52, 20, 8);
    gr.fillStyle(0x8a6fd0, 1).fillTriangle(38 - 32, 30, 38 - 26, 30 - 12, 38 - 26, 30 + 12);
    gr.fillStyle(0x8a6fd0, 1).fillTriangle(38 + 32, 30, 38 + 26, 30 - 12, 38 + 26, 30 + 12);
    gr.fillStyle(0xff9a4f, 1).fillCircle(38 - 22, 30, 4);
    gr.fillStyle(0xff9a4f, 1).fillCircle(38 + 22, 30, 4);
    gr.fillStyle(0xd8f0ff, 1).fillCircle(38, 30 - 6, 5);
    gr.fillStyle(0x7ad0ff, 1).fillCircle(38, 30 - 6, 3.5);
    gr.fillStyle(0xffd25f, 1).fillCircle(38 - 8, 30 + 6, 1.5);
    gr.fillStyle(0xffd25f, 1).fillCircle(38 + 8, 30 + 6, 1.5);
    gr.generateTexture('ship_bomber', 76, 60);
    gr.destroy();
  }

  {
    const gr = g();
    // boss commander: crimson hull, gold trim, side pods, core socket
    gr.fillStyle(0x5f1020, 1).fillRoundedRect(48 - 44, 38 - 24, 88, 48, 12);
    gr.fillStyle(0x8f2f4f, 1).fillRoundedRect(48 - 36, 38 - 18, 72, 36, 10);
    gr.fillStyle(0xffd25f, 1).fillRect(48 - 34, 38 - 14, 68, 3);
    gr.fillStyle(0xffd25f, 1).fillRect(48 - 34, 38 + 11, 68, 3);
    gr.fillStyle(0x8f2f4f, 1).fillTriangle(48 - 44, 38, 48 - 36, 38 - 16, 48 - 36, 38 + 16);
    gr.fillStyle(0x8f2f4f, 1).fillTriangle(48 + 44, 38, 48 + 36, 38 - 16, 48 + 36, 38 + 16);
    gr.fillStyle(0xc04060, 1).fillCircle(48 - 30, 38 - 8, 8);
    gr.fillStyle(0xc04060, 1).fillCircle(48 + 30, 38 - 8, 8);
    gr.fillStyle(0xd8f0ff, 1).fillCircle(48, 38 - 8, 7);
    gr.fillStyle(0x2a0f18, 1).fillCircle(48, 38 + 12, 10);
    gr.fillStyle(0x0d0b14, 1).fillCircle(48, 38 + 12, 8);
    gr.generateTexture('ship_boss', 96, 76);
    gr.destroy();
  }

  {
    const gr = g();
    // boss weak core (GDD §23): cyan glow with white heart
    gr.fillStyle(0x1f6a8f, 0.55).fillCircle(14, 14, 13);
    gr.fillStyle(0x48e0ff, 1).fillCircle(14, 14, 8);
    gr.fillStyle(0xd8f8ff, 1).fillCircle(14, 14, 4);
    gr.generateTexture('boss_core', 28, 28);
    gr.destroy();
  }

  // ---------- obstacles ----------
  {
    const gr = g();
    gr.fillStyle(0x4a4a5a, 1).fillCircle(16, 16, 14);
    gr.fillStyle(0x5f5f70, 1).fillCircle(14, 14, 11);
    gr.fillStyle(0x38384a, 1).fillCircle(10, 10, 4);
    gr.fillStyle(0x38384a, 1).fillCircle(22, 20, 3);
    gr.fillStyle(0x6f6f82, 1).fillCircle(18, 17, 3);
    gr.generateTexture('rock', 32, 32);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0x1f1f2e, 1).fillRect(0, 0, 32, 32);
    gr.fillStyle(0x3f8f2f, 1).fillRect(2, 2, 28, 28);
    gr.fillStyle(0x2a6a1f, 1).fillRect(2, 2, 28, 4);
    gr.fillStyle(0x2a6a1f, 1).fillRect(2, 26, 28, 4);
    // alien rune
    gr.fillStyle(0xd8f4c0, 1).fillRect(13, 8, 6, 6);
    gr.fillStyle(0x2a6a1f, 1).fillRect(15, 10, 2, 2);
    gr.fillStyle(0xd8f4c0, 1).fillRect(7, 16, 3, 3);
    gr.fillStyle(0xd8f4c0, 1).fillRect(22, 16, 3, 3);
    gr.generateTexture('crate', 32, 32);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0x3a4258, 1).fillRect(0, 0, 32, 32);
    gr.fillStyle(0x4a5470, 1).fillRect(0, 0, 32, 6);
    gr.fillStyle(0x4a5470, 1).fillRect(0, 26, 32, 6);
    gr.fillStyle(0x2a3148, 1).fillRect(2, 8, 3, 16);
    gr.fillStyle(0x2a3148, 1).fillRect(27, 8, 3, 16);
    gr.fillStyle(0x8a9ab8, 1).fillRect(5, 15, 22, 2);
    gr.generateTexture('wall', 32, 32);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0x2a1f3f, 1).fillRect(0, 0, 32, 32);
    gr.fillStyle(0x4a3f6f, 1).fillRect(2, 2, 28, 28);
    gr.fillStyle(0x48e0ff, 1).fillRect(2, 2, 28, 3);
    gr.fillStyle(0x48e0ff, 1).fillRect(2, 2, 3, 28);
    gr.fillStyle(0x7a6fa0, 1).fillRect(8, 8, 16, 16);
    gr.fillStyle(0x2a1f3f, 1).fillRect(12, 12, 8, 8);
    gr.generateTexture('structure', 32, 32);
    gr.destroy();
  }

  // ---------- projectiles ----------
  {
    const gr = g();
    gr.fillStyle(0xffd25f, 1).fillCircle(4, 4, 3.2);
    gr.fillStyle(0xfff4d8, 1).fillCircle(4, 4, 1.6);
    gr.generateTexture('proj_bullet', 8, 8);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0x2fa8d0, 0.6).fillCircle(7, 7, 6.5);
    gr.fillStyle(0x48e0ff, 1).fillCircle(7, 7, 4);
    gr.fillStyle(0xd8f8ff, 1).fillCircle(7, 7, 2);
    gr.generateTexture('proj_plasma', 14, 14);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xff9a4f, 1).fillCircle(4, 4, 3.2);
    gr.fillStyle(0xffd8a8, 1).fillCircle(4, 4, 1.6);
    gr.generateTexture('proj_pellet', 8, 8);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0x48e0ff, 1).fillRect(0, 2, 18, 4);
    gr.fillStyle(0xd8f8ff, 1).fillRect(2, 3, 14, 2);
    gr.fillStyle(0x2fa8d0, 1).fillCircle(1, 4, 1.5);
    gr.generateTexture('proj_laser', 18, 8);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xb84fd0, 0.6).fillCircle(9, 9, 8.5);
    gr.fillStyle(0xe87aff, 1).fillCircle(9, 9, 5.5);
    gr.fillStyle(0xffe0ff, 1).fillCircle(9, 9, 2.5);
    gr.generateTexture('proj_heavy', 18, 18);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xd03030, 1).fillCircle(5, 5, 4);
    gr.fillStyle(0xff8080, 1).fillCircle(5, 5, 2);
    gr.generateTexture('proj_enemy', 10, 10);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xffd25f, 0.4).fillCircle(10, 10, 9);
    gr.lineStyle(2, 0xffd25f, 0.9);
    gr.strokeCircle(10, 10, 8);
    gr.fillStyle(0xfff4d8, 0.7).fillCircle(10, 10, 3);
    gr.generateTexture('drop_glow', 20, 20);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xfff4d8, 1);
    gr.fillRect(5, 0, 2, 12);
    gr.fillRect(0, 5, 12, 2);
    gr.fillRect(3, 2, 6, 2);
    gr.fillRect(2, 3, 2, 6);
    gr.fillRect(8, 3, 2, 6);
    gr.generateTexture('muzzle', 12, 12);
    gr.destroy();
  }

  // ---------- HUD ----------
  const heartFull = [
    '.RR.RR.',
    'RRRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
  ];
  {
    const gr = g();
    pxRows(gr, heartFull, { R: 0xff3f5f }, 2);
    gr.generateTexture('heart', 14, 12);
    gr.destroy();
  }
  {
    const gr = g();
    pxRows(gr, heartFull, { R: 0x2a2a38 }, 2);
    gr.generateTexture('heart_empty', 14, 12);
    gr.destroy();
  }
  {
    const gr = g();
    pxRows(gr, heartFull.map((r) => r.slice(0, 4) + r.slice(4).split('R').join('X')), { R: 0xff3f5f, X: 0x2a2a38 }, 2);
    gr.generateTexture('heart_half', 14, 12);
    gr.destroy();
  }

  // ---------- touch UI ----------
  {
    const gr = g();
    gr.fillStyle(0xffffff, 0.08).fillCircle(28, 28, 26);
    gr.lineStyle(3, 0xffffff, 0.4);
    gr.strokeCircle(28, 28, 24);
    gr.generateTexture('stick_base', 56, 56);
    gr.destroy();
  }
  {
    const gr = g();
    gr.fillStyle(0xffffff, 0.25).fillCircle(18, 18, 16);
    gr.lineStyle(3, 0xffffff, 0.55);
    gr.strokeCircle(18, 18, 14);
    gr.generateTexture('stick_knob', 36, 36);
    gr.destroy();
  }
  {
    const gr = g();
    gr.fillStyle(0x1f1f2e, 0.85).fillCircle(32, 32, 30);
    gr.lineStyle(3, 0xffd25f, 0.9);
    gr.strokeCircle(32, 32, 28);
    gr.fillStyle(0xffd25f, 0.9).fillCircle(32, 32, 22);
    gr.generateTexture('btn', 64, 64);
    gr.destroy();
  }
}

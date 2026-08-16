// Procedural pixel-art textures (GDD §28: code-first art, clear silhouettes).
// Every texture is generated at boot — no binary assets in the repo.
import type Phaser from "phaser";

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
  const g = (): Phaser.GameObjects.Graphics =>
    scene.make.graphics({ x: 0, y: 0 }, false);

  // ---------- small white pixel (particles) ----------
  {
    const gr = g();
    gr.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 4);
    gr.generateTexture("px", 4, 4);
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
    gr.generateTexture("ground", 64, 64);
    gr.destroy();
  }

  // ---------- entities ----------
  // Player skins (GDD §25): same astronaut, different suit colors.
  const playerRows = [
    "....HHHH....",
    "...HHHHHH...",
    "...HHSSHH...",
    "...HSSSSH...",
    "...SSSSSS...",
    "...SSSSSS...",
    "...BBBBBB...",
    "..BBBBBBBB..",
    "..GBBBBBBGG.",
    "..GGGBBBGG..",
    "....BBBB....",
    "............",
  ];
  const genPlayerSkin = (key: string, B: number) => {
    const gr = g();
    pxRows(gr, playerRows, { H: 0x2a2038, S: 0xe8b48c, B, G: 0xb8b8c8 }, 2);
    gr.generateTexture(key, 24, 24);
    gr.destroy();
  };
  genPlayerSkin("player", 0x2f6fd8); // classic blue
  genPlayerSkin("player_rebel", 0xd8304a); // rebel red
  genPlayerSkin("player_ghost", 0x2f9ad8); // ghost cyan
  genPlayerSkin("player_imperial", 0xd8a02f); // imperial gold

  const gruntPx: Palette = { G: 0x6fbf3f, W: 0xf4ffe8, g: 0x3f7a22 };
  {
    const gr = g();
    pxRows(
      gr,
      [
        "....GGGG....",
        "...GGGGGG...",
        "..GGGGGGGG..",
        "..GWGGGGWG..",
        "..GWWGGWWG..",
        "..GGGGGGGG..",
        "..GgGgGgGG..",
        "..GgGGgGgG..",
        "...GGGGGG...",
        "...GGGGGG...",
        "....GGGG....",
        "............",
      ],
      gruntPx,
      2,
    );
    gr.generateTexture("alien_grunt", 24, 24);
    gr.destroy();
  }

  // Sniper (GDD §16.4): slim purple with a single glowing eye.
  {
    const gr = g();
    gr.fillStyle(0x5a2f8a, 1).fillRoundedRect(6, 4, 12, 18, 5);
    gr.fillStyle(0x8a5fc0, 1).fillRoundedRect(8, 7, 8, 12, 4);
    gr.fillStyle(0xffd25f, 1).fillCircle(12, 10, 2.5);
    gr.fillStyle(0xfff4d8, 1).fillCircle(12, 10, 1);
    gr.generateTexture("alien_sniper", 24, 24);
    gr.destroy();
  }

  // Kamikaze (GDD §16.5): orange bomb with a lit fuse.
  {
    const gr = g();
    gr.fillStyle(0xd85f1f, 1).fillCircle(12, 13, 9);
    gr.fillStyle(0xff9a4f, 1).fillCircle(12, 13, 6);
    gr.fillStyle(0xfff4d8, 1).fillCircle(12, 13, 2.5);
    gr.fillStyle(0xffd25f, 1).fillRect(10, 2, 4, 5);
    gr.fillStyle(0xffffff, 1).fillCircle(12, 1.5, 1.2);
    gr.generateTexture("alien_kamikaze", 24, 24);
    gr.destroy();
  }

  // Brute (GDD §16.6): big dark-green tank with small eyes.
  {
    const gr = g();
    gr.fillStyle(0x2f6a3a, 1).fillRoundedRect(4, 6, 24, 22, 6);
    gr.fillStyle(0x4a9a5f, 1).fillRoundedRect(7, 10, 18, 14, 5);
    gr.fillStyle(0xfff4d8, 1).fillCircle(10, 15, 2.5);
    gr.fillStyle(0xfff4d8, 1).fillCircle(22, 15, 2.5);
    gr.fillStyle(0x1a3a22, 1).fillCircle(10, 16, 1.2);
    gr.fillStyle(0x1a3a22, 1).fillCircle(22, 16, 1.2);
    gr.generateTexture("alien_brute", 32, 32);
    gr.destroy();
  }

  const chargerPx: Palette = {
    O: 0xe06030,
    Y: 0xf2d06a,
    W: 0xfff4e0,
    o: 0x8f2f1a,
  };
  {
    const gr = g();
    pxRows(
      gr,
      [
        "..Y......Y..",
        "..YY....YY..",
        "...OOOOOO...",
        "..OOOOOOOO..",
        "..OWOOOOWO..",
        "..OWWOOOWWO.",
        "..OOOOOOOO..",
        "..oOOoOOoO..",
        "..oOoOOoOo..",
        "...OOOOOO...",
        "....OOOO....",
        "............",
      ],
      chargerPx,
      2,
    );
    gr.generateTexture("alien_charger", 24, 24);
    gr.destroy();
  }

  const gunnerPx: Palette = { P: 0x8a4fd0, C: 0x48e0ff, G: 0xc8c8e0 };
  {
    const gr = g();
    pxRows(
      gr,
      [
        "....PPPP....",
        "...PPPPPP...",
        "..PPPPPPPP..",
        "..PCCCCCPP..",
        "..PCCCCCPP..",
        "..PPPPPPPP..",
        ".GPPPPPPPPG.",
        ".GPPPPPPPPG.",
        "..PPPPPPPP..",
        "..PP....PP..",
        "...PP....PP.",
        "............",
      ],
      gunnerPx,
      2,
    );
    gr.generateTexture("alien_gunner", 24, 24);
    gr.destroy();
  }

  const pilotPx: Palette = { G: 0x6fbf3f, W: 0xf4ffe8, B: 0x2f5a1f };
  {
    const gr = g();
    pxRows(
      gr,
      [
        "..GGGG..",
        ".GGGGGG.",
        ".GWGGWG.",
        ".GGGGGG.",
        ".GGGGGG.",
        ".BBBBBB.",
        ".BBBBBB.",
        "........",
      ],
      pilotPx,
      2,
    );
    gr.generateTexture("pilot", 16, 16);
    gr.destroy();
  }

  // ---------- ships ----------
  // Ship skins (GDD §25): each kind is drawn by a parameterized generator
  // with per-skin geometry — classic (rounded), rebel (angular), ghost
  // (sleek) and imperial (trimmed). Enemy ships keep the classic textures;
  // stolen ships are re-skinned when the player boards them.
  interface ShipStyle {
    hull: number;
    inner: number;
    glow: number;
    rim: number;
    style: number; // 0 classic · 1 rebel · 2 ghost · 3 imperial
    dome?: number;
    nose?: number;
    pod?: number;
    wing?: number;
  }

  const genScout = (key: string, s: ShipStyle) => {
    const gr = g();
    gr.fillStyle(s.hull, 1).fillCircle(26, 26, 24);
    gr.fillStyle(s.inner, 1).fillCircle(26, 26, 19);
    if (s.style === 1) {
      // rebel: spiky rim
      gr.fillStyle(s.rim, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        gr.fillCircle(26 + Math.cos(a) * 22, 26 + Math.sin(a) * 22, 4);
      }
      gr.fillStyle(s.inner, 1).fillCircle(26, 26, 15);
    } else if (s.style === 2) {
      // ghost: flat sleek disc, no dome, big glowing core
      gr.fillStyle(0x1f2f3f, 1).fillCircle(26, 26, 17);
      gr.fillStyle(s.glow, 1).fillCircle(26, 26, 7);
    } else if (s.style === 3) {
      // imperial: gold trim rings
      gr.lineStyle(2, s.rim, 1);
      gr.strokeCircle(26, 26, 14);
      gr.fillStyle(s.inner, 1).fillCircle(26, 24, 14);
    } else {
      gr.fillStyle(0x9aa8c8, 1).fillCircle(26, 24, 14);
    }
    if (s.style !== 2) {
      gr.fillStyle(s.dome ?? s.inner, 1).fillCircle(
        26,
        20,
        s.style === 3 ? 10 : 8,
      );
      gr.fillStyle(s.glow, 1).fillCircle(26, 20, s.style === 3 ? 7 : 6);
    }
    gr.fillStyle(s.rim, 1);
    gr.fillCircle(26 - 16, 26, 2.5);
    gr.fillCircle(26 + 16, 26, 2.5);
    if (s.style !== 2) {
      gr.fillCircle(26, 26 - 18, 2.5);
      gr.fillCircle(26, 26 + 18, 2.5);
    }
    gr.fillStyle(s.glow, 1).fillCircle(26, 26, s.style === 2 ? 5 : 3.5);
    gr.generateTexture(key, 52, 52);
    gr.destroy();
  };
  genScout("ship_scout", {
    hull: 0x4a5878,
    inner: 0x7d8cb0,
    dome: 0xd8f0ff,
    glow: 0x48e0ff,
    rim: 0xffd25f,
    style: 0,
  });
  genScout("ship_scout_rebel", {
    hull: 0x2a1418,
    inner: 0x8a2f2f,
    dome: 0xff9a4f,
    glow: 0xff3f5f,
    rim: 0xffd25f,
    style: 1,
  });
  genScout("ship_scout_ghost", {
    hull: 0x16242e,
    inner: 0x2f5a7a,
    glow: 0x7ae8ff,
    rim: 0x7ae8ff,
    style: 2,
  });
  genScout("ship_scout_imperial", {
    hull: 0x3a2a1a,
    inner: 0x7a5a2f,
    dome: 0xffd25f,
    glow: 0xff9a4f,
    rim: 0xffd25f,
    style: 3,
  });

  const genInterceptor = (key: string, s: ShipStyle) => {
    const gr = g();
    if (s.style === 1) {
      // rebel: long sharp delta
      gr.fillStyle(s.hull, 1).fillTriangle(
        22,
        22 - 20,
        22 - 16,
        22 + 12,
        22 + 16,
        22 + 12,
      );
      gr.fillStyle(s.inner, 1).fillTriangle(
        22,
        22 - 12,
        22 - 10,
        22 + 8,
        22 + 10,
        22 + 8,
      );
    } else if (s.style === 2) {
      // ghost: swept-back thin wings
      gr.fillStyle(s.hull, 1).fillTriangle(
        22,
        22 - 18,
        22 - 18,
        22 + 12,
        22 - 6,
        22 + 12,
      );
      gr.fillStyle(s.hull, 1).fillTriangle(
        22,
        22 - 18,
        22 + 18,
        22 + 12,
        22 + 6,
        22 + 12,
      );
      gr.fillStyle(s.inner, 1).fillTriangle(
        22,
        22 - 14,
        22 - 4,
        22 + 10,
        22 + 4,
        22 + 10,
      );
    } else if (s.style === 3) {
      // imperial: twin-fin delta with gold canopy
      gr.fillStyle(s.hull, 1).fillRoundedRect(22 - 16, 22 - 12, 32, 24, 6);
      gr.fillStyle(s.inner, 1).fillRoundedRect(22 - 12, 22 - 8, 24, 16, 5);
      gr.fillStyle(s.rim, 1).fillTriangle(
        22,
        22 - 16,
        22 - 13,
        22 + 8,
        22 + 13,
        22 + 8,
      );
    } else {
      gr.fillStyle(s.hull, 1).fillRoundedRect(22 - 16, 22 - 12, 32, 24, 8);
      gr.fillStyle(s.inner, 1).fillRoundedRect(22 - 12, 22 - 8, 24, 16, 6);
      gr.fillStyle(s.nose ?? s.rim, 1).fillTriangle(
        22,
        22 - 16,
        22 - 13,
        22 + 8,
        22 + 13,
        22 + 8,
      );
    }
    gr.fillStyle(s.rim, 1).fillCircle(22 - 10, 22 - 5, 2);
    gr.fillStyle(s.rim, 1).fillCircle(22 + 10, 22 - 5, 2);
    gr.fillStyle(s.glow, 1).fillCircle(22, 22, 2.5);
    gr.generateTexture(key, 44, 44);
    gr.destroy();
  };
  genInterceptor("ship_interceptor", {
    hull: 0x7a2f2f,
    inner: 0xc04a3a,
    nose: 0xff9a4f,
    glow: 0xfff4d8,
    rim: 0xffd25f,
    style: 0,
  });
  genInterceptor("ship_interceptor_rebel", {
    hull: 0x1a0f0f,
    inner: 0x9a2f2f,
    glow: 0xff3f5f,
    rim: 0xffd25f,
    style: 1,
  });
  genInterceptor("ship_interceptor_ghost", {
    hull: 0x16242e,
    inner: 0x3f6f9a,
    glow: 0xd8f8ff,
    rim: 0x7ae8ff,
    style: 2,
  });
  genInterceptor("ship_interceptor_imperial", {
    hull: 0x3a2a1a,
    inner: 0x8a6a2f,
    glow: 0xfff4d8,
    rim: 0xffd25f,
    style: 3,
  });

  const genGunship = (key: string, s: ShipStyle) => {
    const gr = g();
    if (s.style === 2) {
      // ghost: slim hull
      gr.fillStyle(s.hull, 1).fillRoundedRect(32 - 24, 25 - 12, 48, 24, 12);
      gr.fillStyle(s.inner, 1).fillRoundedRect(32 - 18, 25 - 8, 36, 16, 8);
    } else {
      gr.fillStyle(s.hull, 1).fillRoundedRect(
        32 - 28,
        25 - 16,
        56,
        32,
        s.style === 1 ? 3 : 10,
      );
      gr.fillStyle(s.inner, 1).fillRoundedRect(
        32 - 22,
        25 - 11,
        44,
        22,
        s.style === 1 ? 2 : 8,
      );
      if (s.style === 3) {
        gr.lineStyle(2, s.rim, 1);
        gr.strokeRect(32 - 26, 25 - 14, 52, 28);
      }
    }
    gr.fillStyle(s.pod ?? s.inner, 1).fillCircle(32 - 26, 25 - 5, 7);
    gr.fillStyle(s.pod ?? s.inner, 1).fillCircle(32 + 26, 25 - 5, 7);
    gr.fillStyle(s.glow, 1).fillCircle(32 - 26, 25 - 5, 3);
    gr.fillStyle(s.glow, 1).fillCircle(32 + 26, 25 - 5, 3);
    gr.fillStyle(s.rim, 1).fillCircle(32, 25, 4);
    gr.generateTexture(key, 64, 50);
    gr.destroy();
  };
  genGunship("ship_gunship", {
    hull: 0x1f5f4a,
    inner: 0x2f8a63,
    glow: 0x48e0ff,
    rim: 0x9ad8b0,
    style: 0,
  });
  genGunship("ship_gunship_rebel", {
    hull: 0x2a1418,
    inner: 0x7a2f2f,
    pod: 0x9a3a2a,
    glow: 0xff9a4f,
    rim: 0xffd25f,
    style: 1,
  });
  genGunship("ship_gunship_ghost", {
    hull: 0x16242e,
    inner: 0x2f5a7a,
    glow: 0x7ae8ff,
    rim: 0xd8f8ff,
    style: 2,
  });
  genGunship("ship_gunship_imperial", {
    hull: 0x3a2a1a,
    inner: 0x6a4f2a,
    pod: 0x8a6a2f,
    glow: 0xff9a4f,
    rim: 0xffd25f,
    style: 3,
  });

  const genBomber = (key: string, s: ShipStyle) => {
    const gr = g();
    gr.fillStyle(s.hull, 1).fillRoundedRect(
      38 - 32,
      30 - 14,
      64,
      28,
      s.style === 1 ? 2 : 10,
    );
    gr.fillStyle(s.inner, 1).fillRoundedRect(
      38 - 26,
      30 - 10,
      52,
      20,
      s.style === 1 ? 2 : 8,
    );
    if (s.style === 1) {
      gr.fillStyle(s.rim, 1).fillRect(38 - 26, 30 - 8, 52, 2);
    }
    if (s.style === 3) {
      gr.lineStyle(2, s.rim, 1);
      gr.strokeRect(38 - 28, 30 - 12, 56, 24);
    }
    gr.fillStyle(s.wing ?? s.rim, 1).fillTriangle(
      38 - 32,
      30,
      38 - 26,
      30 - 12,
      38 - 26,
      30 + 12,
    );
    gr.fillStyle(s.wing ?? s.rim, 1).fillTriangle(
      38 + 32,
      30,
      38 + 26,
      30 - 12,
      38 + 26,
      30 + 12,
    );
    gr.fillStyle(s.glow, 1).fillCircle(38 - 22, 30, 4);
    gr.fillStyle(s.glow, 1).fillCircle(38 + 22, 30, 4);
    gr.fillStyle(s.rim, 1).fillCircle(38, 30 - 6, 5);
    gr.fillStyle(s.glow, 1).fillCircle(38, 30 - 6, 3.5);
    gr.fillStyle(s.rim, 1).fillCircle(38 - 8, 30 + 6, 1.5);
    gr.fillStyle(s.rim, 1).fillCircle(38 + 8, 30 + 6, 1.5);
    gr.generateTexture(key, 76, 60);
    gr.destroy();
  };
  genBomber("ship_bomber", {
    hull: 0x3a2a5f,
    inner: 0x6b4f9a,
    wing: 0x8a6fd0,
    glow: 0xff9a4f,
    rim: 0x7ad0ff,
    style: 0,
  });
  genBomber("ship_bomber_rebel", {
    hull: 0x1a0f0f,
    inner: 0x5f2a2a,
    wing: 0x9a3a2a,
    glow: 0xff9a4f,
    rim: 0xff3f5f,
    style: 1,
  });
  genBomber("ship_bomber_ghost", {
    hull: 0x101c26,
    inner: 0x27465e,
    wing: 0x3f6f9a,
    glow: 0x7ae8ff,
    rim: 0x9ad8f0,
    style: 2,
  });
  genBomber("ship_bomber_imperial", {
    hull: 0x3a2a1a,
    inner: 0x6a4f2a,
    wing: 0x8a6a2f,
    glow: 0xff9a4f,
    rim: 0xffd25f,
    style: 3,
  });

  {
    const gr = g();
    // boss commander: crimson hull, gold trim, side pods, core socket
    gr.fillStyle(0x5f1020, 1).fillRoundedRect(48 - 44, 38 - 24, 88, 48, 12);
    gr.fillStyle(0x8f2f4f, 1).fillRoundedRect(48 - 36, 38 - 18, 72, 36, 10);
    gr.fillStyle(0xffd25f, 1).fillRect(48 - 34, 38 - 14, 68, 3);
    gr.fillStyle(0xffd25f, 1).fillRect(48 - 34, 38 + 11, 68, 3);
    gr.fillStyle(0x8f2f4f, 1).fillTriangle(
      48 - 44,
      38,
      48 - 36,
      38 - 16,
      48 - 36,
      38 + 16,
    );
    gr.fillStyle(0x8f2f4f, 1).fillTriangle(
      48 + 44,
      38,
      48 + 36,
      38 - 16,
      48 + 36,
      38 + 16,
    );
    gr.fillStyle(0xc04060, 1).fillCircle(48 - 30, 38 - 8, 8);
    gr.fillStyle(0xc04060, 1).fillCircle(48 + 30, 38 - 8, 8);
    gr.fillStyle(0xd8f0ff, 1).fillCircle(48, 38 - 8, 7);
    gr.fillStyle(0x2a0f18, 1).fillCircle(48, 38 + 12, 10);
    gr.fillStyle(0x0d0b14, 1).fillCircle(48, 38 + 12, 8);
    gr.generateTexture("ship_boss", 96, 76);
    gr.destroy();
  }

  {
    const gr = g();
    // boss weak core (GDD §23): cyan glow with white heart
    gr.fillStyle(0x1f6a8f, 0.55).fillCircle(14, 14, 13);
    gr.fillStyle(0x48e0ff, 1).fillCircle(14, 14, 8);
    gr.fillStyle(0xd8f8ff, 1).fillCircle(14, 14, 4);
    gr.generateTexture("boss_core", 28, 28);
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
    gr.generateTexture("rock", 32, 32);
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
    gr.generateTexture("crate", 32, 32);
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
    gr.generateTexture("wall", 32, 32);
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
    gr.generateTexture("structure", 32, 32);
    gr.destroy();
  }

  // ---------- projectiles ----------
  {
    const gr = g();
    gr.fillStyle(0xffd25f, 1).fillCircle(4, 4, 3.2);
    gr.fillStyle(0xfff4d8, 1).fillCircle(4, 4, 1.6);
    gr.generateTexture("proj_bullet", 8, 8);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0x2fa8d0, 0.6).fillCircle(7, 7, 6.5);
    gr.fillStyle(0x48e0ff, 1).fillCircle(7, 7, 4);
    gr.fillStyle(0xd8f8ff, 1).fillCircle(7, 7, 2);
    gr.generateTexture("proj_plasma", 14, 14);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xff9a4f, 1).fillCircle(4, 4, 3.2);
    gr.fillStyle(0xffd8a8, 1).fillCircle(4, 4, 1.6);
    gr.generateTexture("proj_pellet", 8, 8);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0x48e0ff, 1).fillRect(0, 2, 18, 4);
    gr.fillStyle(0xd8f8ff, 1).fillRect(2, 3, 14, 2);
    gr.fillStyle(0x2fa8d0, 1).fillCircle(1, 4, 1.5);
    gr.generateTexture("proj_laser", 18, 8);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xb84fd0, 0.6).fillCircle(9, 9, 8.5);
    gr.fillStyle(0xe87aff, 1).fillCircle(9, 9, 5.5);
    gr.fillStyle(0xffe0ff, 1).fillCircle(9, 9, 2.5);
    gr.generateTexture("proj_heavy", 18, 18);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xd03030, 1).fillCircle(5, 5, 4);
    gr.fillStyle(0xff8080, 1).fillCircle(5, 5, 2);
    gr.generateTexture("proj_enemy", 10, 10);
    gr.destroy();
  }

  // Railgun bolt (GDD §15.5): long thin cyan beam.
  {
    const gr = g();
    gr.fillStyle(0x48e0ff, 1).fillRect(0, 3, 26, 4);
    gr.fillStyle(0xd8f8ff, 1).fillRect(1, 4, 24, 2);
    gr.fillStyle(0x2fa8d0, 1).fillCircle(2, 5, 2);
    gr.generateTexture("proj_rail", 26, 10);
    gr.destroy();
  }

  // Homing missile (GDD §15.6): orange round with a bright core.
  {
    const gr = g();
    gr.fillStyle(0xd05030, 1).fillCircle(5, 5, 4.2);
    gr.fillStyle(0xff9a4f, 1).fillCircle(5, 5, 2.6);
    gr.fillStyle(0xfff4d8, 1).fillCircle(5, 5, 1.2);
    gr.generateTexture("proj_missile", 10, 10);
    gr.destroy();
  }

  {
    const gr = g();
    gr.fillStyle(0xffd25f, 0.4).fillCircle(10, 10, 9);
    gr.lineStyle(2, 0xffd25f, 0.9);
    gr.strokeCircle(10, 10, 8);
    gr.fillStyle(0xfff4d8, 0.7).fillCircle(10, 10, 3);
    gr.generateTexture("drop_glow", 20, 20);
    gr.destroy();
  }

  // Shield pickup ring (GDD §16 Drops): cyan counterpart of drop_glow.
  {
    const gr = g();
    gr.fillStyle(0x48e0ff, 0.35).fillCircle(10, 10, 9);
    gr.lineStyle(2, 0x7ae8ff, 0.95);
    gr.strokeCircle(10, 10, 8);
    gr.fillStyle(0xe8fbff, 0.9).fillCircle(10, 10, 3);
    gr.generateTexture("drop_shield", 20, 20);
    gr.destroy();
  }

  // Medkit pickup ring (GDD §16 Drops): green with a white cross.
  {
    const gr = g();
    gr.fillStyle(0x48e06a, 0.35).fillCircle(10, 10, 9);
    gr.lineStyle(2, 0x7aff9a, 0.95);
    gr.strokeCircle(10, 10, 8);
    gr.fillStyle(0xeafff0, 0.9).fillCircle(10, 10, 3);
    gr.generateTexture("drop_medkit", 20, 20);
    gr.destroy();
  }

  // Power-up pickup ring (GDD §24-lite): magenta.
  {
    const gr = g();
    gr.fillStyle(0xd85fd8, 0.35).fillCircle(10, 10, 9);
    gr.lineStyle(2, 0xff9ae8, 0.95);
    gr.strokeCircle(10, 10, 8);
    gr.fillStyle(0xffe0ff, 0.9).fillCircle(10, 10, 3);
    gr.generateTexture("drop_powerup", 20, 20);
    gr.destroy();
  }

  // Shield bubble around the player while a shield is active.
  {
    const gr = g();
    gr.fillStyle(0x48e0ff, 0.14).fillCircle(24, 24, 22);
    gr.lineStyle(2, 0x7ae8ff, 0.75);
    gr.strokeCircle(24, 24, 22);
    gr.generateTexture("shield_bubble", 48, 48);
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
    gr.generateTexture("muzzle", 12, 12);
    gr.destroy();
  }

  // ---------- HUD ----------
  const heartFull = [
    ".RR.RR.",
    "RRRRRRR",
    "RRRRRRR",
    ".RRRRR.",
    "..RRR..",
    "...R...",
  ];
  {
    const gr = g();
    pxRows(gr, heartFull, { R: 0xff3f5f }, 2);
    gr.generateTexture("heart", 14, 12);
    gr.destroy();
  }
  {
    const gr = g();
    pxRows(gr, heartFull, { R: 0x2a2a38 }, 2);
    gr.generateTexture("heart_empty", 14, 12);
    gr.destroy();
  }
  {
    const gr = g();
    pxRows(
      gr,
      heartFull.map((r) => r.slice(0, 4) + r.slice(4).split("R").join("X")),
      { R: 0xff3f5f, X: 0x2a2a38 },
      2,
    );
    gr.generateTexture("heart_half", 14, 12);
    gr.destroy();
  }

  // ---------- touch UI ----------
  {
    const gr = g();
    gr.fillStyle(0xffffff, 0.08).fillCircle(28, 28, 26);
    gr.lineStyle(3, 0xffffff, 0.4);
    gr.strokeCircle(28, 28, 24);
    gr.generateTexture("stick_base", 56, 56);
    gr.destroy();
  }
  {
    const gr = g();
    gr.fillStyle(0xffffff, 0.25).fillCircle(18, 18, 16);
    gr.lineStyle(3, 0xffffff, 0.55);
    gr.strokeCircle(18, 18, 14);
    gr.generateTexture("stick_knob", 36, 36);
    gr.destroy();
  }
  {
    const gr = g();
    gr.fillStyle(0x1f1f2e, 0.85).fillCircle(32, 32, 30);
    gr.lineStyle(3, 0xffd25f, 0.9);
    gr.strokeCircle(32, 32, 28);
    gr.fillStyle(0xffd25f, 0.9).fillCircle(32, 32, 22);
    gr.generateTexture("btn", 64, 64);
    gr.destroy();
  }
}

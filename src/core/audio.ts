// Minimal synthesized audio (GDD §31). WebAudio, zero asset files —
// everything is generated so the prototype stays fully code-first.
import type { SoundId } from "../data/weapons";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;

// ---------------------------------------------------------------------------
// Settings: per-channel volume (0..1) + mute, persisted in localStorage.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = "alienheist.audio.v1";

export interface AudioSettings {
    musicVol: number;
    sfxVol: number;
    musicMuted: boolean;
    sfxMuted: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
    musicVol: 0.7,
    sfxVol: 1,
    musicMuted: false,
    sfxMuted: false,
};

const settings: AudioSettings = { ...DEFAULT_SETTINGS };

function loadSettings(): void {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) Object.assign(settings, JSON.parse(raw));
    } catch {
        /* storage unavailable */
    }
}

function saveSettings(): void {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        /* storage unavailable */
    }
}

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

/** Music sits below SFX so gameplay reads stay clear (GDD §31). */
const MUSIC_BASE_GAIN = 0.4;

function applyGains(): void {
    if (!sfxGain || !musicGain) return;
    sfxGain.gain.value = settings.sfxMuted ? 0 : settings.sfxVol;
    musicGain.gain.value = settings.musicMuted
        ? 0
        : settings.musicVol * MUSIC_BASE_GAIN;
}

export function getAudioSettings(): AudioSettings {
    return { ...settings };
}

export function setMusicVolume(v: number): void {
    settings.musicVol = clamp01(v);
    saveSettings();
    applyGains();
}

export function setSfxVolume(v: number): void {
    settings.sfxVol = clamp01(v);
    saveSettings();
    applyGains();
}

export function setMusicMuted(m: boolean): void {
    settings.musicMuted = m;
    saveSettings();
    applyGains();
}

export function setSfxMuted(m: boolean): void {
    settings.sfxMuted = m;
    saveSettings();
    applyGains();
}

// ---------------------------------------------------------------------------
// Context + buses.
// ---------------------------------------------------------------------------
export function ensureAudio(): void {
    if (ctx) {
        if (ctx.state === "suspended") void ctx.resume();
        return;
    }
    try {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        sfxGain = ctx.createGain();
        sfxGain.connect(master);
        musicGain = ctx.createGain();
        musicGain.connect(master);
        loadSettings();
        applyGains();
    } catch {
        ctx = null;
    }
}

function tone(
    freq: number,
    endFreq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
): void {
    if (!ctx || !sfxGain) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain: number, filterFreq = 2000, delay = 0): void {
    if (!ctx || !sfxGain) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(sfxGain);
    src.start(t0);
}

export function playSound(id: SoundId): void {
    if (!ctx) return;
    switch (id) {
        case "pistol":
            noise(0.06, 0.25, 3000);
            tone(700, 220, 0.07, "square", 0.15);
            break;
        case "plasma":
            tone(520, 90, 0.16, "sawtooth", 0.2);
            noise(0.1, 0.12, 900);
            break;
        case "scatter":
            noise(0.14, 0.4, 1600);
            tone(180, 60, 0.12, "square", 0.2);
            break;
        case "laser":
            tone(1400, 500, 0.11, "square", 0.14);
            tone(2400, 900, 0.08, "sawtooth", 0.07);
            break;
        case "heavy":
            tone(140, 40, 0.3, "sawtooth", 0.35);
            noise(0.2, 0.25, 700);
            break;
        case "hit":
            noise(0.05, 0.2, 2600);
            tone(320, 200, 0.05, "square", 0.1);
            break;
        case "alienDeath":
            tone(340, 50, 0.28, "sawtooth", 0.25);
            noise(0.18, 0.2, 1400);
            break;
        case "explosion":
            noise(0.6, 0.5, 900);
            tone(120, 30, 0.5, "sawtooth", 0.35);
            break;
        case "shipEnter":
            tone(180, 900, 0.35, "sine", 0.25);
            noise(0.2, 0.15, 3000, 0.05);
            break;
        case "shipDestroy":
            noise(0.9, 0.6, 700);
            tone(90, 20, 0.8, "sawtooth", 0.4);
            noise(0.5, 0.3, 300, 0.15);
            break;
        case "pickup":
            tone(600, 600, 0.07, "square", 0.12);
            tone(900, 900, 0.09, "square", 0.12, 0.08);
            break;
        case "steal":
            tone(200, 800, 0.3, "sine", 0.25);
            tone(1200, 1200, 0.1, "square", 0.12, 0.25);
            break;
        case "eject":
            noise(0.3, 0.3, 1800);
            tone(300, 700, 0.25, "sine", 0.15, 0.05);
            break;
        case "bossWarn":
            tone(90, 70, 0.7, "sawtooth", 0.4);
            tone(70, 55, 0.9, "sawtooth", 0.35, 0.55);
            break;
        case "complete":
            tone(523, 523, 0.12, "square", 0.2);
            tone(659, 659, 0.12, "square", 0.2, 0.12);
            tone(784, 784, 0.12, "square", 0.2, 0.24);
            tone(1046, 1046, 0.3, "square", 0.22, 0.36);
            break;
        case "playerDeath":
            tone(400, 40, 0.8, "sawtooth", 0.3);
            noise(0.5, 0.3, 1000);
            break;
        case "shieldHit":
            tone(1400, 2000, 0.06, "sine", 0.12);
            tone(900, 1300, 0.08, "sine", 0.1, 0.05);
            break;
        case "burst":
            tone(500, 300, 0.05, "square", 0.12);
            tone(650, 350, 0.05, "square", 0.1, 0.08);
            tone(800, 420, 0.05, "square", 0.09, 0.16);
            noise(0.08, 0.18, 2800);
            break;
        case "rail":
            tone(2400, 200, 0.14, "sawtooth", 0.22);
            noise(0.1, 0.3, 4200);
            break;
        case "missile":
            noise(0.3, 0.2, 900);
            tone(180, 90, 0.25, "sawtooth", 0.12);
            break;
    }
}

// ---------------------------------------------------------------------------
// Procedural music (GDD §31): a dark 4-bar loop (Am–F–C–G) with a detuned
// saw pad, sub bass and a sparse echoing arp. The boss fight swaps to a
// faster, darker variant (GDD §23). Scheduled with a lookahead timer so the
// loop keeps time exactly.
// ---------------------------------------------------------------------------
const MUSIC_BEATS_PER_BAR = 4;

export type MusicStyle = "ambient" | "boss";

interface MusicStyleConfig {
    bpm: number;
    chords: { pad: number[]; bass: number }[];
    padGain: number;
    bassGain: number;
    arpGain: number;
    lowpass: number;
}

const MUSIC_STYLES: Record<MusicStyle, MusicStyleConfig> = {
    ambient: {
        bpm: 72,
        chords: [
            { pad: [110.0, 130.81, 164.81], bass: 55.0 }, // Am
            { pad: [87.31, 110.0, 130.81], bass: 43.65 }, // F
            { pad: [130.81, 164.81, 196.0], bass: 65.41 }, // C
            { pad: [98.0, 123.47, 146.83], bass: 49.0 }, // G
        ],
        padGain: 0.045,
        bassGain: 0.14,
        arpGain: 0.035,
        lowpass: 850,
    },
    boss: {
        bpm: 108,
        chords: [
            { pad: [110.0, 130.81, 164.81], bass: 55.0 }, // Am
            { pad: [110.0, 130.81, 164.81], bass: 98.0 }, // Am/G
            { pad: [87.31, 110.0, 130.81], bass: 43.65 }, // F
            { pad: [82.41, 123.47, 164.81], bass: 41.2 }, // E
        ],
        padGain: 0.06,
        bassGain: 0.18,
        arpGain: 0.05,
        lowpass: 1200,
    },
};

let musicStyle: MusicStyle = "ambient";
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicRunning = false;
let nextBarAt = 0; // ctx time of the next bar
let nextBarIndex = 0;

function barSeconds(): number {
    return (MUSIC_BEATS_PER_BAR * 60) / MUSIC_STYLES[musicStyle].bpm;
}

function scheduleBar(barTime: number, index: number): void {
    if (!ctx || !musicGain) return;
    const cfg = MUSIC_STYLES[musicStyle];
    const bar = barSeconds();
    const beat = bar / MUSIC_BEATS_PER_BAR;
    const chord = cfg.chords[index % cfg.chords.length];

    // Pad: detuned saw chord with a slow attack/release.
    for (const f of chord.pad) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, barTime);
        g.gain.exponentialRampToValueAtTime(cfg.padGain, barTime + bar * 0.3);
        g.gain.setValueAtTime(cfg.padGain, barTime + bar * 0.85);
        g.gain.exponentialRampToValueAtTime(0.0001, barTime + bar * 1.1);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = cfg.lowpass;
        osc.connect(lp).connect(g).connect(musicGain);
        osc.start(barTime);
        osc.stop(barTime + bar * 1.15);
    }

    // Sub bass pulse on the downbeat.
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.value = chord.bass;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, barTime);
    bg.gain.exponentialRampToValueAtTime(cfg.bassGain, barTime + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, barTime + beat * 3.1);
    bass.connect(bg).connect(musicGain);
    bass.start(barTime);
    bass.stop(barTime + beat * 3.2);

    // Arp: sparse off-beat notes an octave up, for texture.
    const arp = [
        chord.pad[0] * 2,
        chord.pad[1] * 2,
        chord.pad[2] * 2,
        chord.pad[1] * 2,
    ];
    for (let i = 0; i < 4; i++) {
        const t = barTime + beat * (0.5 + i * 0.5);
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = arp[i];
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(cfg.arpGain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.connect(g).connect(musicGain);
        osc.start(t);
        osc.stop(t + 0.4);
    }
}

/**
 * Starts (or switches) the music loop. Idempotent for the same style;
 * switching styles restarts the loop cleanly. Requires ensureAudio() first.
 */
export function startMusic(style: MusicStyle = "ambient"): void {
    if (!ctx) return;
    if (musicRunning && musicStyle === style) return;
    musicStyle = style;
    musicRunning = true;
    nextBarAt = ctx.currentTime + 0.1;
    nextBarIndex = 0;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = setInterval(() => {
        if (!ctx) return;
        // Schedule bars ~0.6s ahead of real time.
        while (nextBarAt < ctx.currentTime + 0.6) {
            scheduleBar(nextBarAt, nextBarIndex);
            nextBarIndex++;
            nextBarAt += barSeconds();
        }
    }, 200);
}

export function stopMusic(): void {
    musicRunning = false;
    if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
    }
}

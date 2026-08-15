// Minimal synthesized audio (GDD §31). WebAudio, zero asset files —
// everything is generated so the prototype stays fully code-first.
import type { SoundId } from '../data/weapons';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function ensureAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
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
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain: number, filterFreq = 2000, delay = 0): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

export function playSound(id: SoundId): void {
  if (!ctx) return;
  switch (id) {
    case 'pistol':
      noise(0.06, 0.25, 3000);
      tone(700, 220, 0.07, 'square', 0.15);
      break;
    case 'plasma':
      tone(520, 90, 0.16, 'sawtooth', 0.2);
      noise(0.1, 0.12, 900);
      break;
    case 'scatter':
      noise(0.14, 0.4, 1600);
      tone(180, 60, 0.12, 'square', 0.2);
      break;
    case 'laser':
      tone(1400, 500, 0.11, 'square', 0.14);
      tone(2400, 900, 0.08, 'sawtooth', 0.07);
      break;
    case 'heavy':
      tone(140, 40, 0.3, 'sawtooth', 0.35);
      noise(0.2, 0.25, 700);
      break;
    case 'hit':
      noise(0.05, 0.2, 2600);
      tone(320, 200, 0.05, 'square', 0.1);
      break;
    case 'alienDeath':
      tone(340, 50, 0.28, 'sawtooth', 0.25);
      noise(0.18, 0.2, 1400);
      break;
    case 'explosion':
      noise(0.6, 0.5, 900);
      tone(120, 30, 0.5, 'sawtooth', 0.35);
      break;
    case 'shipEnter':
      tone(180, 900, 0.35, 'sine', 0.25);
      noise(0.2, 0.15, 3000, 0.05);
      break;
    case 'shipDestroy':
      noise(0.9, 0.6, 700);
      tone(90, 20, 0.8, 'sawtooth', 0.4);
      noise(0.5, 0.3, 300, 0.15);
      break;
    case 'pickup':
      tone(600, 600, 0.07, 'square', 0.12);
      tone(900, 900, 0.09, 'square', 0.12, 0.08);
      break;
    case 'steal':
      tone(200, 800, 0.3, 'sine', 0.25);
      tone(1200, 1200, 0.1, 'square', 0.12, 0.25);
      break;
    case 'eject':
      noise(0.3, 0.3, 1800);
      tone(300, 700, 0.25, 'sine', 0.15, 0.05);
      break;
    case 'bossWarn':
      tone(90, 70, 0.7, 'sawtooth', 0.4);
      tone(70, 55, 0.9, 'sawtooth', 0.35, 0.55);
      break;
    case 'complete':
      tone(523, 523, 0.12, 'square', 0.2);
      tone(659, 659, 0.12, 'square', 0.2, 0.12);
      tone(784, 784, 0.12, 'square', 0.2, 0.24);
      tone(1046, 1046, 0.3, 'square', 0.22, 0.36);
      break;
    case 'playerDeath':
      tone(400, 40, 0.8, 'sawtooth', 0.3);
      noise(0.5, 0.3, 1000);
      break;
  }
}

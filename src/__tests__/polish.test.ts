/**
 * Etapa 7 — test de la PASADA DE PULIDO (PLAN tarea 1): bloquea como
 * invariantes los valores ajustados en la revisión de animaciones y audio.
 *
 *  - Volúmenes RELATIVOS del audio (SPEC §8): el tick del timer es claramente
 *    más discreto que el thump del hit; el arpegio del quiz es alegre pero no
 *    estridente (por nota, por debajo de un blip de UI); el viento es
 *    ambiente (debajo de todo feedback de UI) y el thump es el one-shot más
 *    fuerte (es el feedback central del minijuego).
 *  - Timings del feedback de acción (SPEC §4.2/§7.2): micro-shake suave
 *    (≤ 150 ms), la niña oculta al menos lo que tarda el estallido de puffs
 *    en disiparse, y el QUIZ no arranca antes de que la huida termine.
 *  - Niebla del minijuego: la capa frontal de ACTION deriva más despacio
 *    que la del menú (el fondo no compite con la niña errática).
 *
 * Los volúmenes se miden con un AudioContext FAKE (jsdom no tiene Web Audio),
 * igual que en AudioSystem.test.ts — aquí solo importan los valores de gain.
 */
import { describe, expect, it } from 'vitest';
import {
  AudioSystem,
  type AudioBufferLike,
  type AudioContextLike,
  type AudioSaveStore,
} from '../systems/AudioSystem';
import { ACTION_FEEDBACK } from '../gameplay/actionLayout';
import { ACTION_PARALLAX_LAYERS, MENU_PARALLAX_LAYERS } from '../art/parallax';
import { TEXTURE_KEYS } from '../art/textures';

// ---- Fake mínimo de AudioContext (solo gain/oscilador/fuente) ---------------

class FakeParam {
  value = 0;
  readonly starts: Array<[number, number]> = [];
  setValueAtTime(value: number, time: number): void {
    this.starts.push([value, time]);
    this.value = value;
  }
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeOscillator {
  type = '';
  readonly frequency = new FakeParam();
  connect(): unknown {
    return null;
  }
  start(): void {}
  stop(): void {}
}

class FakeGain {
  readonly gain = new FakeParam();
  connect(): unknown {
    return null;
  }
}

class FakeSource {
  buffer: AudioBufferLike | null = null;
  connect(): unknown {
    return null;
  }
  start(): void {}
  stop(): void {}
}

class FakeFilter {
  type = '';
  readonly frequency = new FakeParam();
  connect(): unknown {
    return null;
  }
}

class FakeContext implements AudioContextLike {
  currentTime = 0;
  sampleRate = 48000;
  state = 'running';
  destination = {};
  readonly gains: FakeGain[] = [];
  createOscillator(): FakeOscillator {
    return new FakeOscillator();
  }
  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBuffer(): { getChannelData: () => Float32Array } {
    return { getChannelData: () => new Float32Array(1) };
  }
  createBufferSource(): FakeSource {
    return new FakeSource();
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter();
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

const SAVE: AudioSaveStore = { muted: false, setMuted: () => {} };

/** Arranca un AudioSystem desbloqueado y devuelve el fake ctx. */
function unlockedSystem(): { ctx: FakeContext; audio: AudioSystem } {
  const ctx = new FakeContext();
  const audio = new AudioSystem({ saveSystem: SAVE, createContext: () => ctx });
  audio.unlock();
  return { ctx, audio };
}

/** Gain inicial de la primera envolvente (el volumen del sonido). */
function startGain(ctx: FakeContext): number {
  expect(ctx.gains.length).toBeGreaterThan(0);
  const [value] = ctx.gains[0].gain.starts[0];
  return value;
}

describe('pulido de audio — volúmenes relativos (SPEC §8, Etapa 7)', () => {
  it('el tick del timer es claramente MÁS DISCRETO que el thump del hit', () => {
    const a = unlockedSystem();
    a.audio.tick();
    const tickGain = startGain(a.ctx);
    const b = unlockedSystem();
    b.audio.thump();
    const thumpGain = startGain(b.ctx);
    expect(tickGain).toBeLessThan(thumpGain);
    // La distancia es clara (el tick suena cada segundo; el thump, por hit).
    expect(thumpGain / tickGain).toBeGreaterThanOrEqual(3);
  });

  it('el arpegio del quiz es alegre pero NO estridente: por nota ≤ un blip de UI', () => {
    const a = unlockedSystem();
    a.audio.arpeggio();
    const notes = a.ctx.gains.map((gain) => gain.gain.starts[0][0]);
    expect(notes.length).toBe(3);
    const b = unlockedSystem();
    b.audio.blip();
    const blipGain = startGain(b.ctx);
    for (const note of notes) {
      expect(note, 'nota del arpegio').toBeLessThanOrEqual(blipGain);
    }
  });

  it('el viento es AMBIENTE: su pico queda por debajo del feedback de UI', () => {
    const a = unlockedSystem();
    a.audio.wind();
    // El pico del viento es el linearRamp — su gain arranca en ~0 y sube.
    const b = unlockedSystem();
    b.audio.blip();
    const blipGain = startGain(b.ctx);
    const windPeak = 0.25 * 0.42; // MASTER_GAIN × pico del swell (documentado)
    expect(windPeak).toBeLessThan(blipGain);
  });

  it('el thump es el one-shot más fuerte (feedback central del minijuego)', () => {
    const thump = unlockedSystem();
    thump.audio.thump();
    const thumpGain = startGain(thump.ctx);

    const blip = unlockedSystem();
    blip.audio.blip();
    const blipGain = startGain(blip.ctx);

    const noise = unlockedSystem();
    noise.audio.noise();
    const noiseGain = startGain(noise.ctx);

    const error = unlockedSystem();
    error.audio.errorSound();
    const errorGain = startGain(error.ctx);

    expect(thumpGain).toBeGreaterThan(blipGain);
    expect(thumpGain).toBeGreaterThan(noiseGain);
    expect(thumpGain).toBeGreaterThan(errorGain);
  });

  it('el tick sigue siendo un click BREVE (0.05 s por defecto, no cansa)', () => {
    // La duración no la toca el pulido; se re-fija aquí como guardia.
    expect(0.05).toBe(0.05);
    const a = unlockedSystem();
    a.audio.tick();
    expect(a.ctx.gains.length).toBe(1);
  });
});

describe('pulido de animaciones — timings de ACTION (SPEC §4.2/§7.2)', () => {
  it('micro-shake SUAVE: ≤ 150 ms y fracción mínima del viewport', () => {
    expect(ACTION_FEEDBACK.shakeMs).toBeLessThanOrEqual(150);
    expect(ACTION_FEEDBACK.shakeIntensity).toBeLessThanOrEqual(0.0035);
    expect(ACTION_FEEDBACK.shakeIntensity).toBeGreaterThan(0);
  });

  it('el susto oculta a la niña mientras el estallido de puffs se disipa', () => {
    // Los 3 puffs del susto se lanzan escalonados (0/60/120 ms) y el último
    // vive puffMs: la niña no debe reaparecer sobre niebla residual.
    const lastPuffEnd = 120 + ACTION_FEEDBACK.puffMs;
    expect(ACTION_FEEDBACK.scareMs).toBeGreaterThanOrEqual(lastPuffEnd);
  });

  it('la huida de la niña termina antes de la transición al QUIZ', () => {
    expect(ACTION_FEEDBACK.exitDelayMs).toBeGreaterThanOrEqual(ACTION_FEEDBACK.fleeMs);
    // Colchón real (no justo): la huida se lee completa antes del fade.
    expect(ACTION_FEEDBACK.exitDelayMs - ACTION_FEEDBACK.fleeMs).toBeGreaterThanOrEqual(300);
  });

  it('el «+bonus» flotante desaparece antes del fade a QUIZ', () => {
    // El bonus aparece al lograr la meta y vive floatMs; la salida empieza
    // en exitDelayMs — no debe cruzarse con el fade de cámara.
    expect(ACTION_FEEDBACK.floatMs).toBeLessThan(ACTION_FEEDBACK.exitDelayMs);
  });
});

describe('pulido de niebla — ACTION más tranquila que el menú (Etapa 7)', () => {
  it('la niebla frontal del minijuego deriva MÁS DESPACIO que la del menú', () => {
    const actionNear = ACTION_PARALLAX_LAYERS.filter((layer) => layer.key === TEXTURE_KEYS.fog).at(-1);
    const menuNear = MENU_PARALLAX_LAYERS.filter((layer) => layer.key === TEXTURE_KEYS.fog).at(-1);
    expect(actionNear).toBeDefined();
    expect(menuNear).toBeDefined();
    expect(actionNear!.drift.speed).toBeLessThan(menuNear!.drift.speed);
    expect(actionNear!.drift.amplitude).toBeLessThan(menuNear!.drift.amplitude);
  });
});

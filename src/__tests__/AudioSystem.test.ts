/**
 * Etapa 1 — test del AudioSystem (SPEC §8) con un AudioContext FAKE que
 * graba todas las llamadas a las APIs de síntesis (jsdom no tiene
 * AudioContext real). Se valida: contexto lazy hasta unlock, unlock
 * idempotente, mute ⇒ NINGUNA fuente de sonido + persistencia vía save, y
 * que blip/thump/noise usan osciladores/ruido con envolventes.
 */
import { describe, expect, it } from 'vitest';
import {
  AudioSystem,
  type AudioBufferLike,
  type AudioBufferSourceNodeLike,
  type AudioContextLike,
  type AudioSaveStore,
  type BiquadFilterNodeLike,
  type GainNodeLike,
  type OscillatorNodeLike,
} from '../systems/AudioSystem';

// ---- Fakes estructurales ------------------------------------------------

class FakeParam {
  value = 0;
  readonly setValueAtTimeCalls: Array<[number, number]> = [];
  readonly linearRampCalls: Array<[number, number]> = [];
  readonly exponentialRampCalls: Array<[number, number]> = [];
  setValueAtTime(value: number, startTime: number): void {
    this.setValueAtTimeCalls.push([value, startTime]);
    this.value = value;
  }
  linearRampToValueAtTime(value: number, endTime: number): void {
    this.linearRampCalls.push([value, endTime]);
  }
  exponentialRampToValueAtTime(value: number, endTime: number): void {
    this.exponentialRampCalls.push([value, endTime]);
  }
}

class FakeOscillator implements OscillatorNodeLike {
  type = '';
  readonly frequency = new FakeParam();
  readonly connectCalls: unknown[] = [];
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  connect(node: unknown): unknown {
    this.connectCalls.push(node);
    return node;
  }
  start(when?: number): void {
    this.startedAt = when;
  }
  stop(when?: number): void {
    this.stoppedAt = when;
  }
}

class FakeGain implements GainNodeLike {
  readonly gain = new FakeParam();
  readonly connectCalls: unknown[] = [];
  connect(node: unknown): unknown {
    this.connectCalls.push(node);
    return node;
  }
}

class FakeBuffer implements AudioBufferLike {
  readonly data: Float32Array;
  channels = 1;
  bufferSampleRate = 44100;
  constructor(length: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(channel: number): Float32Array {
    expect(channel).toBe(0);
    return this.data;
  }
}

class FakeBufferSource implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  readonly connectCalls: unknown[] = [];
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  connect(node: unknown): unknown {
    this.connectCalls.push(node);
    return node;
  }
  start(when?: number): void {
    this.startedAt = when;
  }
  stop(when?: number): void {
    this.stoppedAt = when;
  }
}

class FakeBiquadFilter implements BiquadFilterNodeLike {
  type = '';
  readonly frequency = new FakeParam();
  readonly connectCalls: unknown[] = [];
  connect(node: unknown): unknown {
    this.connectCalls.push(node);
    return node;
  }
}

class FakeAudioContext implements AudioContextLike {
  readonly currentTime = 1.25;
  readonly sampleRate = 44100;
  state: string = 'suspended';
  resumeCalls = 0;
  resumeShouldReject = false;
  readonly destination = { id: 'destination' };
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  readonly buffers: FakeBuffer[] = [];
  readonly sources: FakeBufferSource[] = [];
  readonly filters: FakeBiquadFilter[] = [];

  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.resumeShouldReject) {
      return Promise.reject(new Error('autoplay blocked'));
    }
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBuffer(numChannels: number, length: number, sampleRate: number): FakeBuffer {
    const buffer = new FakeBuffer(length);
    buffer.channels = numChannels;
    buffer.bufferSampleRate = sampleRate;
    this.buffers.push(buffer);
    return buffer;
  }
  createBufferSource(): FakeBufferSource {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }
  createBiquadFilter(): FakeBiquadFilter {
    const filter = new FakeBiquadFilter();
    this.filters.push(filter);
    return filter;
  }
}

class FakeSaveStore implements AudioSaveStore {
  muted = false;
  readonly setMutedCalls: boolean[] = [];
  setMuted(muted: boolean): void {
    this.setMutedCalls.push(muted);
    this.muted = muted;
  }
}

/** Sistema montado con fakes; `created` cuenta llamadas al factory. */
function makeSystem(): {
  audio: AudioSystem;
  ctx: FakeAudioContext;
  store: FakeSaveStore;
  created: () => number;
} {
  const ctx = new FakeAudioContext();
  const store = new FakeSaveStore();
  let created = 0;
  const audio = new AudioSystem({
    saveSystem: store,
    createContext: () => {
      created++;
      return ctx;
    },
  });
  return { audio, ctx, store, created: () => created };
}

describe('AudioSystem — AudioContext lazy', () => {
  it('no crea el contexto hasta unlock', () => {
    const { audio, created } = makeSystem();
    expect(created()).toBe(0);
    expect(audio.isUnlocked).toBe(false);
  });

  it('las primitivas son no-ops sin unlock (no crean contexto NI fuentes)', () => {
    const { audio, ctx, created } = makeSystem();
    audio.blip();
    audio.thump();
    audio.noise();
    expect(created()).toBe(0);
    expect(ctx.oscillators.length).toBe(0);
    expect(ctx.sources.length).toBe(0);
  });

  it('unlock crea el contexto UNA sola vez (idempotente)', () => {
    const { audio, created } = makeSystem();
    audio.unlock();
    audio.unlock();
    audio.unlock();
    expect(created()).toBe(1);
    expect(audio.isUnlocked).toBe(true);
  });

  it('unlock reanuda un contexto suspendido; en running no vuelve a llamar resume', () => {
    const { audio, ctx } = makeSystem();
    expect(ctx.state).toBe('suspended');
    audio.unlock();
    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.state).toBe('running');
    audio.unlock();
    expect(ctx.resumeCalls).toBe(1); // ya running
  });

  it('un resume rechazado (autoplay aún bloqueado) no rompe', () => {
    const { audio, ctx } = makeSystem();
    ctx.resumeShouldReject = true;
    expect(() => audio.unlock()).not.toThrow();
    expect(ctx.resumeCalls).toBe(1);
  });
});

describe('AudioSystem — mute persistente', () => {
  it('toggleMute persiste el nuevo estado vía SaveSystem', () => {
    const { audio, store } = makeSystem();
    expect(audio.muted).toBe(false);
    expect(audio.toggleMute()).toBe(true);
    expect(store.setMutedCalls).toEqual([true]);
    expect(audio.muted).toBe(true);
    expect(audio.toggleMute()).toBe(false);
    expect(store.setMutedCalls).toEqual([true, false]);
  });

  it('setMuted persiste directamente', () => {
    const { audio, store } = makeSystem();
    audio.setMuted(true);
    expect(store.setMutedCalls).toEqual([true]);
    expect(audio.muted).toBe(true);
  });

  it('con mute activo NO se crea ninguna fuente de sonido', () => {
    const { audio, ctx, created } = makeSystem();
    audio.unlock(); // el contexto puede existir…
    expect(created()).toBe(1);
    audio.setMuted(true);
    audio.blip();
    audio.thump();
    audio.noise();
    expect(ctx.oscillators.length).toBe(0); // …pero ninguna fuente
    expect(ctx.gains.length).toBe(0);
    expect(ctx.buffers.length).toBe(0);
    expect(ctx.sources.length).toBe(0);
  });

  it('al desmutear vuelven a crearse fuentes', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.setMuted(true);
    audio.blip();
    expect(ctx.oscillators.length).toBe(0);
    audio.setMuted(false);
    audio.blip();
    expect(ctx.oscillators.length).toBe(1);
  });
});

describe('AudioSystem — blip (oscilador con pitch descendente)', () => {
  it('crea UN oscilador con su gain, envolventes y arranca/para', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.blip();

    expect(ctx.oscillators.length).toBe(1);
    expect(ctx.gains.length).toBe(1);
    const osc = ctx.oscillators[0];
    const gain = ctx.gains[0];

    expect(osc.type).toBe('triangle');
    // Pitch: setValueAtTime inicial + ramp exponencial descendente.
    expect(osc.frequency.setValueAtTimeCalls[0]).toEqual([880, ctx.currentTime]);
    expect(osc.frequency.exponentialRampCalls.length).toBe(1);
    const [toHz, atT] = osc.frequency.exponentialRampCalls[0];
    expect(toHz).toBeLessThan(880);
    expect(atT).toBeCloseTo(ctx.currentTime + 0.12, 5);
    // Envolvente de volumen con caída exponencial (a casi cero).
    expect(gain.gain.setValueAtTimeCalls.length).toBe(1);
    expect(gain.gain.exponentialRampCalls.length).toBe(1);
    expect(gain.gain.exponentialRampCalls[0][0]).toBeLessThanOrEqual(0.001);
    // Cadena: osc → gain → destination, y start/stop agendados.
    expect(osc.connectCalls[0]).toBe(gain);
    expect(gain.connectCalls[0]).toBe(ctx.destination);
    expect(osc.startedAt).toBe(ctx.currentTime);
    expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + 0.12, 5);
  });

  it('respeta duración y frecuencias personalizadas', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.blip(0.5, 1000, 200);
    const osc = ctx.oscillators[0];
    expect(osc.frequency.setValueAtTimeCalls[0]).toEqual([1000, ctx.currentTime]);
    expect(osc.frequency.exponentialRampCalls[0]).toEqual([200, ctx.currentTime + 0.5]);
    expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + 0.5, 5);
  });
});

describe('AudioSystem — thump (grave con decay)', () => {
  it('crea un oscilador grave que baja de frecuencia', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.thump();

    expect(ctx.oscillators.length).toBe(1);
    const osc = ctx.oscillators[0];
    const gain = ctx.gains[0];

    expect(osc.type).toBe('sine');
    const [fromHz] = osc.frequency.setValueAtTimeCalls[0];
    const [toHz] = osc.frequency.exponentialRampCalls[0];
    expect(fromHz).toBeLessThanOrEqual(160);
    expect(toHz).toBeLessThan(fromHz);
    expect(osc.connectCalls[0]).toBe(gain);
    expect(gain.connectCalls[0]).toBe(ctx.destination);
    expect(osc.startedAt).toBe(ctx.currentTime);
    expect(osc.stoppedAt).toBeGreaterThan(ctx.currentTime);
  });
});

describe('AudioSystem — noise (ruido blanco breve)', () => {
  it('crea buffer + fuente de ruido con envolvente y lo agenda', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.noise();

    expect(ctx.buffers.length).toBe(1);
    expect(ctx.sources.length).toBe(1);
    const buffer = ctx.buffers[0];
    const source = ctx.sources[0];
    const gain = ctx.gains[0];

    // Buffer mono con la duración pedida (0.15 s a 44100 Hz).
    expect(buffer.channels).toBe(1);
    expect(buffer.data.length).toBe(Math.floor(0.15 * ctx.sampleRate));
    expect(buffer.bufferSampleRate).toBe(ctx.sampleRate);
    // El ruido está efectivamente escrito (muestras no nulas, rango [-1, 1]).
    const nonZero = buffer.data.filter((sample) => sample !== 0).length;
    expect(nonZero).toBeGreaterThan(buffer.data.length / 2);
    for (const sample of buffer.data) {
      expect(Math.abs(sample)).toBeLessThanOrEqual(1);
    }
    // Fuente conectada al buffer, a la cadena, y agendada.
    expect(source.buffer).toBe(buffer);
    expect(source.connectCalls[0]).toBe(gain);
    expect(gain.connectCalls[0]).toBe(ctx.destination);
    expect(gain.gain.exponentialRampCalls.length).toBe(1);
    expect(source.startedAt).toBe(ctx.currentTime);
    expect(source.stoppedAt).toBeCloseTo(ctx.currentTime + 0.15, 5);
  });

  it('respeta la duración personalizada', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.noise(0.5);
    expect(ctx.buffers[0].data.length).toBe(Math.floor(0.5 * ctx.sampleRate));
    expect(ctx.sources[0].stoppedAt).toBeCloseTo(ctx.currentTime + 0.5, 5);
  });
});

describe('AudioSystem — wind (sweep de ruido filtrado low-pass, SPEC §8)', () => {
  it('sin unlock es no-op: no crea buffer, fuente NI filtro', () => {
    const { audio, ctx, created } = makeSystem();
    audio.wind();
    expect(created()).toBe(0);
    expect(ctx.buffers.length).toBe(0);
    expect(ctx.sources.length).toBe(0);
    expect(ctx.filters.length).toBe(0);
  });

  it('con mute activo no crea ninguna fuente de sonido', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.setMuted(true);
    audio.wind();
    expect(ctx.buffers.length).toBe(0);
    expect(ctx.filters.length).toBe(0);
    expect(ctx.gains.length).toBe(0);
  });

  it('crea ruido → filtro lowpass con sweep → gain → destination', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.wind();

    expect(ctx.buffers.length).toBe(1);
    const buffer = ctx.buffers[0];
    const source = ctx.sources[0];
    const filter = ctx.filters[0];
    const gain = ctx.gains[0];

    // Buffer de ruido de la duración por defecto (2.4 s).
    expect(buffer.channels).toBe(1);
    expect(buffer.data.length).toBe(Math.floor(2.4 * ctx.sampleRate));
    const nonZero = buffer.data.filter((sample) => sample !== 0).length;
    expect(nonZero).toBeGreaterThan(buffer.data.length / 2);
    expect(source.buffer).toBe(buffer);

    // Filtro low-pass con barrido de frecuencia (ráfaga que sube y baja).
    expect(filter.type).toBe('lowpass');
    expect(filter.frequency.setValueAtTimeCalls.length).toBe(1);
    expect(filter.frequency.exponentialRampCalls.length).toBe(2);
    const [startHz] = filter.frequency.setValueAtTimeCalls[0];
    const [peakHz] = filter.frequency.exponentialRampCalls[0];
    const [endHz] = filter.frequency.exponentialRampCalls[1];
    expect(peakHz).toBeGreaterThan(startHz);
    expect(endHz).toBeLessThan(peakHz);

    // Cadena: source → filter → gain → destination, agendada.
    expect(source.connectCalls[0]).toBe(filter);
    expect(filter.connectCalls[0]).toBe(gain);
    expect(gain.connectCalls[0]).toBe(ctx.destination);
    // Envolvente en swell: ataque lineal + caída exponencial.
    expect(gain.gain.linearRampCalls.length).toBe(1);
    expect(gain.gain.exponentialRampCalls.length).toBe(1);
    expect(source.startedAt).toBe(ctx.currentTime);
    expect(source.stoppedAt).toBeCloseTo(ctx.currentTime + 2.4, 5);
  });

  it('respeta duración y frecuencias personalizadas', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.wind(1, 200, 800, 100);
    const filter = ctx.filters[0];
    expect(filter.frequency.setValueAtTimeCalls[0]).toEqual([200, ctx.currentTime]);
    expect(filter.frequency.exponentialRampCalls[0]).toEqual([
      800,
      ctx.currentTime + 0.6,
    ]);
    expect(ctx.sources[0].stoppedAt).toBeCloseTo(ctx.currentTime + 1, 5);
  });
});

describe('AudioSystem — tick (click corto del timer, SPEC §8/Etapa 4)', () => {
  it('sin unlock es no-op (no crea fuentes)', () => {
    const { audio, ctx } = makeSystem();
    audio.tick();
    expect(ctx.oscillators.length).toBe(0);
    expect(ctx.gains.length).toBe(0);
  });

  it('con mute activo no crea ninguna fuente', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.setMuted(true);
    audio.tick();
    expect(ctx.oscillators.length).toBe(0);
  });

  it('click corto: oscilador triangular agudo, MÁS QUIETO, agendado', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.tick();

    expect(ctx.oscillators.length).toBe(1);
    expect(ctx.gains.length).toBe(1);
    const osc = ctx.oscillators[0];
    const gain = ctx.gains[0];

    expect(osc.type).toBe('triangle');
    const [fromHz] = osc.frequency.setValueAtTimeCalls[0];
    const [toHz] = osc.frequency.exponentialRampCalls[0];
    expect(fromHz).toBeGreaterThanOrEqual(1000); // agudo (click)
    expect(toHz).toBeLessThan(fromHz); // pitch descendente corto
    // Corto por defecto (0.05 s): un tick por segundo no cansa.
    expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + 0.05, 5);
    // Volumen por debajo del MASTER (suena cada segundo).
    const [gainStart] = gain.gain.setValueAtTimeCalls[0];
    expect(gainStart).toBeLessThanOrEqual(0.25 * 0.6);
    expect(gain.connectCalls[0]).toBe(ctx.destination);
  });

  it('respeta duración y frecuencias personalizadas', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.tick(0.2, 900, 500);
    expect(ctx.oscillators[0].frequency.setValueAtTimeCalls[0]).toEqual([
      900,
      ctx.currentTime,
    ]);
    expect(ctx.oscillators[0].stoppedAt).toBeCloseTo(ctx.currentTime + 0.2, 5);
  });
});

describe('AudioSystem — timeout (tono grave sostenido con decay, SPEC §8/Etapa 4)', () => {
  it('sin unlock y con mute es no-op', () => {
    const a = makeSystem();
    a.audio.timeout();
    expect(a.ctx.oscillators.length).toBe(0);
    const b = makeSystem();
    b.audio.unlock();
    b.audio.setMuted(true);
    b.audio.timeout();
    expect(b.ctx.oscillators.length).toBe(0);
  });

  it('seno grave que desciende, con ataque corto y caída exponencial', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.timeout();

    expect(ctx.oscillators.length).toBe(1);
    const osc = ctx.oscillators[0];
    const gain = ctx.gains[0];

    expect(osc.type).toBe('sine');
    const [fromHz] = osc.frequency.setValueAtTimeCalls[0];
    const [toHz] = osc.frequency.exponentialRampCalls[0];
    expect(fromHz).toBeLessThanOrEqual(300); // grave
    expect(toHz).toBeLessThan(fromHz); // desciende
    // Sostenido (~1.1 s por defecto) — no es un click.
    expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + 1.1, 5);
    // Envolvente: arranque desde casi 0 (ataque lineal corto) → decay exp.
    const [attackFrom] = gain.gain.setValueAtTimeCalls[0];
    expect(attackFrom).toBeLessThanOrEqual(0.001);
    expect(gain.gain.linearRampCalls.length).toBe(1);
    expect(gain.gain.exponentialRampCalls.length).toBe(1);
    const [peak] = gain.gain.linearRampCalls[0];
    expect(peak).toBeGreaterThan(0);
    // Cadena y agenda.
    expect(osc.connectCalls[0]).toBe(gain);
    expect(gain.connectCalls[0]).toBe(ctx.destination);
    expect(osc.startedAt).toBe(ctx.currentTime);
  });

  it('respeta duración y frecuencias personalizadas', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.timeout(2, 150, 40);
    expect(ctx.oscillators[0].frequency.setValueAtTimeCalls[0]).toEqual([
      150,
      ctx.currentTime,
    ]);
    expect(ctx.oscillators[0].stoppedAt).toBeCloseTo(ctx.currentTime + 2, 5);
  });
});

describe('AudioSystem — arpeggio (acierto del quiz, SPEC §8/Etapa 5)', () => {
  it('sin unlock y con mute es no-op: no crea ninguna fuente de sonido', () => {
    const a = makeSystem();
    a.audio.arpeggio();
    expect(a.created()).toBe(0);
    expect(a.ctx.oscillators.length).toBe(0);

    const b = makeSystem();
    b.audio.unlock();
    b.audio.setMuted(true);
    b.audio.arpeggio();
    expect(b.ctx.oscillators.length).toBe(0);
    expect(b.ctx.gains.length).toBe(0);
  });

  it('tres notas de la tríada MAYOR (0/4/7 semitonos), encadenadas y con decay', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.arpeggio();

    expect(ctx.oscillators.length).toBe(3);
    expect(ctx.gains.length).toBe(3);

    const freqs = ctx.oscillators.map((osc) => osc.frequency.setValueAtTimeCalls[0][0]);
    // Fundamental do5 y relaciones de 3ª mayor y 5ª justa (temperamento igual).
    expect(freqs[0]).toBeCloseTo(523.25, 1);
    expect(freqs[1] / freqs[0]).toBeCloseTo(Math.pow(2, 4 / 12), 3);
    expect(freqs[2] / freqs[0]).toBeCloseTo(Math.pow(2, 7 / 12), 3);
    expect(freqs[1]).toBeGreaterThan(freqs[0]);
    expect(freqs[2]).toBeGreaterThan(freqs[1]);

    // Cada nota: triangular, arranca escalonada (0.09 s), decay y agenda.
    ctx.oscillators.forEach((osc, i) => {
      expect(osc.type).toBe('triangle');
      expect(osc.startedAt).toBeCloseTo(ctx.currentTime + i * 0.09, 5);
      expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + i * 0.09 + 0.24, 5);
      // Envolvente: golpe inicial + caída exponencial a casi cero.
      const gain = ctx.gains[i];
      expect(gain.gain.setValueAtTimeCalls.length).toBe(1);
      expect(gain.gain.exponentialRampCalls.length).toBe(1);
      expect(gain.gain.exponentialRampCalls[0][0]).toBeLessThanOrEqual(0.001);
      // Cadena: osc → gain → destination.
      expect(osc.connectCalls[0]).toBe(gain);
      expect(gain.connectCalls[0]).toBe(ctx.destination);
    });
  });

  it('respeta duración, espaciado y fundamental personalizadas', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.arpeggio(0.4, 0.2, 392); // sol4

    const freqs = ctx.oscillators.map((osc) => osc.frequency.setValueAtTimeCalls[0][0]);
    expect(freqs[0]).toBeCloseTo(392, 5);
    expect(freqs[1] / freqs[0]).toBeCloseTo(Math.pow(2, 4 / 12), 3);
    ctx.oscillators.forEach((osc, i) => {
      expect(osc.startedAt).toBeCloseTo(ctx.currentTime + i * 0.2, 5);
      expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + i * 0.2 + 0.4, 5);
    });
  });
});

describe('AudioSystem — errorSound (error del quiz, SPEC §8/Etapa 5)', () => {
  it('sin unlock y con mute es no-op: no crea ninguna fuente de sonido', () => {
    const a = makeSystem();
    a.audio.errorSound();
    expect(a.created()).toBe(0);
    expect(a.ctx.oscillators.length).toBe(0);

    const b = makeSystem();
    b.audio.unlock();
    b.audio.setMuted(true);
    b.audio.errorSound();
    expect(b.ctx.oscillators.length).toBe(0);
    expect(b.ctx.gains.length).toBe(0);
  });

  it('dos notas seno una TERCERA MENOR hacia abajo, suave y escalonadas', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.errorSound();

    expect(ctx.oscillators.length).toBe(2);
    expect(ctx.gains.length).toBe(2);

    const [firstHz, secondHz] = ctx.oscillators.map(
      (osc) => osc.frequency.setValueAtTimeCalls[0][0],
    );
    // Desciende una tercera menor (440 → 369.99, ratio 2^(3/12)).
    expect(secondHz).toBeLessThan(firstHz);
    expect(firstHz / secondHz).toBeCloseTo(Math.pow(2, 3 / 12), 3);

    ctx.oscillators.forEach((osc, i) => {
      expect(osc.type).toBe('sine');
      expect(osc.startedAt).toBeCloseTo(ctx.currentTime + i * 0.13, 5);
      expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + i * 0.13 + 0.3, 5);
      const gain = ctx.gains[i];
      // «Suave»: por debajo del volumen del arpegio (0.9·MASTER) y del blip.
      const [gainStart] = gain.gain.setValueAtTimeCalls[0];
      expect(gainStart).toBeLessThanOrEqual(0.25 * 0.6);
      expect(gain.gain.exponentialRampCalls.length).toBe(1);
      expect(osc.connectCalls[0]).toBe(gain);
      expect(gain.connectCalls[0]).toBe(ctx.destination);
    });
  });

  it('respeta duración, espaciado y frecuencias personalizadas', () => {
    const { audio, ctx } = makeSystem();
    audio.unlock();
    audio.errorSound(0.5, 0.25, 330, 262);

    const freqs = ctx.oscillators.map((osc) => osc.frequency.setValueAtTimeCalls[0][0]);
    expect(freqs).toEqual([330, 262]);
    expect(freqs[1]).toBeLessThan(freqs[0]);
    ctx.oscillators.forEach((osc, i) => {
      expect(osc.startedAt).toBeCloseTo(ctx.currentTime + i * 0.25, 5);
      expect(osc.stoppedAt).toBeCloseTo(ctx.currentTime + i * 0.25 + 0.5, 5);
    });
  });
});

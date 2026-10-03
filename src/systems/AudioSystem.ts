/**
 * AudioSystem (SPEC §8, decisión D9): efectos sintetizados con Web Audio API.
 *
 * - `AudioContext` LAZY: no existe hasta el primer gesto del usuario
 *   (`unlock()`, políticas de autoplay). Las primitivas son no-ops sin
 *   contexto o con mute activo — en mute NO se crea ninguna fuente de
 *   sonido (ni oscilador ni buffer).
 * - Mute persistente vía SaveSystem: al togglear se guarda.
 * - El factory de AudioContext es inyectable (`{ saveSystem, createContext }`)
 *   para tests — jsdom no tiene AudioContext, los tests usan un fake que
 *   graba las llamadas a las APIs de síntesis.
 *
 * Sin import de Phaser. Las interfaces `*Like` son estructurales: el
 * `AudioContext` real del navegador las satisface sin adaptadores.
 */

// ---- Contratos estructurales (satisfechos por la Web Audio API real) ----

/** Envoltura de un valor de automatización (subset de `AudioParam`). */
interface ParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
  exponentialRampToValueAtTime(value: number, endTime: number): void;
}

export interface OscillatorNodeLike {
  type: string;
  frequency: ParamLike;
  connect(node: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainNodeLike {
  gain: ParamLike;
  connect(node: unknown): unknown;
}

export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null;
  connect(node: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

/** Envoltura de un filtro biquadratic (subset de `BiquadFilterNode`). */
export interface BiquadFilterNodeLike {
  type: string;
  frequency: ParamLike;
  connect(node: unknown): unknown;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  createBuffer(numChannels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
}

/** Lo que AudioSystem necesita del SaveSystem (muted + persistencia). */
export interface AudioSaveStore {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
}

export interface AudioSystemDeps {
  saveSystem: AudioSaveStore;
  createContext: () => AudioContextLike;
}

/** Volumen general de los efectos (los relativos se escalan contra esto). */
const MASTER_GAIN = 0.25;

export class AudioSystem {
  private readonly deps: AudioSystemDeps;
  private ctx: AudioContextLike | null = null;

  constructor(deps: AudioSystemDeps) {
    this.deps = deps;
  }

  // ---- Ciclo de vida del contexto --------------------------------------

  /**
   * Primer gesto del usuario: crea el contexto (una sola vez) y lo resume
   * si quedó suspendenido. Idempotente — puede llamarse en cada pointerdown.
   */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = this.deps.createContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // El resume puede rechazarse (autoplay aún bloqueado): reintentará
        // el próximo gesto, el juego no depende del audio.
      });
    }
  }

  /** ¿Ya se creó el AudioContext? (para tests/diagnóstico). */
  get isUnlocked(): boolean {
    return this.ctx !== null;
  }

  // ---- Mute persistente (SPEC §8) ---------------------------------------

  get muted(): boolean {
    return this.deps.saveSystem.muted;
  }

  /** Cambia el mute y lo persiste vía SaveSystem. Devuelve el nuevo estado. */
  setMuted(muted: boolean): boolean {
    this.deps.saveSystem.setMuted(muted);
    return muted;
  }

  /** Toggle cómodo para el icono de altavoz. Devuelve el nuevo estado. */
  toggleMute(): boolean {
    return this.setMuted(!this.muted);
  }

  // ---- Primitivas de síntesis (SPEC §8) ---------------------------------

  /** Blip corto y agudo (UI, feedback de selección). Oscilador triangular. */
  blip(durationSec = 0.12, fromHz = 880, toHz = 520): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(fromHz, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), t0 + durationSec);
    gain.gain.setValueAtTime(MASTER_GAIN, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec);
  }

  /** Thump grave con decay (tap exitoso sobre el objetivo, SPEC §8). */
  thump(durationSec = 0.2, fromHz = 130, toHz = 45): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), t0 + durationSec);
    gain.gain.setValueAtTime(MASTER_GAIN * 1.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec);
  }

  /** Ruido blanco breve (tap fallido / puff de niebla, transiciones). */
  noise(durationSec = 0.15): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(durationSec * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    // Envolvente: ataque corto + caída exponencial (puff suave, no click).
    gain.gain.setValueAtTime(MASTER_GAIN * 0.8, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(t0);
    source.stop(t0 + durationSec);
  }

  /**
   * Viento (SPEC §8 «sweep de ruido filtrado»): ruido blanco → filtro
   * low-pass cuyo corte SUBE hasta un pico y vuelve a bajar (ráfaga que se
   * acerca y se va) + envolvente de volumen en swell. Se usa al entrar al
   * menú y en las transiciones de escena.
   */
  wind(
    durationSec = 2.4,
    fromHz = 260,
    peakHz = 1100,
    toHz = 320,
  ): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(durationSec * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Low-pass: el corte barre fromHz → peakHz (60 %) → toHz (ráfaga).
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(fromHz, t0);
    filter.frequency.exponentialRampToValueAtTime(peakHz, t0 + durationSec * 0.6);
    filter.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), t0 + durationSec);
    // Envolvente: ataque suave, cuerpo y caída exponencial (nunca click).
    // Etapa 7: pico 0.5 → 0.42 del master — el viento es AMBIENTE y debe
    // quedar por debajo de cualquier feedback de UI (blip/thump).
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(MASTER_GAIN * 0.42, t0 + durationSec * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t0);
    source.stop(t0 + durationSec);
  }

  /**
   * Tick del timer (SPEC §8: «click corto cada segundo», últimos 5 s de la
   * fase de acción): oscilador triangular agudo, brevísimo y MÁS QUIETO que
   * el resto (suena cada segundo — no debe cansar).
   *
   * Etapa 7 (pulido): 0.45 → 0.32 del master — el tick se repite cada
   * segundo, así que baja AÚN MÁS por debajo del thump del hit (1.2) para
   * que marque urgencia sin saturar los últimos 5 s.
   */
  tick(durationSec = 0.05, fromHz = 1500, toHz = 900): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(fromHz, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), t0 + durationSec);
    gain.gain.setValueAtTime(MASTER_GAIN * 0.32, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec);
  }

  /**
   * Timeout (SPEC §8: «tono grave sostenido con decay»): seno grave que
   * desciende lentamente con ataque corto (que no clickee) y caída
   * exponencial — el «la niebla lo cubrió todo» sonoro del GAME_OVER.
   */
  timeout(durationSec = 1.1, fromHz = 220, toHz = 55): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), t0 + durationSec);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(MASTER_GAIN * 0.9, t0 + Math.min(0.04, durationSec / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec);
  }

  /**
   * Arpegio mayor breve (SPEC §8 «Acierto quiz: arpegio mayor breve, 2–3
   * notas»): tres notas de la tríada mayor de do (C5–E5–G5, 0/4/7 semitonos
   * en temperamento igual) encadenadas a ~90 ms, timbre triangular cálido
   * con decay exponencial por nota — el «premio» sonoro del quiz correcto.
   *
   * Etapa 7 (pulido): 0.9 → 0.7 por nota — las tres notas se SOLAPAN
   * (nota 0.24 s, paso 0.09 s) y la suma llega a ~2× una nota sola;
   * a 0.9 el pico sonaba estridente. 0.7 lo mantiene alegre sin pinchar.
   */
  arpeggio(noteSec = 0.24, stepSec = 0.09, baseHz = 523.25): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const semitones = [0, 4, 7]; // tríada mayor: fundamental, 3ª, 5ª
    for (const [i, semi] of semitones.entries()) {
      const start = t0 + i * stepSec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseHz * Math.pow(2, semi / 12), start);
      gain.gain.setValueAtTime(MASTER_GAIN * 0.7, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteSec);
    }
  }

  /**
   * Error del quiz (SPEC §8 «Error quiz: intervalo menor descendente,
   * suave»): dos notas seno una TERCERA MENOR hacia abajo (la3 → fa♯3,
   * 440 → 369.99 Hz), la segunda entra un poco después, con volumen
   * comedido — desaprueba sin castigar (tono amable, SPEC §9).
   */
  errorSound(noteSec = 0.3, stepSec = 0.13, fromHz = 440, toHz = 369.99): void {
    const ctx = this.playableContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const notes = [fromHz, toHz];
    for (const [i, hz] of notes.entries()) {
      const start = t0 + i * stepSec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(MASTER_GAIN * 0.6, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteSec);
    }
  }

  /**
   * Contexto válido para sonar: ya desbloqueado Y sin mute. En cualquier
   * otro caso devuelve `null` → la primitiva es no-op SIN crear fuentes.
   */
  private playableContext(): AudioContextLike | null {
    if (this.deps.saveSystem.muted) return null;
    return this.ctx;
  }
}

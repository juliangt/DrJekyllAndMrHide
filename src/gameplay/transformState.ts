/**
 * Estado del minijuego N3 «transform-target» (Fase 3 del multi-nivel):
 * REDUCER PURO (testeable sin Phaser). `ActionScene` es una capa fina.
 *
 * El asedio al laboratorio: el objetivo alterna Hyde↔Jekyll. SOLO los
 * golpes sobre HYDE cuentan; tras cada golpe Hyde se vuelve Jekyll
 * (invulnerable) durante `revertMs` — el jugador debe esperar la ventana.
 *
 *  - Fases: `intro` (cinemática de la puerta: el timer NO corre; los taps
 *    la saltan desde la escena) → `start` → `ready` (el PRIMER tick arranca
 *    el reloj sin descontar ese frame) → `playing` · `falling` (Hyde cae)
 *    → `goal` · `timeout` · `restart` (mismas reglas que N1/N2).
 *  - `hit`: SOLO cuenta en `playing` y con `form === 'hyde'`: +1 golpe, y
 *    el objetivo pasa a `form: 'jekyll'` con `revertInMs = revertMs`. Si es
 *    el golpe de meta → `falling` (Hyde cae; se queda Hyde, no Jekyll).
 *    Un hit sobre Jekyll (o fuera de playing) se IGNORA — la escena le da
 *    su feedback amable sin tocar el estado.
 *  - `tick`: en `playing` descuenta el timer Y la ventana Jekyll
 *    (`revertInMs`, exactamente `revertMs` desde el golpe); al llegar a 0
 *    el objetivo revierte a Hyde. En `intro` el tick NO hace NADA (el timer
 *    no corre durante la cinemática). En `ready`/`restart` el primer tick
 *    reanuda sin descontar. En `falling` corre SOLO la secuencia de caída.
 *  - `miss`: sin castigo (SPEC §4.2): estado intacto (incluye los taps
 *    sobre Jekyll).
 *  - `restart`: SOLO desde `timeout`; vuelve Hyde, ventana a 0.
 *
 * Transiciones inválidas se IGNORAN devolviendo el mismo estado.
 * Sin import de Phaser.
 */
import { RoundEventType } from './round';

/** Forma actual del objetivo (const-object, NO enum). */
export const TargetForm = {
  Hyde: 'hyde',
  Jekyll: 'jekyll',
} as const;

export type TargetForm = (typeof TargetForm)[keyof typeof TargetForm];

/** Fases de la tanda del asedio (const-object, NO enum). */
export const TransformPhase = {
  /** Cinemática de la puerta (Poole/Utterson golpean): el timer NO corre. */
  Intro: 'intro',
  /** Intro terminada: esperando el primer tick para arrancar el reloj. */
  Ready: 'ready',
  Playing: 'playing',
  /** Golpe de meta: Hyde cae al suelo del laboratorio (sin sangre). */
  Falling: 'falling',
  Goal: 'goal',
  Timeout: 'timeout',
  Restart: 'restart',
} as const;

export type TransformPhase = (typeof TransformPhase)[keyof typeof TransformPhase];

/** Acciones del reducer de la tanda (unión discriminada por `type`). */
export type TransformEvent =
  | { type: typeof RoundEventType.Hit }
  | { type: typeof RoundEventType.Miss }
  | { type: typeof RoundEventType.Tick; dtMs: number }
  | { type: typeof RoundEventType.Restart }
  | { type: typeof RoundEventType.Start };

/** Config de la tanda (subconjunto del `TransformTargetActionConfig`). */
export interface TransformRoundConfig {
  /** Golpes a Hyde requeridos (N3: 6). */
  goal: number;
  /** Tiempo límite en segundos (N3: 90). */
  timeLimitSec: number;
  /** Ventana Jekyll tras cada golpe, en ms (N3: 3000). */
  revertMs: number;
  /** Duración de la fase `falling` (caída animada) en ms (N3: 900). */
  fallMs: number;
}

/** Estado completo de la tanda del asedio. */
export interface TransformState {
  /** Golpes a Hyde causados (0..goal, NUNCA mayor que la meta). */
  hits: number;
  /** Meta de la tanda (≥ 1, clampa configuraciones inválidas). */
  goal: number;
  /** ms restantes del timer (0..timeLimitMs, NUNCA negativo). */
  timeLeftMs: number;
  /** Duración total de la tanda en ms (para reconstruir en `restart`). */
  timeLimitMs: number;
  /** Ventana Jekyll configurada (ms; la escena la usa para animaciones). */
  revertMs: number;
  /** Duración de la fase `falling` (ms; 0 = goal directo). */
  fallMs: number;
  /** Forma actual del objetivo ('hyde' golpeable · 'jekyll' invulnerable). */
  form: TargetForm;
  /** ms restantes de ventana Jekyll (0 = ya es Hyde o es golpe de meta). */
  revertInMs: number;
  /** ms restantes de la secuencia de caída (fase falling; 0 fuera). */
  sequenceMsLeft: number;
  phase: TransformPhase;
}

/**
 * Estado inicial: 0 golpes, Hyde golpeable, timer a tope, fase `intro` (la
 * cinemática de la puerta la gestiona la escena; el reducer solo respeta
 * que el timer no corre). Configuraciones inválidas se clampan.
 */
export function initialTransformState(config: TransformRoundConfig): TransformState {
  const goal = Math.max(1, Math.floor(config.goal));
  const timeLimitMs = Math.max(0, Math.floor(config.timeLimitSec * 1000));
  return {
    hits: 0,
    goal,
    timeLeftMs: timeLimitMs,
    timeLimitMs,
    revertMs: Math.max(0, Math.floor(config.revertMs)),
    fallMs: Math.max(0, Math.floor(config.fallMs)),
    form: TargetForm.Hyde,
    revertInMs: 0,
    sequenceMsLeft: 0,
    phase: TransformPhase.Intro,
  };
}

/**
 * Cuenta atrás genérica con el épsilon anti-restos-flotantes de
 * `actionReducer` (600 frames de 1000/60 ms no dejan fantasmas de 5e-12 ms).
 * Devuelve el restante y si la cuenta llegó a cero en este tick.
 */
function countDown(remainingMs: number, dtMs: number): { remaining: number; done: boolean } {
  const remaining = remainingMs - dtMs;
  if (remaining < 1e-6) {
    return { remaining: 0, done: true };
  }
  return { remaining, done: false };
}

/** Reducer puro de la tanda del asedio (ver cabecera para las reglas). */
export function transformReducer(state: TransformState, event: TransformEvent): TransformState {
  switch (event.type) {
    case RoundEventType.Hit: {
      if (state.phase !== TransformPhase.Playing || state.form !== TargetForm.Hyde) {
        return state; // golpes a Jekyll / fuera de playing: IGNORADOS
      }
      const hits = Math.min(state.hits + 1, state.goal);
      if (hits >= state.goal) {
        // Golpe de meta: Hyde cae SIENDO Hyde (sin transformación final).
        return {
          ...state,
          hits,
          revertInMs: 0,
          sequenceMsLeft: state.fallMs,
          phase: state.fallMs > 0 ? TransformPhase.Falling : TransformPhase.Goal,
        };
      }
      // Transformación inmediata: ventana Jekyll EXACTA de `revertMs`.
      return { ...state, hits, form: TargetForm.Jekyll, revertInMs: state.revertMs };
    }

    case RoundEventType.Miss: {
      // Tap al aire / sobre Jekyll: sin castigo (SPEC §4.2).
      return state;
    }

    case RoundEventType.Start: {
      if (state.phase !== TransformPhase.Intro) {
        return state; // la intro solo se arranca una vez (skip idempotente)
      }
      return { ...state, phase: TransformPhase.Ready };
    }

    case RoundEventType.Tick: {
      if (state.phase === TransformPhase.Intro) {
        return state; // la cinemática NO corre el reloj
      }
      if (state.phase === TransformPhase.Ready || state.phase === TransformPhase.Restart) {
        return { ...state, phase: TransformPhase.Playing }; // sin descontar frame
      }
      if (state.phase === TransformPhase.Falling) {
        if (!(event.dtMs > 0) || !Number.isFinite(event.dtMs)) {
          return state; // dt degenerado: la caída ni avanza ni se salta
        }
        const seq = countDown(state.sequenceMsLeft, event.dtMs);
        if (seq.done) {
          return { ...state, sequenceMsLeft: 0, phase: TransformPhase.Goal };
        }
        return { ...state, sequenceMsLeft: seq.remaining };
      }
      if (state.phase !== TransformPhase.Playing) {
        return state; // goal/timeout: congelados (timer, ventana y forma)
      }
      if (!(event.dtMs > 0) || !Number.isFinite(event.dtMs)) {
        return state; // dt degenerado: frame perdido, no castiga
      }
      // Ventana Jekyll: puede agotarse en el mismo tick que el timer.
      let next: TransformState = state;
      if (state.form === TargetForm.Jekyll) {
        const windowLeft = countDown(state.revertInMs, event.dtMs);
        next = windowLeft.done
          ? { ...next, form: TargetForm.Hyde, revertInMs: 0 }
          : { ...next, revertInMs: windowLeft.remaining };
      }
      const timeLeft = countDown(next.timeLeftMs, event.dtMs);
      return {
        ...next,
        timeLeftMs: timeLeft.remaining,
        phase: timeLeft.done ? TransformPhase.Timeout : TransformPhase.Playing,
      };
    }

    case RoundEventType.Restart: {
      if (state.phase !== TransformPhase.Timeout) {
        return state; // reiniciar solo procede tras timeout (D6)
      }
      return {
        hits: 0,
        goal: state.goal,
        timeLeftMs: state.timeLimitMs,
        timeLimitMs: state.timeLimitMs,
        revertMs: state.revertMs,
        fallMs: state.fallMs,
        form: TargetForm.Hyde,
        revertInMs: 0,
        sequenceMsLeft: 0,
        phase: TransformPhase.Restart,
      };
    }

    default: {
      // Evento fuera de la unión (p. ej. vía el glue de gameplay/round):
      // ignorado — el advance de N2 no significa nada aquí.
      return state;
    }
  }
}

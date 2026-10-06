/**
 * Estado del minijuego N2 «cane-strike» (Fase 3 del multi-nivel): REDUCER
 * PURO. `ActionScene` es una capa fina que despacha acciones y refleja el
 * estado; TODAS las reglas viven aquí (testeable sin Phaser).
 *
 * Espejo de `actionReducer` (N1) con la secuencia teatral de la caída:
 *
 *  - `hit`: +1 bastonazo (nunca > goal); al alcanzar la meta NO pasa
 *    directamente a `goal`: entra en `falling` (Lanyon cae al suelo del
 *    callejón) y el timer queda CONGELADO (el bonus se calcula sobre ese
 *    instante, SPEC §5).
 *  - `falling`: cuenta atrás `sequenceMsLeft` con `tick`; a 0 → `line`
 *    (línea de victoria de Hyde en pergamino) o directo a `goal` si la
 *    línea está desactivada (lineMs = 0).
 *  - `line`: cuenta atrás; a 0 → `goal` (la escena suma el bonus y va al
 *    QUIZ, igual que N1).
 *  - `advance`: salta la secuencia un paso (falling → line/goal,
 *    line → goal); ignorado fuera de esas fases.
 *  - `miss`: tap al aire — SIN castigo (SPEC §4.2): estado intacto.
 *  - `tick`: en `playing` descuenta el timer (nunca < 0; a 0 → `timeout`);
 *    en `restart` el PRIMER tick reanuda sin descontar ese frame; en fases
 *    terminales (`goal`/`timeout`) el timer queda congelado.
 *  - `restart`: SOLO desde `timeout` («Reintentar», D6).
 *
 * Las duraciones de la secuencia (`fallMs`, `lineMs`) viven EN el estado
 * para que la cadena falling → line → goal sea autónoma (el reducer no
 * necesita recibir la config en cada evento).
 *
 * Transiciones inválidas se IGNORAN devolviendo el mismo estado.
 * Sin import de Phaser.
 */
import { RoundEventType } from './round';

/** Fases de la tanda de bastonazos (const-object, NO enum). */
export const CanePhase = {
  Playing: 'playing',
  /** Golpe de meta: Lanyon cae al suelo del callejón (sin sangre). */
  Falling: 'falling',
  /** Línea de victoria de Hyde en la carátula de pergamino. */
  Line: 'line',
  Goal: 'goal',
  Timeout: 'timeout',
  Restart: 'restart',
} as const;

export type CanePhase = (typeof CanePhase)[keyof typeof CanePhase];

/** Acciones del reducer de la tanda (unión discriminada por `type`). */
export type CaneEvent =
  | { type: typeof RoundEventType.Hit }
  | { type: typeof RoundEventType.Miss }
  | { type: typeof RoundEventType.Tick; dtMs: number }
  | { type: typeof RoundEventType.Restart }
  | { type: typeof RoundEventType.Advance };

/** Config de la tanda (subconjunto del `CaneStrikeActionConfig` del nivel). */
export interface CaneRoundConfig {
  /** Bastonazos requeridos (N2: 5). */
  goal: number;
  /** Tiempo límite en segundos (N2: 60). */
  timeLimitSec: number;
  /** Duración de la fase `falling` (caída animada) en ms (N2: 900). */
  fallMs: number;
  /** Duración de la fase `line` (línea de victoria) en ms (N2: 1600). */
  lineMs: number;
}

/** Estado completo de la tanda de bastonazos. */
export interface CaneState {
  /** Bastonazos causados (0..goal, NUNCA mayor que la meta). */
  hits: number;
  /** Meta de la tanda (≥ 1, clampa configuraciones inválidas). */
  goal: number;
  /** ms restantes del timer (0..timeLimitMs, NUNCA negativo). */
  timeLeftMs: number;
  /** Duración total de la tanda en ms (para reconstruir en `restart`). */
  timeLimitMs: number;
  /** Duración de la fase `falling` (ms; 0 = se salta). */
  fallMs: number;
  /** Duración de la fase `line` (ms; 0 = se salta). */
  lineMs: number;
  /** ms restantes de la secuencia en curso (falling/line; 0 fuera de ellas). */
  sequenceMsLeft: number;
  phase: CanePhase;
}

/**
 * Estado inicial: 0 bastonazos, timer a tope, fase `playing`. Configuraciones
 * inválidas se clampan a valores sanos (goal ≥ 1, tiempos ≥ 0).
 */
export function initialCaneState(config: CaneRoundConfig): CaneState {
  const goal = Math.max(1, Math.floor(config.goal));
  const timeLimitMs = Math.max(0, Math.floor(config.timeLimitSec * 1000));
  return {
    hits: 0,
    goal,
    timeLeftMs: timeLimitMs,
    timeLimitMs,
    fallMs: Math.max(0, Math.floor(config.fallMs)),
    lineMs: Math.max(0, Math.floor(config.lineMs)),
    sequenceMsLeft: 0,
    phase: CanePhase.Playing,
  };
}

/**
 * Entrada en la secuencia final tras el golpe de meta: `falling` si hay
 * caída configurada; si no, `line`; si tampoco, `goal` directo.
 */
function enterSequence(state: CaneState): CaneState {
  if (state.fallMs > 0) {
    return { ...state, sequenceMsLeft: state.fallMs, phase: CanePhase.Falling };
  }
  if (state.lineMs > 0) {
    return { ...state, sequenceMsLeft: state.lineMs, phase: CanePhase.Line };
  }
  return { ...state, sequenceMsLeft: 0, phase: CanePhase.Goal };
}

/**
 * Siguiente fase tras agotarse `falling`: `line` si hay línea configurada;
 * si no, `goal` directo.
 */
function phaseAfterFall(state: CaneState): CaneState {
  if (state.lineMs > 0) {
    return { ...state, sequenceMsLeft: state.lineMs, phase: CanePhase.Line };
  }
  return { ...state, sequenceMsLeft: 0, phase: CanePhase.Goal };
}

/**
 * Cuenta atrás de la secuencia (falling/line) con el mismo épsilon
 * anti-restos-flotantes de `actionReducer` (600 frames de 1000/60 ms no
 * deben dejar un fantasma de 5e-12 ms que nunca llegue a 0).
 */
function stepSequence(
  state: CaneState,
  dtMs: number,
  nextWhenDone: (current: CaneState) => CaneState,
): CaneState {
  if (!(dtMs > 0) || !Number.isFinite(dtMs)) {
    return state; // frame degenerado: la secuencia ni avanza ni se salta
  }
  const remaining = state.sequenceMsLeft - dtMs;
  if (remaining < 1e-6) {
    return nextWhenDone({ ...state, sequenceMsLeft: 0 });
  }
  return { ...state, sequenceMsLeft: remaining };
}

/** Reducer puro de la tanda de bastonazos (ver cabecera para las reglas). */
export function caneReducer(state: CaneState, event: CaneEvent): CaneState {
  switch (event.type) {
    case RoundEventType.Hit: {
      if (state.phase !== CanePhase.Playing) {
        return state; // taps tras la meta/timeout/reinicio: ignorados
      }
      const hits = Math.min(state.hits + 1, state.goal);
      if (hits >= state.goal) {
        // Golpe de meta: la caída de Lanyon arranca YA (timer congelado).
        return enterSequence({ ...state, hits });
      }
      return { ...state, hits };
    }

    case RoundEventType.Miss: {
      // Tap al aire: sin castigo (SPEC §4.2) — el estado no cambia.
      return state;
    }

    case RoundEventType.Tick: {
      if (state.phase === CanePhase.Restart) {
        // Primer tick tras reiniciar: reanudar el reloj SIN descontar frame.
        return { ...state, phase: CanePhase.Playing };
      }
      if (state.phase === CanePhase.Falling) {
        return stepSequence(state, event.dtMs, phaseAfterFall);
      }
      if (state.phase === CanePhase.Line) {
        return stepSequence(state, event.dtMs, (current) => ({
          ...current,
          phase: CanePhase.Goal,
        }));
      }
      if (state.phase !== CanePhase.Playing) {
        return state; // goal/timeout: timer congelado
      }
      if (!(event.dtMs > 0) || !Number.isFinite(event.dtMs)) {
        return state; // dt degenerado: frame perdido, no castiga
      }
      const remaining = state.timeLeftMs - event.dtMs;
      const timeLeftMs = remaining < 1e-6 ? 0 : remaining;
      return {
        ...state,
        timeLeftMs,
        phase: timeLeftMs === 0 ? CanePhase.Timeout : CanePhase.Playing,
      };
    }

    case RoundEventType.Advance: {
      if (state.phase === CanePhase.Falling) {
        return phaseAfterFall(state);
      }
      if (state.phase === CanePhase.Line) {
        return { ...state, sequenceMsLeft: 0, phase: CanePhase.Goal };
      }
      return state;
    }

    case RoundEventType.Restart: {
      if (state.phase !== CanePhase.Timeout) {
        return state; // reiniciar solo procede tras timeout (D6)
      }
      return {
        hits: 0,
        goal: state.goal,
        timeLeftMs: state.timeLimitMs,
        timeLimitMs: state.timeLimitMs,
        fallMs: state.fallMs,
        lineMs: state.lineMs,
        sequenceMsLeft: 0,
        phase: CanePhase.Restart,
      };
    }

    default: {
      // Evento fuera de la unión (p. ej. vía el glue de gameplay/round):
      // ignorado — el arranque de la intro de N3 no significa nada aquí.
      return state;
    }
  }
}

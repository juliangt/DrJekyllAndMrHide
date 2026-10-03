/**
 * Estado del minijuego de acción (SPEC §4.2 / PLAN Etapa 4): REDUCER PURO.
 * `ActionScene` es una capa fina que despacha acciones y refleja el estado;
 * TODAS las reglas viven aquí (testeables sin Phaser):
 *
 *  - `hit`: +1 susto (nunca > goal); al alcanzar la meta → fase `goal`
 *    (la niña huye y la escena suma el bonus de tiempo, SPEC §5).
 *  - `miss`: tap al aire — SIN castigo (SPEC §4.2): estado intacto.
 *  - `tick`: descuenta el tiempo (nunca < 0); a 0 → fase `timeout`.
 *  - `restart`: SOLO desde `timeout` («Reintentar» reinicia SOLO el
 *    minijuego, D6): contadores a 0 y timer a tope, en fase `restart`;
 *    el PRIMER `tick` posterior reanuda el reloj (fase `playing`) sin
 *    descontar ese frame.
 *
 * Fases: `playing` (el juego corre) · `goal` (meta 3/3, timer congelado) ·
 * `timeout` (overlay GAME_OVER, timer a 0) · `restart` (tanda recién
 * reiniciada, esperando el primer tick).
 *
 * Transiciones inválidas (hit/tick en fases terminales, restart fuera de
 * timeout, dt ≤ 0…) se IGNORAN devolviendo el mismo estado.
 */

/** Fases del minijuego (const-object, NO enum). */
export const ActionPhase = {
  Playing: 'playing',
  Goal: 'goal',
  Timeout: 'timeout',
  Restart: 'restart',
} as const;

export type ActionPhase = (typeof ActionPhase)[keyof typeof ActionPhase];

/** Tipos de acción del jugador/motor sobre la tanda (const-object, NO enum). */
export const ActionEventType = {
  Hit: 'hit',
  Miss: 'miss',
  Tick: 'tick',
  Restart: 'restart',
} as const;

export type ActionEventType = (typeof ActionEventType)[keyof typeof ActionEventType];

/** Acciones del reducer (unión discriminada por `type`). */
export type ActionEvent =
  | { type: typeof ActionEventType.Hit }
  | { type: typeof ActionEventType.Miss }
  | { type: typeof ActionEventType.Tick; dtMs: number }
  | { type: typeof ActionEventType.Restart };

/** Config de la tanda (subconjunto del `ActionConfig` del nivel). */
export interface ActionRoundConfig {
  /** Taps exitosos requeridos (N1: 3). */
  goal: number;
  /** Tiempo límite en segundos (N1: 45). */
  timeLimitSec: number;
}

/** Estado completo de la tanda del minijuego. */
export interface ActionState {
  /** Sustos causados (0..goal, NUNCA mayor que la meta). */
  hits: number;
  /** Meta de la tanda (≥ 1, clampa configuraciones inválidas). */
  goal: number;
  /** ms restantes del timer (0..timeLimitMs, NUNCA negativo). */
  timeLeftMs: number;
  /** Duración total de la tanda en ms (para reconstruir en `restart`). */
  timeLimitMs: number;
  phase: ActionPhase;
}

/**
 * Estado inicial de una tanda: 0 sustos, timer a tope, fase `playing`.
 * Configuraciones inválidas (goal < 1, tiempo < 0, no finitos) se clampan a
 * valores sanos — el juego nunca debe romper por un dato malo.
 */
export function initialActionState(config: ActionRoundConfig): ActionState {
  const goal = Math.max(1, Math.floor(config.goal));
  const timeLimitMs = Math.max(0, Math.floor(config.timeLimitSec * 1000));
  return { hits: 0, goal, timeLeftMs: timeLimitMs, timeLimitMs, phase: ActionPhase.Playing };
}

/** Reducer puro de la tanda (ver cabecera del módulo para las reglas). */
export function actionReducer(state: ActionState, event: ActionEvent): ActionState {
  switch (event.type) {
    case ActionEventType.Hit: {
      if (state.phase !== ActionPhase.Playing) {
        return state; // taps tras la meta/timeout/reinicio: ignorados
      }
      const hits = Math.min(state.hits + 1, state.goal);
      return {
        ...state,
        hits,
        phase: hits >= state.goal ? ActionPhase.Goal : ActionPhase.Playing,
      };
    }

    case ActionEventType.Miss: {
      // Tap al aire: sin castigo (SPEC §4.2) — el estado no cambia.
      return state;
    }

    case ActionEventType.Tick: {
      if (state.phase === ActionPhase.Restart) {
        // Primer tick tras reiniciar: reanudar el reloj SIN descontar frame.
        return { ...state, phase: ActionPhase.Playing };
      }
      if (state.phase !== ActionPhase.Playing) {
        return state; // goal/timeout: timer congelado
      }
      if (!(event.dtMs > 0) || !Number.isFinite(event.dtMs)) {
        return state; // dt degenerado: frame perdido, no castiga
      }
      // Épsilon: restos sub-microsegundo del redondeo flotante (600 frames
      // de 1000/60 ms) se tragan como 0 — si no, el timer «colgaría» en un
      // fantasma de 5e-12 ms que nunca alcanza el timeout.
      const remaining = state.timeLeftMs - event.dtMs;
      const timeLeftMs = remaining < 1e-6 ? 0 : remaining;
      return {
        ...state,
        timeLeftMs,
        phase: timeLeftMs === 0 ? ActionPhase.Timeout : ActionPhase.Playing,
      };
    }

    case ActionEventType.Restart: {
      if (state.phase !== ActionPhase.Timeout) {
        return state; // reiniciar solo procede tras timeout (D6)
      }
      return {
        hits: 0,
        goal: state.goal,
        timeLeftMs: state.timeLimitMs,
        timeLimitMs: state.timeLimitMs,
        phase: ActionPhase.Restart,
      };
    }
  }
}

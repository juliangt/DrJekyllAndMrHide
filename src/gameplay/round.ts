/**
 * Glue tipado entre los REDUCERS PUROS de las tres mecánicas de ACTION
 * (Fase 3 del multi-nivel): N1 `actionReducer` (gameplay/actionState),
 * N2 `caneReducer` (gameplay/caneState) y N3 `transformReducer`
 * (gameplay/transformState).
 *
 * `ActionScene` es una capa fina que despacha por mecánica; para que el
 * despacho compartido (HUD, timer, overlay, tick por frame) no necesite
 * tres ramas por línea, esta módulo define:
 *
 *  - El SUPERCONJUNTO de eventos `RoundEvent` (los reducers individuales
 *    aceptan un subconjunto y IGNORAN los eventos que no les competen —
 *    mismas reglas de tolerancia que `actionReducer`).
 *  - `AnyRoundState`: la unión de los tres estados. TODOS comparten el
 *    subconjunto `hits / goal / timeLeftMs / timeLimitMs / phase` (con los
 *    literales de fase comunes 'playing' · 'goal' · 'timeout' · 'restart'),
 *    así que el HUD y el bonus se leen igual para las tres mecánicas.
 *  - `adaptRoundReducer`: el ÚNICO punto con casts del proyecto — eleva un
 *    reducer concreto a la firma unificada `(AnyRoundState, RoundEvent)`.
 *  - Accesores de lectura (`roundHits`, `roundTimeLeftMs`, …).
 *
 * Sin import de Phaser; los imports de los estados son SOLO de tipo (no hay
 * ciclo en runtime).
 */
import type { ActionState } from './actionState';
import type { CaneState } from './caneState';
import type { TransformState } from './transformState';

/** Tipos de evento compartidos (const-object, NO enum). */
export const RoundEventType = {
  /** Tap exitoso sobre el objetivo golpeable (niña / Lanyon / Hyde). */
  Hit: 'hit',
  /** Tap que no golpea (al aire, o sobre Jekyll): sin castigo. */
  Miss: 'miss',
  /** Avance del reloj (y de las secuencias) por frame. */
  Tick: 'tick',
  /** «Reintentar»: SOLO desde timeout, reinicia la tanda. */
  Restart: 'restart',
  /** Salta la secuencia actual (falling → line → goal; N2/N3). */
  Advance: 'advance',
  /** Fin de la intro cinemática (N3): arranca el reloj en el próximo tick. */
  Start: 'start',
} as const;

export type RoundEventType = (typeof RoundEventType)[keyof typeof RoundEventType];

/** Superconjunto de eventos que puede llevar una tanda cualquiera. */
export type RoundEvent =
  | { type: typeof RoundEventType.Hit }
  | { type: typeof RoundEventType.Miss }
  | { type: typeof RoundEventType.Tick; dtMs: number }
  | { type: typeof RoundEventType.Restart }
  | { type: typeof RoundEventType.Advance }
  | { type: typeof RoundEventType.Start };

/** Unión de los estados de tanda de las tres mecánicas. */
export type AnyRoundState = ActionState | CaneState | TransformState;

/**
 * Eleva un reducer concreto de mecánica a la firma unificada de la escena.
 * Es el ÚNICO lugar con casts deliberados: cada mecánica despacha SOLO sus
 * propios eventos (la escena ramifica en `init`), así que el cast es seguro
 * por construcción y queda aislado aquí para poder testearse.
 */
export function adaptRoundReducer<S extends AnyRoundState, E extends RoundEvent>(
  reducer: (state: S, event: E) => S,
): (state: AnyRoundState, event: RoundEvent) => AnyRoundState {
  return (state, event) => reducer(state as S, event as E);
}

/** Golpes contados de la tanda (todas las mecánicas comparten el campo). */
export function roundHits(state: AnyRoundState): number {
  return state.hits;
}

/** Meta de la tanda. */
export function roundGoal(state: AnyRoundState): number {
  return state.goal;
}

/** ms restantes del timer de la tanda. */
export function roundTimeLeftMs(state: AnyRoundState): number {
  return state.timeLeftMs;
}

/** Duración total del timer (para reconstruir HUD en reintento). */
export function roundTimeLimitMs(state: AnyRoundState): number {
  return state.timeLimitMs;
}

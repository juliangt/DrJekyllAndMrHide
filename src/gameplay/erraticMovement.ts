/**
 * Movimiento errático del objetivo (SPEC §4.2): LÓGICA PURA paso a paso,
 * determinista con un rng INYECTABLE. `ActionScene` la llama una vez por
 * frame con `Math.random` como rng; los tests inyectan secuencias fijas.
 *
 * Parámetros del Nivel 1 (vienen del `ActionConfig` como DATOS):
 *  - velocidad aleatoria en `speedRange` (px/s, N1: [120, 180]);
 *  - cambio aleatorio de dirección cada `dirChangeMs` (ms, N1: [800, 1500]);
 *  - rebote en los 4 bordes de la ZONA DE JUEGO (`bounds`, no toda la
 *    pantalla: deja fuera el HUD superior y el suelo).
 *
 * Sin import de Phaser: jsdom no puede cargarlo y no hace falta — esto es
 * geometría y aritmética.
 */

/** Generador de aleatorios inyectable: devuelve un número en [0, 1). */
export type Rng = () => number;

/** Estado del objetivo (posición en px y velocidad en px/s). */
export interface ErraticState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** ms que faltan para el próximo cambio aleatorio de dirección (> 0). */
  nextDirChangeIn: number;
}

/** Bordes de la zona de juego (límites para el CENTRO del objetivo). */
export interface ErraticBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Parámetros del movimiento errático (espejo del `ActionConfig`). */
export interface ErraticOptions {
  /** Rango de velocidad en px/s: [mín, máx], mín ≤ máx. */
  speedRange: readonly [number, number] | readonly number[];
  /** Rango del intervalo de cambio de dirección en ms: [mín, máx]. */
  dirChangeMs: readonly [number, number] | readonly number[];
  /** Zona de juego (rebote en los 4 lados). */
  bounds: ErraticBounds;
}

/** Resultado interno de sortear una dirección nueva. */
interface RandomDirection {
  vx: number;
  vy: number;
  nextDirChangeIn: number;
}

/**
 * Sortea dirección (ángulo uniforme), velocidad dentro de `speedRange` y el
 * próximo intervalo de cambio dentro de `dirChangeMs`. Consume 3 números del
 * rng: ángulo, velocidad y duración — documentado para los tests con rng de
 * secuencia.
 */
function randomDirection(rng: Rng, options: ErraticOptions): RandomDirection {
  const [minSpeed, maxSpeed] = options.speedRange;
  const [minChange, maxChange] = options.dirChangeMs;
  const angle = rng() * Math.PI * 2;
  const speed = minSpeed + rng() * Math.max(0, maxSpeed - minSpeed);
  const changeIn = minChange + rng() * Math.max(0, maxChange - minChange);
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    nextDirChangeIn: changeIn,
  };
}

/**
 * Estado inicial: el objetivo aparece en el CENTRO de la zona de juego con
 * una dirección y un intervalo de cambio sorteados (determinista con el rng
 * inyectado — la escena de reintento puede «recolocar» a la niña llamándolo
 * de nuevo).
 */
export function initialErraticState(rng: Rng, options: ErraticOptions): ErraticState {
  const { bounds } = options;
  const direction = randomDirection(rng, options);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    ...direction,
  };
}

/**
 * Un paso de integración (paso a paso, sin historial):
 *
 *  1. Avanza la posición `v · dt`.
 *  2. Rebota en los 4 bordes: CLAMP de la posición + inversión de la
 *     componente de velocidad correspondiente (la rapidez se conserva).
 *  3. Descuenta el tiempo al próximo cambio de dirección; al agotarse, sortea
 *     dirección/velocidad/intervalo nuevos (usa el rng SOLO en ese momento:
 *     sin sorteo pendiente no consume números).
 *
 * `dtMs` ≤ 0 o no finito → devuelve el estado intacto (frame congelado).
 * Invariante: tras cada paso la posición queda DENTRO de los bounds y la
 * rapidez (si hubo sorteo) dentro de `speedRange`.
 */
export function stepErratic(
  state: ErraticState,
  dtMs: number,
  rng: Rng,
  options: ErraticOptions,
): ErraticState {
  if (!(dtMs > 0) || !Number.isFinite(dtMs)) {
    return state;
  }
  const dtSec = dtMs / 1000;
  const { bounds } = options;

  let x = state.x + state.vx * dtSec;
  let y = state.y + state.vy * dtSec;
  let vx = state.vx;
  let vy = state.vy;

  // Rebote: clamp + inversión (nunca sale de la zona de juego).
  if (x < bounds.minX) {
    x = bounds.minX;
    vx = Math.abs(vx);
  } else if (x > bounds.maxX) {
    x = bounds.maxX;
    vx = -Math.abs(vx);
  }
  if (y < bounds.minY) {
    y = bounds.minY;
    vy = Math.abs(vy);
  } else if (y > bounds.maxY) {
    y = bounds.maxY;
    vy = -Math.abs(vy);
  }

  // ¿Toca cambiar de dirección?
  let nextDirChangeIn = state.nextDirChangeIn - dtMs;
  if (nextDirChangeIn <= 0) {
    const direction = randomDirection(rng, options);
    vx = direction.vx;
    vy = direction.vy;
    nextDirChangeIn = direction.nextDirChangeIn;
  }

  return { x, y, vx, vy, nextDirChangeIn };
}

/** Rapidez actual (px/s): `hypot(vx, vy)` — útil para tests y debugging. */
export function erraticSpeed(state: ErraticState): number {
  return Math.hypot(state.vx, state.vy);
}

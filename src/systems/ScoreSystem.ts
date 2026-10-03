/**
 * ScoreSystem (SPEC §5): puntaje de la TANDA del nivel (tap +10, quiz +100,
 * bonus +2/s restante). Con mini-emitter propio — sin Phaser.
 *
 * Evento `score:change`: payload `{ score, delta }` — se emite en cada
 * `add()` aceptado y en cada `reset()` (aunque ya estuviera en 0).
 *
 * Criterio de `add()` (decidido y documentado): solo se aceptan puntos
 * FINITOS y ESTRICTAMENTE POSITIVOS (`> 0`). Se rechazan en silencio (sin
 * evento, sin cambiar el score) los negativos, el 0, `NaN` e `Infinity`:
 * la SPEC nunca resta (tap fallido = 0, sin castigo) y un descuento
 * accidental nunca debe sacar el score del rango 0..214 del Nivel 1.
 *
 * El descarte de la tanda (fallo del quiz, D5/D7) es un `reset()` a 0.
 *
 * DESGLOSE POR CATEGORÍA (Etapa 6 — SPEC §6 «puntaje final desglosado»):
 * `add(points, category?)` acepta una CATEGORÍA opcional (`SCORE_CATEGORY`)
 * y acumula los puntos aceptados también en su cubeta del desglose
 * (`getBreakdown()`). Decisión de diseño, documentada:
 *
 *  - La API vieja NO se rompe: `add(points)` sigue existiendo y suma al
 *    total (sin tocar ninguna categoría) — llamadas existentes y sus tests
 *    quedan intactos.
 *  - El total SIEMPRE es la fuente de verdad; el desglose es un desglose
 *    DEL total (suma de cubetas ≤ total; igual si todas las sumas pasan por
 *    categorías, como hacen Action/QuizScene desde la Etapa 6).
 *  - `reset()` limpia total Y cubetas (el reinicio de tanda D5 y el
 *    «Jugar de nuevo» de la victoria descartan el desglose entero).
 *  - El payload del evento `score:change` NO cambia (los tests existentes
 *    lo fijan con `toEqual`): el desglose se lee bajo demanda con
 *    `getBreakdown()`, no se difunde por evento.
 *  - Una categoría desconocida (basura en runtime, TS la impide) suma al
 *    total pero NO se registra en el desglose: `getBreakdown()` queda
 *    cerrado a las tres cubetas conocidas.
 */

/** Nombre del evento de cambio de puntaje. */
export const SCORE_CHANGE_EVENT = 'score:change';

/**
 * Categorías del desglose de la tanda (SPEC §5/§6): taps del minijuego,
 * bonus por tiempo restante (2 pts/s) y quiz correcto (+100). Los valores
 * COINCIDEN con las claves de `ScoreBreakdown` (así la cubeta se indexa
 * segura en runtime y en types).
 */
export const SCORE_CATEGORY = {
  /** Tap exitoso (+10 c/u) durante la fase de acción. */
  taps: 'taps',
  /** Bonus por tiempo restante al lograr la meta (+2/s). */
  timeBonus: 'timeBonus',
  /** Quiz respondido correctamente (+100, todo o nada). */
  quiz: 'quiz',
} as const;

export type ScoreCategory = (typeof SCORE_CATEGORY)[keyof typeof SCORE_CATEGORY];

/** Desglose acumulado de la tanda por categoría (todos ≥ 0). */
export interface ScoreBreakdown {
  /** Puntos de taps exitosos (X × 10). */
  taps: number;
  /** Puntos del bonus de tiempo (2 × segundos restantes). */
  timeBonus: number;
  /** Puntos del quiz correcto (100 o 0). */
  quiz: number;
}

/** Payload del evento `score:change`. */
export interface ScoreChangePayload {
  /** Puntaje resultante (después del cambio). */
  score: number;
  /** Delta aplicado (negativo en un reset con score previo > 0). */
  delta: number;
}

type ScoreChangeHandler = (payload: ScoreChangePayload) => void;

export class ScoreSystem {
  private score = 0;
  private readonly breakdown: ScoreBreakdown = { taps: 0, timeBonus: 0, quiz: 0 };
  private readonly handlers = new Map<string, Set<ScoreChangeHandler>>();

  /** Puntaje actual de la tanda. */
  getScore(): number {
    return this.score;
  }

  /**
   * Desglose de la tanda por categoría (copia defensiva: mutarlo no toca el
   * estado interno). Las cubetas solo crecen por `add(points, category)`.
   */
  getBreakdown(): ScoreBreakdown {
    return { ...this.breakdown };
  }

  /**
   * Suma `points` (y opcionalmente lo registra en la cubeta de `category`)
   * y emite `score:change`. Rechaza silenciosamente valores no finitos o
   * ≤ 0 (ver criterio en la cabecera del módulo) — también para la cubeta.
   * Una categoría desconocida suma al total pero no al desglose. Devuelve
   * el puntaje resultante.
   */
  add(points: number, category?: ScoreCategory): number {
    if (!Number.isFinite(points) || points <= 0) {
      return this.score;
    }
    this.score += points;
    if (category !== undefined && this.isKnownCategory(category)) {
      this.breakdown[category] += points;
    }
    this.emit({ score: this.score, delta: points });
    return this.score;
  }

  /**
   * Vuelve a 0 (descarte de la tanda) y emite `score:change` con
   * `delta = -score_previo` (0 si ya estaba en 0: nunca `-0`). Emite aunque
   * ya estuviera en 0. Limpia TAMBIÉN el desglose por categorías (D5 y
   * «Jugar de nuevo» descartan taps + bonus + quiz de la tanda).
   */
  reset(): void {
    const delta = this.score > 0 ? -this.score : 0;
    this.score = 0;
    this.breakdown.taps = 0;
    this.breakdown.timeBonus = 0;
    this.breakdown.quiz = 0;
    this.emit({ score: this.score, delta });
  }

  /** Guard de runtime: ¿es una de las cubetas conocidas del desglose? */
  private isKnownCategory(category: ScoreCategory): boolean {
    return (Object.values(SCORE_CATEGORY) as string[]).includes(category);
  }

  // ---- Mini-emitter ------------------------------------------------------

  /** Suscribe a `score:change`; devuelve la función de baja. */
  onChange(handler: ScoreChangeHandler): () => void {
    const set = this.handlers.get(SCORE_CHANGE_EVENT) ?? new Set<ScoreChangeHandler>();
    set.add(handler);
    this.handlers.set(SCORE_CHANGE_EVENT, set);
    return () => {
      set.delete(handler);
    };
  }

  /** Emite manualmente (uso interno / para futuros eventos del emitter). */
  private emit(payload: ScoreChangePayload): void {
    const set = this.handlers.get(SCORE_CHANGE_EVENT);
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }
}

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
 */

/** Nombre del evento de cambio de puntaje. */
export const SCORE_CHANGE_EVENT = 'score:change';

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
  private readonly handlers = new Map<string, Set<ScoreChangeHandler>>();

  /** Puntaje actual de la tanda. */
  getScore(): number {
    return this.score;
  }

  /**
   * Suma `points` y emite `score:change`. Rechaza silenciosamente valores
   * no finitos o ≤ 0 (ver criterio en la cabecera del módulo). Devuelve el
   * puntaje resultante.
   */
  add(points: number): number {
    if (!Number.isFinite(points) || points <= 0) {
      return this.score;
    }
    this.score += points;
    this.emit({ score: this.score, delta: points });
    return this.score;
  }

  /**
   * Vuelve a 0 (descarte de la tanda) y emite `score:change` con
   * `delta = -score_previo` (0 si ya estaba en 0: nunca `-0`). Emite aunque
   * ya estuviera en 0.
   */
  reset(): void {
    const delta = this.score > 0 ? -this.score : 0;
    this.score = 0;
    this.emit({ score: this.score, delta });
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

/**
 * Puntuación de la fase de acción (SPEC §5): DATOS + FUNCIÓN PURA.
 *
 *  - Tap exitoso: **+10** (×3 = 30 máx.) — se suma al `ScoreSystem` en el
 *    momento del hit (evento por evento, HUD vivo).
 *  - Bonus por tiempo restante al lograr la meta: **+2 por segundo**
 *    restante del timer, con FLOOR del restante (45000 ms → 90; 19999 ms →
 *    38). Se suma UNA vez, cuando el reducer pasa a fase `goal`.
 *  - Tap fallido y timeout: 0 puntos (SPEC §5: sin castigo / tanda a 0).
 *
 * Caso del PLAN (CA Etapa 4): 3 taps (30) + 20 s restantes (40) + quiz
 * pendiente (0) = **70 pts acumulados** — ver tests.
 *
 * Sin import de Phaser.
 */

/** Puntos por tap exitoso sobre el objetivo (SPEC §5). */
export const TAP_POINTS = 10;

/** Puntos por cada segundo restante al lograr la meta (SPEC §5). */
export const TIME_BONUS_PER_SECOND = 2;

/**
 * Bonus de tiempo por segundos restantes: `floor(timeLeftMs / 1000) · 2`.
 * Entradas ≤ 0 o no finitas → 0 (timeout no da bonus, jamás negativo).
 */
export function timeBonus(timeLeftMs: number): number {
  if (!(timeLeftMs > 0) || !Number.isFinite(timeLeftMs)) {
    return 0;
  }
  return Math.floor(timeLeftMs / 1000) * TIME_BONUS_PER_SECOND;
}

/**
 * Puntos acumulados de una tanda COMPLETA de acción con `hits` taps y el
 * tiempo restante indicado (el quiz aún pendiente aporta 0): la aritmética
 * exacta del CA de la Etapa 4 en una sola función. Entridas no finitas se
 * tratan como 0 taps.
 */
export function actionRoundScore(hits: number, timeLeftMs: number): number {
  const cleanHits = Number.isFinite(hits) ? Math.max(0, Math.floor(hits)) : 0;
  return cleanHits * TAP_POINTS + timeBonus(timeLeftMs);
}

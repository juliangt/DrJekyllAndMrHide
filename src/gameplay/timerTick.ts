/**
 * Timer del minijuego (SPEC §4.2/§6): FUNCIONES PURAS de cuenta, criticalidad
 * y tick sonoro. `ui/TimerBar` y `ActionScene` las consumen.
 *
 *  - `secondsLeft`: segundos a MOSTRAR (`ceil`: 4 999 ms todavía son «5»).
 *  - `isCriticalTime`: ventana final (últimos 5 s) donde la barra va roja y
 *    con pulso (SPEC §6) y suena el tick (SPEC §8).
 *  - `shouldTick`: un tick por SEGUNDO mostrado, sin dobles ticks dentro del
 *    mismo segundo (la escena recuerda el último segundo ticado).
 */

/** Ventana crítica: últimos 5 s (SPEC §4.2 «sonido tick en los últimos 5 s»). */
export const CRITICAL_WINDOW_MS = 5000;

/** Segundos enteros a mostrar en el HUD: `ceil(ms/1000)`, clamp a [0, ∞). */
export function secondsLeft(timeLeftMs: number): number {
  if (!(timeLeftMs > 0) || !Number.isFinite(timeLeftMs)) {
    return 0;
  }
  return Math.ceil(timeLeftMs / 1000);
}

/** ¿Está el timer en la ventana crítica (0 < ms ≤ ventana)? */
export function isCriticalTime(
  timeLeftMs: number,
  windowMs: number = CRITICAL_WINDOW_MS,
): boolean {
  return timeLeftMs > 0 && timeLeftMs <= windowMs;
}

/**
 * El segundo (mostrado) al que corresponde un tick sonoro: `secondsLeft` si
 * está en la ventana crítica, `null` si NO toca (fuera de ventana o ya a 0 —
 * a 0 suena `AudioSystem.timeout()`, no un tick).
 */
export function tickSecond(
  timeLeftMs: number,
  windowMs: number = CRITICAL_WINDOW_MS,
): number | null {
  if (!isCriticalTime(timeLeftMs, windowMs)) {
    return null;
  }
  return secondsLeft(timeLeftMs);
}

/**
 * ¿Debe sonar un tick en este frame? True solo si el segundo ticable actual
 * difiere del último ticado (un tick por segundo mostrado: 5, 4, 3, 2, 1).
 * `lastTickedSecond = null` = aún no ha ticado nada.
 */
export function shouldTick(
  timeLeftMs: number,
  lastTickedSecond: number | null,
  windowMs: number = CRITICAL_WINDOW_MS,
): boolean {
  const second = tickSecond(timeLeftMs, windowMs);
  return second !== null && second !== lastTickedSecond;
}

/**
 * Proporción de tiempo restante para la barra (0..1, clamp): el largo de la
 * barra es proporcional al tiempo restante (SPEC §6).
 */
export function timerRatio(timeLeftMs: number, totalMs: number): number {
  if (!(totalMs > 0) || !Number.isFinite(totalMs)) {
    return 0;
  }
  const ratio = timeLeftMs / totalMs;
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.min(1, Math.max(0, ratio));
}

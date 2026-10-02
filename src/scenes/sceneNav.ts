/**
 * Navegación entre escenas (SPEC §3) con transición fade.
 *
 * El MAPA DEL FLUJO vive aquí como DATOS PUROS (`NEXT_SCENE` +
 * `ALT_TRANSITIONS`): los tests lo validan sin Phaser — jsdom no puede
 * cargar Phaser, así que este módulo solo importa Phaser como TIPO y el
 * helper `transitionTo` se ejerce en el navegador.
 *
 * Grafo (SPEC §3):
 *
 *   BOOT → PRELOAD → MENU → NARRATIVE → ACTION → QUIZ ─✔→ VICTORY → MENU
 *                        ▲        timeout│  │            │
 *                        └── ✘ (D5) ──────┘  └─ ✘ → NARRATIVE (reinicio nivel)
 *                                  ACTION ← GAME_OVER (overlay «Reintentar»)
 */

import type Phaser from 'phaser';
import { hexToRgb, nightBackground } from '../config/palette';
import { SceneKey, type SceneKey as SceneKeyType } from '../config/sceneKeys';

/**
 * Cadena principal del flujo: para cada escena, su salida por defecto.
 * `QUIZ` apunta a `VICTORY` porque en v1 la única salida correcta del quiz
 * es la victoria; `VICTORY` vuelve a `MENU` («Volver al inicio»).
 */
export const NEXT_SCENE: Readonly<Record<SceneKeyType, SceneKeyType>> = {
  [SceneKey.BOOT]: SceneKey.PRELOAD,
  [SceneKey.PRELOAD]: SceneKey.MENU,
  [SceneKey.MENU]: SceneKey.NARRATIVE,
  [SceneKey.NARRATIVE]: SceneKey.ACTION,
  [SceneKey.ACTION]: SceneKey.QUIZ, // meta 3/3 alcanzada
  [SceneKey.GAME_OVER]: SceneKey.ACTION, // «Reintentar»: SOLO el minijuego
  [SceneKey.QUIZ]: SceneKey.VICTORY, // respuesta correcta
  [SceneKey.VICTORY]: SceneKey.MENU, // «Volver al inicio» / rejugar
};

/** Salidas alternativas (aristas condicionales) del grafo del flujo. */
export const ALT_TRANSITIONS = {
  /** Quiz fallido → reinicio del NIVEL completo (decisión D5). */
  quizWrong: { from: SceneKey.QUIZ, to: SceneKey.NARRATIVE },
  /** Timeout del minijuego → overlay GAME_OVER (dentro de ActionScene). */
  actionTimeout: { from: SceneKey.ACTION, to: SceneKey.GAME_OVER },
} as const satisfies Record<string, { from: SceneKeyType; to: SceneKeyType }>;

/** Siguiente escena de la cadena principal (útil para no exponer el mapa). */
export function nextSceneKey(from: SceneKeyType): SceneKeyType {
  return NEXT_SCENE[from];
}

// ---- Helper de transición con fade ---------------------------------------

/** Duración por defecto de cada tramo del fade (ms). */
export const FADE_DURATION_MS = 400;

/**
 * Literal de `Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE`
 * (verificado contra phaser 4.2.1). Se escribe aquí como string para que
 * este módulo no importe Phaser en runtime y sea testeable en jsdom.
 */
const FADE_OUT_COMPLETE = 'camerafadeoutcomplete';

/**
 * Guard de reentrada de `transitionTo` (deuda anotada por la etapa
 * anterior): handler de fade PENDIENTE por escena. Si `transitionTo` se
 * llama dos veces (p. ej. doble tap rápido en un botón), el handler de la
 * primera llamada se retira de la cámara antes de registrar el nuevo —
 * sin este guard, dos `once` vivos dispararían `scene.start` DOS veces.
 *
 * Nota: el emitter de Phaser (eventemitter3) guarda la referencia ORIGINAL
 * del listener, así que `cam.off(event, fn)` sí da de baja un `once`.
 */
const pendingFadeHandlers = new WeakMap<Phaser.Scene, () => void>();

/**
 * Transición estándar entre escenas: fade OUT con el color de noche →
 * `scene.start(key, data)` al completarse el fade → la escena destino hace
 * su propio fade IN en `create()` (helper `fadeIn`).
 *
 * Reentrante: llamadas repetidas mientras un fade está pendiente RETIRAN
 * el listener anterior (gana la última llamada; `scene.start` se ejecuta
 * una sola vez).
 *
 * Los RGB del fade se derivan de `nightBackground` para que la transición
 * sea literalmente «la niebla se traga la pantalla».
 */
export function transitionTo(
  scene: Phaser.Scene,
  key: SceneKeyType,
  data?: object,
  durationMs: number = FADE_DURATION_MS,
): void {
  const { r, g, b } = hexToRgb(nightBackground);
  const cam = scene.cameras.main;
  const previous = pendingFadeHandlers.get(scene);
  if (previous) {
    cam.off(FADE_OUT_COMPLETE, previous);
    pendingFadeHandlers.delete(scene);
  }
  const handler = (): void => {
    pendingFadeHandlers.delete(scene);
    scene.scene.start(key, data);
  };
  pendingFadeHandlers.set(scene, handler);
  cam.once(FADE_OUT_COMPLETE, handler);
  cam.fadeOut(durationMs, r, g, b);
}

/** Fade IN de entrada: llamar en el `create()` de cada escena destino. */
export function fadeIn(scene: Phaser.Scene, durationMs: number = FADE_DURATION_MS): void {
  const { r, g, b } = hexToRgb(nightBackground);
  scene.cameras.main.fadeIn(durationMs, r, g, b);
}

/**
 * Atajo: transición hacia la SIGUIENTE escena de la cadena principal
 * (`NEXT_SCENE[from]`).
 */
export function goToNextScene(
  scene: Phaser.Scene,
  from: SceneKeyType,
  data?: object,
  durationMs: number = FADE_DURATION_MS,
): void {
  transitionTo(scene, nextSceneKey(from), data, durationMs);
}

/**
 * Navegación entre escenas (SPEC §3) con transición fade (+ wipe de niebla,
 * Etapa 3: la salida de NARRATIVE hacia ACTION, SPEC §7.2).
 *
 * El MAPA DEL FLUJO vive aquí como DATOS PUROS (`NEXT_SCENE` +
 * `ALT_TRANSITIONS`, y `FOG_WIPE_DEFAULTS` para el wipe): los tests lo
 * validan sin Phaser — jsdom no puede cargar Phaser, así que este módulo
 * solo importa Phaser como TIPO y los helpers (`transitionTo`, `wipeTo`)
 * se ejercitan con fakes estructurales en tests y en el navegador.
 *
 * Grafo (SPEC §3, con la intro pre-nivel de la cinemática):
 *
 *   BOOT → PRELOAD → MENU → INTRO → NARRATIVE → ACTION → QUIZ ─✔→ VICTORY → MENU
 *                                ▲        timeout│  │            │
 *                                └── ✘ (D5) ──────┘  └─ ✘ → NARRATIVE (reinicio nivel)
 *                                          ACTION ← GAME_OVER (overlay «Reintentar»)
 *
 * NOTA — la intro SOLO se reproduce saliendo del menú (MENU → INTRO, «antes
 * de arrancar el primer nivel»): las aristas alternativas NO cambian — el
 * quiz fallido sigue yendo DIRECTO a NARRATIVE sin reproducirla.
 */

import type Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import {
  fogMid,
  fogNear,
  hexToNumber,
  hexToRgb,
  nightBackground,
} from '../config/palette';
import { TEXTURE_KEYS } from '../art/textures';
import { SceneKey, type SceneKey as SceneKeyType } from '../config/sceneKeys';

/**
 * Cadena principal del flujo: para cada escena, su salida por defecto.
 * `QUIZ` apunta a `VICTORY` porque en v1 la única salida correcta del quiz
 * es la victoria; `VICTORY` vuelve a `MENU` («Volver al inicio»).
 */
export const NEXT_SCENE: Readonly<Record<SceneKeyType, SceneKeyType>> = {
  [SceneKey.BOOT]: SceneKey.PRELOAD,
  [SceneKey.PRELOAD]: SceneKey.MENU,
  [SceneKey.MENU]: SceneKey.INTRO, // la intro solo se ve al salir del menú
  [SceneKey.INTRO]: SceneKey.NARRATIVE, // fin de la cinemática → narrativa del N1
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

// ---- Wipe de niebla (Etapa 3: NARRATIVE → ACTION) ----------------------------

/** Config del wipe de niebla (datos puros, testeables). */
export interface FogWipeConfig {
  /** Duración del barrido Y del fade de cámara (ms). */
  durationMs: number;
  /** 1 = barre de izquierda a derecha; -1 = de derecha a izquierda. */
  direction: 1 | -1;
  /** Textura de cada sprite de la cortina (clave de `TEXTURE_KEYS`). */
  textureKey: string;
  /** Nº de sprites apilados verticalmente (pool acotado, SPEC §10.4). */
  spriteCount: number;
  /** Escala de cada sprite (los 256 px de la niebla × esto cubre 720 px). */
  spriteScale: number;
  /** Alfa de la cortina. */
  alpha: number;
  /** Profundidad: por encima de toda la UI de la escena. */
  depth: number;
  /** Desfase por sprite para el borde irregular de la cortina (ms). */
  staggerMs: number;
}

/**
 * Wipe por defecto: 5 nieblas grandes (pool ≤ 30, SPEC §10.4) barren de
 * izquierda a derecha en 900 ms mientras la cámara se funde a negro-noche.
 */
export const FOG_WIPE_DEFAULTS = {
  durationMs: 900,
  direction: 1,
  textureKey: TEXTURE_KEYS.fog,
  spriteCount: 5,
  spriteScale: 3.4,
  alpha: 0.95,
  depth: 1000,
  staggerMs: 30,
} as const satisfies FogWipeConfig;

/** Media anchura display de un sprite de la cortina (px). */
function wipeSpriteHalfWidth(config: FogWipeConfig): number {
  return 128 * config.spriteScale;
}

/**
 * Transición dramática fade + wipe de niebla (SPEC §7.2 «transiciones de
 * escena con fade + wipe de niebla»): una cortina de sprites `fog-puff`-like
 * barre la pantalla por ENCIMA del fade out, y al completarse el fade arranca
 * la escena destino (que hace su propio `fadeIn`).
 *
 * Mismo guard de reentrada que `transitionTo` (comparten `pendingFadeHandlers`):
 * si había un fade pendiente, su handler se retira y gana la última llamada.
 */
export function wipeTo(
  scene: Phaser.Scene,
  key: SceneKeyType,
  data?: object,
  config: FogWipeConfig = FOG_WIPE_DEFAULTS,
): void {
  const { r, g, b } = hexToRgb(nightBackground);
  const cam = scene.cameras.main;
  const previous = pendingFadeHandlers.get(scene);
  if (previous) {
    cam.off(FADE_OUT_COMPLETE, previous);
    pendingFadeHandlers.delete(scene);
  }

  // Cortina: sprites apilados que cubren todo el lienzo, alternando el tinte
  // de niebla (cercana/media) para que el frente lea como volumen de niebla.
  const halfWidth = wipeSpriteHalfWidth(config);
  const stepY = BASE_HEIGHT / config.spriteCount;
  const startX = config.direction === 1 ? -halfWidth : BASE_WIDTH + halfWidth;
  const endX = config.direction === 1 ? BASE_WIDTH + halfWidth : -halfWidth;
  const curtain: Phaser.GameObjects.Image[] = [];

  for (let i = 0; i < config.spriteCount; i++) {
    const sprite = scene.add
      .image(startX, (i + 0.5) * stepY, config.textureKey)
      .setScale(config.spriteScale)
      .setAlpha(config.alpha)
      .setDepth(config.depth)
      .setTint(hexToNumber(i % 2 === 0 ? fogNear : fogMid));
    scene.tweens.add({
      targets: sprite,
      x: endX,
      duration: config.durationMs,
      delay: i * config.staggerMs,
      ease: 'Sine.easeInOut',
    });
    curtain.push(sprite);
  }

  const handler = (): void => {
    pendingFadeHandlers.delete(scene);
    for (const sprite of curtain) {
      sprite.destroy();
    }
    scene.scene.start(key, data);
  };
  pendingFadeHandlers.set(scene, handler);
  cam.once(FADE_OUT_COMPLETE, handler);
  cam.fadeOut(config.durationMs, r, g, b);
}

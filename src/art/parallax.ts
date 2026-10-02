/**
 * Parallax de niebla en deriva (SPEC §7.2) como LÓGICA PURA + DATOS.
 *
 * `driftOffset` es la deriva sinusoidal de cada capa (determinista y
 * acotada: ±amplitude); `MENU_PARALLAX_LAYERS` describe el fondo del menú
 * como datos (texturas de `TEXTURE_KEYS`, tinte, alfa, profundidad y
 * parámetros de deriva por capa). `MenuScene` solo CONSUME esta tabla —
 * así el fondo es testeable sin Phaser (jsdom no puede cargarlo).
 *
 * La deriva es oscilación (no scroll continuo): el menú es una cámara
 * estática y las capas «respiran» alrededor de su posición base.
 */

import type { HexColor } from '../config/palette';
import { fogFar, fogMid, fogNear } from '../config/palette';
import { TEXTURE_KEYS } from './textures';

/** Parámetros de la deriva sinusoidal de una capa. */
export interface DriftParams {
  /** Velocidad angular (rad/s): periodo = 2π/speed. */
  speed: number;
  /** Amplitud del vaivén (px, ≥ 0): la deriva queda en ±amplitude. */
  amplitude: number;
  /** Desfase (rad) para desincronizar capas entre sí. */
  phase: number;
}

/**
 * Desplazamiento horizontal de una capa en el instante `t` (segundos):
 * `sin(t·speed + phase) · amplitude`. Determinista, acotada y suave.
 */
export function driftOffset(t: number, params: DriftParams): number {
  return Math.sin(t * params.speed + params.phase) * params.amplitude;
}

/** Un sprite de la capa: posición base (centro), escala y desfase extra. */
export interface ParallaxSlot {
  x: number;
  y: number;
  scale: number;
  /** Desfase adicional sobre `DriftParams.phase` (desincroniza slots). */
  phaseOffset: number;
}

/** Una capa del fondo: misma textura/tinte/alfa/deriva, varios slots. */
export interface ParallaxLayer {
  /** Clave de textura (valor de `TEXTURE_KEYS`). */
  key: string;
  /** Tinte multiplicativo (paleta) — ausente = colores originales. */
  tint?: HexColor;
  /** Alfa de los sprites de la capa (0–1; niebla con alfa baja, §7.2). */
  alpha: number;
  /** Profundidad (orden de pintado: menor = más lejos). */
  depth: number;
  /** Deriva común de la capa. */
  drift: DriftParams;
  slots: readonly ParallaxSlot[];
}

/** Desfase de fase por índice de slot si el dato no lo especifica. */
const SLOT_PHASE_STEP = 1.1;

/**
 * Fondo del menú (Etapa 2): callejón en silueta sobre la línea de calle
 * (y≈1060), tres bandas de niebla (lejana/media/cercana, SPEC §7.1) con
 * deriva creciente hacia el espectador y dos farolas entre medias. La capa
 * cercana pasa por DELANTE de los edificios pero por DETRÁS de la UI
 * (MenuScene pintará los botones a depth ≥ 10).
 */
export const MENU_PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    // Siluetas de edificios: fondo del callejón.
    key: TEXTURE_KEYS.building,
    alpha: 1,
    depth: 1,
    drift: { speed: 0.05, amplitude: 5, phase: 0 },
    slots: [
      { x: 20, y: 849, scale: 0.66, phaseOffset: 0 },
      { x: 250, y: 851, scale: 0.72, phaseOffset: SLOT_PHASE_STEP },
      { x: 480, y: 848, scale: 0.64, phaseOffset: SLOT_PHASE_STEP * 2 },
      { x: 690, y: 852, scale: 0.7, phaseOffset: SLOT_PHASE_STEP * 3 },
    ],
  },
  {
    // Niebla lejana: banda alta, lenta y tenue (fogFar).
    key: TEXTURE_KEYS.fog,
    tint: fogFar,
    alpha: 0.24,
    depth: 2,
    drift: { speed: 0.16, amplitude: 30, phase: 0.5 },
    slots: [
      { x: 130, y: 750, scale: 2.8, phaseOffset: 0 },
      { x: 530, y: 790, scale: 3.1, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Farolas: casi estáticas (solo un leve balanceo).
    key: TEXTURE_KEYS.lampPost,
    alpha: 1,
    depth: 3,
    drift: { speed: 0.07, amplitude: 3, phase: 2.1 },
    slots: [
      { x: 150, y: 880, scale: 1, phaseOffset: 0 },
      { x: 590, y: 884, scale: 1.1, phaseOffset: SLOT_PHASE_STEP },
    ],
  },
  {
    // Niebla media: envuelve farolas y botones (fogMid).
    key: TEXTURE_KEYS.fog,
    tint: fogMid,
    alpha: 0.18,
    depth: 4,
    drift: { speed: 0.24, amplitude: 44, phase: 1.8 },
    slots: [
      { x: 0, y: 905, scale: 3.2, phaseOffset: 0 },
      { x: 470, y: 960, scale: 3.5, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Niebla cercana: la más rápida y amplia, por delante de todo el fondo
    // (pero a depth 5 < 10: la UI queda legible, contraste SPEC §9).
    key: TEXTURE_KEYS.fog,
    tint: fogNear,
    alpha: 0.12,
    depth: 5,
    drift: { speed: 0.34, amplitude: 58, phase: 3.9 },
    slots: [
      { x: 240, y: 1080, scale: 3.6, phaseOffset: 0 },
      { x: 740, y: 1170, scale: 3.8, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
];

/**
 * Deriva efectiva de un slot concreto (fase de la capa + desfase del slot).
 */
export function slotDrift(layer: ParallaxLayer, slot: ParallaxSlot): DriftParams {
  return {
    speed: layer.drift.speed,
    amplitude: layer.drift.amplitude,
    phase: layer.drift.phase + slot.phaseOffset,
  };
}

// ---- Flicker de farolas -------------------------------------------------------

/**
 * Opacidad de una farola en el instante `t` (s): pulso lento entre
 * `minAlpha` y 1 con una pequeña asimetría (el «parpadeo» de SPEC §7.2,
 * determinista y sin Math.random para poder testarse si hiciera falta).
 */
export function lampFlicker(t: number, minAlpha = 0.78, speed = 5.1): number {
  const wave = Math.sin(t * speed) * 0.5 + 0.5; // 0..1
  const jitter = Math.sin(t * speed * 2.7) * 0.08;
  return Math.min(1, Math.max(0, minAlpha + wave * (1 - minAlpha) + jitter));
}

// ---- Constantes de composición consumidas por MenuScene ----------------------

/** Y de la línea de calle (los edificios/farolas apoyan aquí). */
export const STREET_LINE_Y = 1060;

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
import { fogFar, fogMid, fogNear, labGreen, potionPurple } from '../config/palette';
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

// ---- Fondos narrativos (Etapa 3, PLAN) ---------------------------------------
//
// Los tres fondos de las viñetas (`LoreBackground` de `config/levels/types`):
// la mitad INFERIOR del lienzo la tapa el panel de texto (ver
// `NARRATIVE_SCENE_LAYOUT` en `config/narrative.ts`), así que la composición
// concentra siluetas, farolas y vapor en la banda superior (~0–700 px).

/**
 * Fondo «street» (panel 1: calle londinense amplia, «la niebla traga las
 * farolas»): fachadas en silueta, dos farolas y niebla MÁS densa que en el
 * menú (alfas algo mayores).
 */
export const STREET_PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    // Fachadas de la calle: siluetas más bajas y espaciadas (calle ancha).
    key: TEXTURE_KEYS.building,
    alpha: 1,
    depth: 1,
    drift: { speed: 0.05, amplitude: 4, phase: 0.3 },
    slots: [
      { x: 30, y: 820, scale: 0.62, phaseOffset: 0 },
      { x: 260, y: 835, scale: 0.7, phaseOffset: SLOT_PHASE_STEP },
      { x: 490, y: 826, scale: 0.66, phaseOffset: SLOT_PHASE_STEP * 2 },
      { x: 700, y: 832, scale: 0.72, phaseOffset: SLOT_PHASE_STEP * 3 },
    ],
  },
  {
    // Niebla lejana: banda alta que «traga» el cielo.
    key: TEXTURE_KEYS.fog,
    tint: fogFar,
    alpha: 0.26,
    depth: 2,
    drift: { speed: 0.14, amplitude: 34, phase: 0.6 },
    slots: [
      { x: 150, y: 300, scale: 3.0, phaseOffset: 0 },
      { x: 560, y: 380, scale: 3.2, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Farolas: cabezas visibles sobre el borde del panel (flicker en runtime).
    key: TEXTURE_KEYS.lampPost,
    alpha: 1,
    depth: 3,
    drift: { speed: 0.06, amplitude: 3, phase: 2.3 },
    slots: [
      { x: 150, y: 750, scale: 1, phaseOffset: 0 },
      { x: 585, y: 762, scale: 1.08, phaseOffset: SLOT_PHASE_STEP },
    ],
  },
  {
    // Niebla media: envuelve los faroles.
    key: TEXTURE_KEYS.fog,
    tint: fogMid,
    alpha: 0.2,
    depth: 4,
    drift: { speed: 0.22, amplitude: 46, phase: 1.7 },
    slots: [
      { x: 40, y: 560, scale: 3.3, phaseOffset: 0 },
      { x: 500, y: 640, scale: 3.5, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Niebla cercana: rasga el borde superior del panel.
    key: TEXTURE_KEYS.fog,
    tint: fogNear,
    alpha: 0.14,
    depth: 5,
    drift: { speed: 0.32, amplitude: 58, phase: 3.8 },
    slots: [
      { x: 230, y: 680, scale: 3.6, phaseOffset: 0 },
      { x: 720, y: 700, scale: 3.8, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
];

/**
 * Fondo «alley» (paneles 3–4: callejón estrecho): fachadas MÁS cercanas y
 * grandes (sensación de pared que se cierra), una sola farola y niebla baja.
 */
export const ALLEY_PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    // Fachadas grandes y apretadas: el callejón se estrecha.
    key: TEXTURE_KEYS.building,
    alpha: 1,
    depth: 1,
    drift: { speed: 0.06, amplitude: 6, phase: 1.1 },
    slots: [
      { x: 70, y: 800, scale: 0.95, phaseOffset: 0 },
      { x: 370, y: 812, scale: 1.05, phaseOffset: SLOT_PHASE_STEP },
      { x: 665, y: 806, scale: 0.98, phaseOffset: SLOT_PHASE_STEP * 2.2 },
    ],
  },
  {
    // Niebla lejana colgada del fondo del callejón.
    key: TEXTURE_KEYS.fog,
    tint: fogFar,
    alpha: 0.22,
    depth: 2,
    drift: { speed: 0.17, amplitude: 28, phase: 0.9 },
    slots: [
      { x: 120, y: 330, scale: 3.1, phaseOffset: 0 },
      { x: 590, y: 300, scale: 2.9, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Una única farola: el callejón es pobre y oscuro.
    key: TEXTURE_KEYS.lampPost,
    alpha: 1,
    depth: 3,
    drift: { speed: 0.07, amplitude: 3, phase: 2.5 },
    slots: [{ x: 500, y: 742, scale: 1.1, phaseOffset: 0 }],
  },
  {
    // Niebla media.
    key: TEXTURE_KEYS.fog,
    tint: fogMid,
    alpha: 0.18,
    depth: 4,
    drift: { speed: 0.25, amplitude: 42, phase: 2.2 },
    slots: [
      { x: 0, y: 580, scale: 3.4, phaseOffset: 0 },
      { x: 480, y: 650, scale: 3.6, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Niebla cercana: la que «lo cubre todo» en el panel final.
    key: TEXTURE_KEYS.fog,
    tint: fogNear,
    alpha: 0.12,
    depth: 5,
    drift: { speed: 0.34, amplitude: 60, phase: 0.7 },
    slots: [
      { x: 250, y: 690, scale: 3.7, phaseOffset: 0 },
      { x: 740, y: 660, scale: 3.9, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
];

/**
 * Fondo «lab» (panel 2: laboratorio de Jekyll): SIN edificios ni farolas —
 * vapor de experimentos en dos tonos (bruma púrpura de los polvos + vapor
 * verde de la poción) que respira sobre la mesa (props en `LORE_BACKGROUNDS`).
 */
export const LAB_PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    // Bruma púrpura alta: los polvos suspendidos en el aire.
    key: TEXTURE_KEYS.fog,
    tint: potionPurple,
    alpha: 0.1,
    depth: 1,
    drift: { speed: 0.12, amplitude: 30, phase: 0.2 },
    slots: [
      { x: 160, y: 240, scale: 3.4, phaseOffset: 0 },
      { x: 560, y: 420, scale: 3.2, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Vapor verde medio: el aliento de la poción.
    key: TEXTURE_KEYS.fog,
    tint: labGreen,
    alpha: 0.14,
    depth: 2,
    drift: { speed: 0.2, amplitude: 40, phase: 1.4 },
    slots: [
      { x: 60, y: 400, scale: 3.3, phaseOffset: 0 },
      { x: 620, y: 520, scale: 3.5, phaseOffset: SLOT_PHASE_STEP * 2.3 },
    ],
  },
  {
    // Vapor verde cercano: rueda sobre la mesa.
    key: TEXTURE_KEYS.fog,
    tint: labGreen,
    alpha: 0.1,
    depth: 3,
    drift: { speed: 0.3, amplitude: 52, phase: 3.0 },
    slots: [
      { x: 300, y: 620, scale: 3.6, phaseOffset: 0 },
      { x: 720, y: 560, scale: 3.4, phaseOffset: SLOT_PHASE_STEP * 1.8 },
    ],
  },
];

// ---- Fondo del minijuego (Etapa 4, PLAN/SPEC §4.2) ----------------------------

/**
 * Fondo de ACTION (el callejón del minijuego): fachadas grandes en silueta
 * sobre la línea de calle, dos farolas con flicker y TRES bandas de niebla
 * (lejos/media/cercana, SPEC §4.2 «niebla en capas») que derivan por la
 * ZONA DE JUEGO (la niña se mueve a depth 6, por encima de toda la niebla;
 * el HUD vive a depth ≥ 10 — ver `gameplay/actionLayout.ts`).
 *
 * Presupuesto de niebla (SPEC §10.4 ≤ 30): 6 slots de niebla aquí + el pool
 * de puffs del feedback (≤ 6, `PUFF_POOL_SIZE`) = 12 ≤ 30 (testeado).
 */
export const ACTION_PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    // Fachadas del callejón: grandes y apretadas (paredes que se cierran).
    key: TEXTURE_KEYS.building,
    alpha: 1,
    depth: 1,
    drift: { speed: 0.06, amplitude: 5, phase: 0.2 },
    slots: [
      { x: 60, y: 830, scale: 0.95, phaseOffset: 0 },
      { x: 350, y: 842, scale: 1.05, phaseOffset: SLOT_PHASE_STEP },
      { x: 650, y: 836, scale: 0.98, phaseOffset: SLOT_PHASE_STEP * 2.2 },
    ],
  },
  {
    // Niebla lejana: fondo del callejón, casi estática.
    key: TEXTURE_KEYS.fog,
    tint: fogFar,
    alpha: 0.2,
    depth: 2,
    drift: { speed: 0.15, amplitude: 30, phase: 1.0 },
    slots: [
      { x: 150, y: 420, scale: 3.0, phaseOffset: 0 },
      { x: 570, y: 480, scale: 3.2, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Farolas del callejón (flicker en runtime, a los lados de la zona).
    key: TEXTURE_KEYS.lampPost,
    alpha: 1,
    depth: 3,
    drift: { speed: 0.07, amplitude: 3, phase: 2.4 },
    slots: [
      { x: 130, y: 878, scale: 1.05, phaseOffset: 0 },
      { x: 600, y: 886, scale: 1.0, phaseOffset: SLOT_PHASE_STEP },
    ],
  },
  {
    // Niebla media: envuelve los faroles y la mitad baja de la zona.
    key: TEXTURE_KEYS.fog,
    tint: fogMid,
    alpha: 0.18,
    depth: 4,
    drift: { speed: 0.24, amplitude: 46, phase: 1.9 },
    slots: [
      { x: 60, y: 640, scale: 3.4, phaseOffset: 0 },
      { x: 520, y: 720, scale: 3.5, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
  {
    // Niebla frontal: la más rápida y clara, rueda por delante del callejón.
    // Etapa 7 (pulido): speed 0.34 → 0.30 y amplitud 58 → 52 — en el
    // minijuego el fondo no debe competir con la niña errática: deriva algo
    // más lenta y acotada (sigue siendo la capa más viva del callejón).
    key: TEXTURE_KEYS.fog,
    tint: fogNear,
    alpha: 0.12,
    depth: 5,
    drift: { speed: 0.3, amplitude: 52, phase: 3.3 },
    slots: [
      { x: 240, y: 900, scale: 3.6, phaseOffset: 0 },
      { x: 760, y: 960, scale: 3.8, phaseOffset: SLOT_PHASE_STEP * 2 },
    ],
  },
];

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

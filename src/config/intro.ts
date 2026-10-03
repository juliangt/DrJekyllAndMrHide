/**
 * DATOS + LÓGICA PURA de la cinemática de introducción (PLAN fase 1/3):
 * lo que corre ANTES del primer nivel — el Dr. Jekyll bebe su fórmula y se
 * transforma, con animación, en Mr. Hyde. Al terminar se pasa a la narrativa
 * del nivel 1 (`SceneKey.NARRATIVE` con `{ levelId }`).
 *
 * Arquitectura data-first (mismo espíritu que `config/narrative.ts`): TODO lo
 * testeable vive aquí, sin Phaser en runtime (jsdom no puede cargarlo) —
 * `IntroScene` solo consume estas tablas y funciones:
 *
 *  1. Máquina de ACTOS/BEATS: `INTRO_BEATS` es un array ORDENADO de pasos
 *     (`{ id, durationMs, caption }`). La escena entra al beat 0, y cada beat
 *     se auto-avanza al agotarse su duración O por tap en cualquier punto.
 *     Añadir un acto (fase 2: Hyde ve a la niña en el callejón) = añadir
 *     entradas a este array + su "player" en la escena. Nada más.
 *  2. Captions: `INTRO_CAPTIONS` (letreros tipo pergamino, español, tono 10+).
 *  3. Config de animación por beat: `INTRO_ENTRANCE` / `INTRO_DRINK` /
 *     `INTRO_TRANSFORMATION` (duraciones y parámetros de los tweens).
 *  4. Layout de la escena: `INTRO_SCENE_LAYOUT` (posiciones sobre 720×1280,
 *     profundidades, estilo del letrero — tipografía Crimson Text, SPEC §7.3).
 *  5. Destino: `INTRO_TARGET_LEVEL_ID` (nivel al que se llega tras la intro).
 *
 * NOTA de flujo: la intro SOLO se reproduce saliendo del menú (MENU → INTRO);
 * las aristas alternativas (quiz fallido → NARRATIVE) NO la reproducen.
 */

import { BASE_WIDTH } from './dimensions';
import { labGreen, potionPurple, textPrimary } from './palette';
import { TEXTURE_KEYS } from '../art/textures';
import type { HexColor } from './palette';

// ---- 1. Identidades de los beats (const-object, NO enum) ---------------------

/**
 * Ids de los beats del ACTO 1 (el laboratorio). La fase 2 (acto del callejón:
 * Hyde ve a la niña) añadirá sus ids AQUÍ — el `Record` de players de
 * `IntroScene` exige cubrir cada id, así que el compilador guía la ampliación.
 */
export const IntroBeatId = {
  /** Jekyll aparece en su laboratorio con el letrero de época. */
  Entrance: 'entrance',
  /** Levanta el frasco, bebe y queda la pausa dramática. */
  Drink: 'drink',
  /** La transformación: flash, sacudida, niebla y crossfade Jekyll → Hyde. */
  Transformation: 'transformation',
} as const;

export type IntroBeatId = (typeof IntroBeatId)[keyof typeof IntroBeatId];

// ---- 2. Captions (letreros visibles — pasan por content.test) ----------------

/** Letreros de la intro (español, tono 10+, coherentes con el lore del N1). */
export const INTRO_CAPTIONS = {
  /** Beat de entrada: época + lugar + qué está a punto de hacer. */
  entrance: 'Londres, 188X. En su laboratorio, el Dr. Jekyll termina su fórmula…',
  /** Beat de transformación: el remate del acto 1. */
  transformation: '…y deja de ser él.',
} as const;

/** Un beat de la máquina: duración y letrero del paso (datos puros). */
export interface IntroBeat {
  /** Identidad del paso (valor de `IntroBeatId`). */
  id: IntroBeatId;
  /**
   * Duración del beat en ms: al agotarse, la escena avanza al siguiente (o
   * cierra si es el último). Un tap adelanta el avance.
   */
  durationMs: number;
  /**
   * Letrero a mostrar al entrar al beat; '' = mantener el letrero anterior
   * (evita re-fade del mismo texto entre beats).
   */
  caption: string;
}

/**
 * Los beats del ACTO 1 en orden de reproducción. La escena arranca SIEMPRE
 * en el índice 0; el cierre (wipe de niebla → NARRATIVE) se dispara al
 * completarse el ÚLTIMO beat de la tabla — por eso añadir el acto 2 es solo
 * insertar beats aquí (antes o después de los existentes) + su player.
 */
export const INTRO_BEATS: readonly IntroBeat[] = [
  {
    id: IntroBeatId.Entrance,
    durationMs: 3000,
    caption: INTRO_CAPTIONS.entrance,
  },
  {
    id: IntroBeatId.Drink,
    durationMs: 3000,
    caption: '', // mantiene el letrero de la entrada
  },
  {
    id: IntroBeatId.Transformation,
    durationMs: 3900,
    caption: INTRO_CAPTIONS.transformation,
  },
];

/** Índice del siguiente beat; -1 si el actual es el último (cierra la intro). */
export function nextBeatIndex(index: number): number {
  if (index < 0 || index >= INTRO_BEATS.length - 1) {
    return -1;
  }
  return index + 1;
}

/** True si el índice apunta al ÚLTIMO beat (su fin dispara el cierre). */
export function isLastBeat(index: number): boolean {
  return nextBeatIndex(index) < 0 && index >= 0 && index < INTRO_BEATS.length;
}

// ---- 3. Config de animación por beat (los tweens viven en la escena) --------

/** Beat «Entrance»: aparición suave de Jekyll (fade + pop de escala). */
export const INTRO_ENTRANCE = {
  /** Duración del fade-in (ms). */
  fadeMs: 700,
  /** Escala inicial relativa a la base (pop con Back.easeOut hacia 1). */
  scaleFrom: 0.92,
} as const;

/**
 * Beat «Drink»: inclinación del sprite (el lado del frasco, la DERECHA de la
 * textura, sube con rotación antihoraria), mini-puff verde del trago y
 * pausa dramática antes del siguiente beat.
 */
export const INTRO_DRINK = {
  /** Rotación objetivo en rad (negativa = levanta el lado del frasco). */
  tiltRad: -0.32,
  /** Duración de la inclinación (ms). */
  tiltMs: 520,
  /** Pausa con el frasco en alto (ms) — el trago sugerido. */
  holdMs: 900,
  /** Duración de la vuelta a la posición recta (ms). */
  returnMs: 480,
  /** Puff que asciende del frasco a la boca (el trago). */
  gulp: { color: labGreen, scale: 0.35, durationMs: 420 },
} as const;

/**
 * Beat «Transformation»: el corazón de la cinemática. Secuencia orquestada
 * por la escena con estos parámetros: flash fullscreen → sacudida de cámara
 * + temblor del sprite → puffs de niebla teñida → crossfade Jekyll→Hyde con
 * pop de escala → halo púrpura que se disipa.
 */
export const INTRO_TRANSFORMATION = {
  /** Flash fullscreen (rectángulo del color, alfa 0 → pico → 0 en yoyo). */
  flash: { color: labGreen, peakAlpha: 0.8, durationMs: 460 },
  /** Sacudida de cámara (`camera.shake`). */
  shake: { durationMs: 520, intensity: 0.012 },
  /** Temblor del sprite de Jekyll (vaivén horizontal de poca amplitud). */
  tremble: { durationMs: 60, amplitudePx: 5, repeats: 4 },
  /** Puffs de niebla alrededor del personaje (anillo determinista). */
  puffs: {
    /** Presupuesto de niebla (SPEC §10.4 ≤ 30): puffs + slots del fondo. */
    count: 8,
    radiusPx: 150,
    scale: 1.1,
    durationMs: 760,
    staggerMs: 55,
    /** Tintes alternados de los puffs (resabio verde/púrpura de la poción). */
    tints: [labGreen, potionPurple],
  },
  /** Retardo del crossfade tras arrancar el flash (ms). */
  crossfadeDelayMs: 240,
  /** Duración del crossfade en espejo Jekyll→Hyde (ms). */
  crossfadeMs: 720,
  /** Pop de escala con el que Hyde «estalla» al materializarse. */
  pop: { fromFactor: 0.86, durationMs: 340 },
  /** Halo púrpura que se disipa tras revelar a Hyde. */
  halo: {
    color: potionPurple,
    startAlpha: 0.5,
    fromScale: 1.2,
    toScale: 2.6,
    durationMs: 950,
  },
} as const;

// ---- 4. Layout de la escena (sobre el lienzo base 720×1280) ------------------

/**
 * Composición de la escena: el fondo «lab» (`LORE_BACKGROUNDS.lab`: capas de
 * vapor + mesa + frascos) ocupa depths 0–7; los personajes pisan depth 8; el
 * letrero pergamino y la UI van encima; el flash de la transformación cubre
 * TODO lo de la escena (bajo la cortina del wipe, depth 1000).
 */
export const INTRO_SCENE_LAYOUT = {
  /** Centro y escala base de Jekyll/Hyde (delante de la mesa del laboratorio). */
  character: { x: BASE_WIDTH / 2, y: 660, scale: 1.7, depth: 8 },
  /** Velos de trocado de fondo (fase 2): entre los props (7) y los personajes (8). */
  backgroundVeilDepth: 7.5,
  /** Letrero pergamino inferior (estilo del panel narrativo, más compacto). */
  caption: {
    x: BASE_WIDTH / 2,
    y: 1120,
    panelWidth: 640,
    panelHeight: 150,
    depth: 10,
    fadeMs: 340,
    lineSpacing: 8,
    style: {
      fontFamily: '"Crimson Text", Georgia, serif',
      fontSize: 32,
      color: textPrimary,
      /** Ancho de wrap del letrero (panel − 2·padding ≈ 560 px). */
      wordWrapWidth: 560,
    },
  },
  /** Botón «Saltar» (misma esquina y estilo que `NARRATIVE_SKIP_BUTTON`). */
  skipButton: { x: BASE_WIDTH - 40 - 110, y: 96, depth: 12 },
  /** Profundidad del flash de la transformación (sobre toda la escena). */
  flashDepth: 30,
  /** Duración del velo de trocado de fondo (ms; solo fase 2 lo usa). */
  backgroundSwapMs: 320,
} as const;

// ---- 5. Destino --------------------------------------------------------------

/**
 * Nivel al que se llega al terminar (o saltar) la intro: el 1 — la narrativa
 * continúa EXACTAMENTE donde la intro deja la historia. (Que el id exista en
 * `LEVELS` lo garantiza el test de `intro.test.ts`.)
 */
export const INTRO_TARGET_LEVEL_ID = 1;

/** Claves de textura que consume la escena (referencia testeable). */
export const INTRO_TEXTURES = {
  jekyll: TEXTURE_KEYS.jekyll,
  hyde: TEXTURE_KEYS.hyde,
  puff: TEXTURE_KEYS.fogPuff,
  halo: TEXTURE_KEYS.fog,
  captionPanel: TEXTURE_KEYS.parchmentFrame,
} as const satisfies Record<string, string>;

/** Color de un tinte de puff según su índice (alternancia determinista). */
export function puffTintFor(index: number): HexColor {
  const tints = INTRO_TRANSFORMATION.puffs.tints;
  return tints[index % tints.length] as HexColor;
}

/**
 * DATOS + LÓGICA PURA del EPÍLOGO (Fase 4 — «sumar otra animación»): la
 * cinemática de cierre que se ve SOLO al ganar el NIVEL 3 (victoria final de
 * la obra), basada en la escena de cierre del comic (p. 63): Utterson, de
 * noche, en su estudio termina de leer la confesión («…que Dios me dé fuerza.
 * Firmado: Henry Jekyll.») — «Pobre Henry.» — y en la viñeta final la cara
 * GIGANTE de Hyde emerge de las sombras DETRÁS de él, con la cartela de
 * cierre: «Nadie sabrá nunca el secreto del extraño caso del Dr. Jekyll y el
 * Sr. Hyde». Amenaza SUGERIDA (mismo criterio del acto 2 de la intro, 10+):
 * Hyde queda SIEMPRE DETRÁS de Utterson (depth menor), sin brazo, sin
 * contacto y sin acercarse — solo crece y se alza alejándose hacia arriba.
 *
 * Arquitectura: MISMA máquina data-first que `config/intro.ts` — TODO lo
 * testeable vive aquí, sin Phaser en runtime (jsdom no puede cargarlo), y
 * `EpilogueScene` solo consume estas tablas y funciones:
 *
 *  1. Máquina de BEATS: `EPILOGUE_BEATS` (array ordenado
 *     `{ id, durationMs, caption }`); auto-avance por tiempo o por tap.
 *  2. Captions: `EPILOGUE_CAPTIONS` (letreros pergamino, español, 10+).
 *  3. Config de animación por beat: `EPILOGUE_STUDY` / `EPILOGUE_FOG` /
 *     `EPILOGUE_EMERGENCE` / `EPILOGUE_CLOSING`.
 *  4. Layout: `EPILOGUE_SCENE_LAYOUT` (720×1280) y fondo de estudio
 *     `EPILOGUE_BACKGROUND` (una `LoreBackgroundDef` compuesta SOLO con
 *     texturas existentes: niebla + escritorio = `lab-bench` teñido oscuro +
 *     manuscrito = `parchment-frame` en miniatura).
 *  5. Presupuesto de niebla: `epilogueFogSprites()` (SPEC §10.4 ≤ 30).
 *
 * Flujo: VICTORY (solo victoria FINAL, tras el quiz del último nivel) llega
 * aquí con «Volver al inicio» (`victoryExitTarget` en `sceneNav.ts`), y al
 * terminar (o saltar) el epílogo cierra hacia MENU con el wipe de niebla.
 */

import { BASE_WIDTH } from './dimensions';
import {
  buildings,
  fogFar,
  fogMid,
  fogNear,
  hydeSmoke,
  lampFire,
  nightBackground,
  parchmentDark,
  type HexColor,
} from './palette';
import { TEXTURE_KEYS } from '../art/textures';
import type { LoreBackgroundDef } from './narrative';

// ---- 1. Identidades de los beats (const-object, NO enum) ---------------------

/**
 * Ids de los beats del epílogo: el estudio de Utterson, la niebla que se
 * cuela, la aparición de Hyde DETRÁS y la cartela de cierre. El `Record` de
 * players de `EpilogueScene` exige cubrir cada id, así que el compilador
 * guía cualquier ampliación.
 */
export const EpilogueBeatId = {
  /** El estudio de Utterson de noche: la confesión llega a su final. */
  Study: 'study',
  /** La niebla crece alrededor del escritorio (velo + puffs). */
  Fog: 'fog',
  /** La cara de Hyde emerge de las sombras DETRÁS de Utterson (sin contacto). */
  Emergence: 'emergence',
  /** Cierre: cartela final del comic + pulso de flash tenue. */
  Closing: 'closing',
} as const;

export type EpilogueBeatId = (typeof EpilogueBeatId)[keyof typeof EpilogueBeatId];

// ---- 2. Captions (letreros visibles — pasan por content.test) ----------------

/** Letreros del epílogo (español, tono 10+, verbatim del comic donde toca). */
export const EPILOGUE_CAPTIONS = {
  /** Beat del estudio: sitúa lugar, momento y qué está leyendo. */
  study: 'De noche, en su estudio, Utterson termina de leer la confesión del doctor…',
  /** Beat de la niebla: la atmósfera se espesa alrededor del escritorio. */
  fog: 'La niebla se cuela bajo la puerta y abraza el escritorio…',
  /** Beat de la aparición: «Pobre Henry» (comic p. 63) + Hyde detrás, sin tocarlo. */
  emergence: '«Pobre Henry», susurra… y de las sombras, detrás de él, emerge la cara de Hyde.',
  /** Cartela de cierre: la viñeta final del comic, VERBATIM. */
  closing: 'Nadie sabrá nunca el secreto del extraño caso del Dr. Jekyll y el Sr. Hyde.',
} as const;

/** Un beat de la máquina: duración y letrero del paso (datos puros). */
export interface EpilogueBeat {
  /** Identidad del paso (valor de `EpilogueBeatId`). */
  id: EpilogueBeatId;
  /**
   * Duración del beat en ms: al agotarse, la escena avanza al siguiente (o
   * cierra hacia MENU si es el último). Un tap adelanta el avance.
   */
  durationMs: number;
  /** Letrero a mostrar al entrar al beat ('' = mantener el anterior). */
  caption: string;
}

/**
 * Los beats del epílogo en orden de reproducción. La escena arranca SIEMPRE
 * en el índice 0; el cierre (wipe de niebla → MENU) se dispara al
 * completarse el ÚLTIMO beat.
 */
export const EPILOGUE_BEATS: readonly EpilogueBeat[] = [
  {
    id: EpilogueBeatId.Study,
    durationMs: 3400,
    caption: EPILOGUE_CAPTIONS.study,
  },
  {
    id: EpilogueBeatId.Fog,
    durationMs: 3000,
    caption: EPILOGUE_CAPTIONS.fog,
  },
  {
    id: EpilogueBeatId.Emergence,
    durationMs: 3800,
    caption: EPILOGUE_CAPTIONS.emergence,
  },
  {
    id: EpilogueBeatId.Closing,
    durationMs: 3800,
    caption: EPILOGUE_CAPTIONS.closing,
  },
];

/** Índice del siguiente beat; -1 si el actual es el último (cierra el epílogo). */
export function nextEpilogueBeatIndex(index: number): number {
  if (index < 0 || index >= EPILOGUE_BEATS.length - 1) {
    return -1;
  }
  return index + 1;
}

/** True si el índice apunta al ÚLTIMO beat (su fin dispara el cierre). */
export function isLastEpilogueBeat(index: number): boolean {
  return nextEpilogueBeatIndex(index) < 0 && index >= 0 && index < EPILOGUE_BEATS.length;
}

// ---- 3. Config de animación por beat (los tweens viven en la escena) --------

/**
 * Beat «Study»: Utterson aparece junto al escritorio (fade + pop de escala,
 * como la entrada de Jekyll en la intro) con el manuscrito delante.
 */
export const EPILOGUE_STUDY = {
  /** Duración del fade-in (ms). */
  fadeMs: 700,
  /** Escala inicial relativa a la base (pop con Back.easeOut hacia 1). */
  scaleFrom: 0.92,
} as const;

/**
 * Beat «Fog»: la niebla crece alrededor del escritorio — velo de noche
 * teñido de niebla + puffs deterministas (cercana/media, como el cierre de
 * la intro).
 */
export const EPILOGUE_FOG = {
  /** Velo de niebla que espesa la escena (bajo el letrero). */
  veil: { color: fogNear, alpha: 0.22, durationMs: 1500 },
  /** Puffs de niebla creciendo por la escena (reparto determinista). */
  puffs: { count: 4, scale: 2.2, durationMs: 1400, staggerMs: 170 },
} as const;

/**
 * Beat «Emergence»: la cara GIGANTE de Hyde emerge de las sombras DETRÁS de
 * Utterson — depth MENOR que el del abogado (queda detrás), entra con fade,
 * CRECE hasta «gigante» y se ALZA hacia arriba (se aleja, jamás se acerca).
 * Puffs oscuros `hydeSmoke` serpentean alrededor, como la transformación.
 * Amenaza SUGERIDA: sin brazo, sin contacto, sin acercamiento.
 */
export const EPILOGUE_EMERGENCE = {
  /** Retardo de la aparición tras entrar al beat (ms) — la sombra tarda. */
  delayMs: 420,
  /** Duración del fade-in de la cara (ms). */
  fadeMs: 900,
  /** Escala inicial (relativa a la base del layout) al asomar. */
  scaleFrom: 1.0,
  /** Escala final: GIGANTE, muy por encima de Utterson en pantalla. */
  scaleTo: 2.4,
  /** Cuánto SE ALZA hacia arriba mientras emerge (px; se aleja de Utterson). */
  risePx: 90,
  /** Volutas de humo OSCURO (tinte `hydeSmoke`) que anuncian la aparición. */
  darkPuffs: {
    count: 4,
    color: hydeSmoke,
    scale: 1.15,
    durationMs: 1250,
    staggerMs: 190,
    /** Altura de la subida de cada voluta (px). */
    risePx: 240,
    /** Amplitud del mecido horizontal (serpenteo, px). */
    swayPx: 30,
    /** Alfa pico de cada voluta (densa pero sin tapar la escena). */
    peakAlpha: 0.6,
  },
} as const;

/**
 * Beat «Closing»: cartela final (verbatim del comic) + pulso de flash TENUE
 * (yoyo, como el flash de la transformación pero suave y frío-papel) y la
 * cara de Hyde queda DETRÁS con una respiración mínima (crece un pelín y
 * vuelve): presente, inquieta, sin jamás tocar a Utterson.
 */
export const EPILOGUE_CLOSING = {
  /** Flash tenue fullscreen: sube al pico y baja (yoyo). */
  flash: { color: fogMid, peakAlpha: 0.3, durationMs: 760 },
  /** Respiración de la cara: vaivén de escala alrededor de la pose final. */
  breathe: { scaleExtra: 0.05, cycleMs: 1600 },
  /** Velo extra de sombra (`hydeSmoke`) que cierra la escena a oscuras. */
  shadowVeil: { color: hydeSmoke, alpha: 0.3, durationMs: 1800 },
  /** Últimos puffs de niebla cruzando la escena (la niebla lo cubre todo). */
  puffs: { count: 4, scale: 2.4, durationMs: 1500, staggerMs: 200 },
} as const;

// ---- 4. Layout de la escena (sobre el lienzo base 720×1280) ------------------

/**
 * Composición: el fondo estudio (`EPILOGUE_BACKGROUND`: niebla + escritorio
 * + manuscrito) ocupa depths 0–7; Utterson pisa depth 8; la cara de Hyde
 * queda DETRÁS (7.6); el velo de niebla y el flash van por encima; el
 * letrero pergamino y la UI por encima de todo (estilo de la intro).
 */
export const EPILOGUE_SCENE_LAYOUT = {
  /** Utterson junto al escritorio, leyendo (personaje fijo del epílogo). */
  utterson: { x: 430, y: 640, scale: 1.55, depth: 8 },
  /**
   * La cara de Hyde: DETRÁS de Utterson (depth menor), arriba y a la
   * izquierda — asoma por encima de su hombro sin taparlo todo ni tocarlo.
   * La escala final (GIGANTE) la pone `EPILOGUE_EMERGENCE.scaleTo`.
   */
  hyde: { x: 330, y: 380, scale: 1.0, depth: 7.6 },
  /** Velo de niebla del beat «Fog» (sobre personajes, bajo el letrero). */
  fogVeilDepth: 9,
  /** Letrero pergamino inferior (identico al de la intro). */
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
      // Tinta sepia sobre el pergamino CLARO (mismo patrón que la intro).
      color: parchmentDark,
      /** Ancho de wrap del letrero (panel − 2·padding ≈ 560 px). */
      wordWrapWidth: 560,
    },
  },
  /** Botón «Saltar» (misma esquina y estilo que la intro / narrativa). */
  skipButton: { x: BASE_WIDTH - 40 - 110, y: 96, depth: 12 },
  /** Flechas de navegación al costado (mismo estilo y altura que la intro). */
  nav: {
    marginX: 52,
    y: 420,
    scale: 0.9,
    disabledAlpha: 0.28,
    pressedScale: 0.85,
    depth: 12,
  },
  /** Profundidad del flash del cierre (sobre toda la escena). */
  flashDepth: 30,
} as const;

// ---- 4b. Fondo del estudio (compuesto SOLO con texturas existentes) ----------

/**
 * El estudio de Utterson, de noche: interior oscuro con niebla lenta
 * (tintes apagados de paleta, sin los verdes/púrpuras del laboratorio),
 * el escritorio (textura `lab-bench` teñida de silueta oscura) y el
 * manuscrito (un `parchment-frame` en miniatura sobre el tablero). La
 * vela/lámpara del escritorio la responde la escena con un puff cálido
 * (`lampFire`) que titila — la ESCENA lo crea, no este fondo.
 */
export const EPILOGUE_BACKGROUND: LoreBackgroundDef = {
  backgroundColor: nightBackground,
  layers: [
    {
      // Bruma lejana fría: el borde del cuarto se pierde en la noche.
      key: TEXTURE_KEYS.fog,
      tint: fogFar,
      alpha: 0.14,
      depth: 1,
      drift: { speed: 0.1, amplitude: 26, phase: 0.4 },
      slots: [
        { x: 150, y: 260, scale: 3.4, phaseOffset: 0 },
        { x: 570, y: 200, scale: 3.2, phaseOffset: 1.1 },
      ],
    },
    {
      // Niebla media que rueda baja, tras el escritorio.
      key: TEXTURE_KEYS.fog,
      tint: fogMid,
      alpha: 0.12,
      depth: 3,
      drift: { speed: 0.22, amplitude: 40, phase: 1.9 },
      slots: [
        { x: 90, y: 600, scale: 3.5, phaseOffset: 0 },
        { x: 640, y: 560, scale: 3.3, phaseOffset: 1.1 },
      ],
    },
  ],
  props: [
    // Escritorio: la mesa del laboratorio teñida de silueta (mismo patrón
    // de tinte que los props narrativos; el brillo de la vela lo anima la escena).
    { key: TEXTURE_KEYS.labBench, x: BASE_WIDTH / 2, y: 700, scale: 1, alpha: 1, tint: buildings, depth: 6 },
    // El manuscrito de Jekyll: página pergamino en miniatura sobre el tablero.
    { key: TEXTURE_KEYS.parchmentFrame, x: 360, y: 640, scale: 0.24, alpha: 0.95, depth: 7 },
  ],
} as const satisfies LoreBackgroundDef;

// ---- 5. Texturas y presupuesto -----------------------------------------------

/** Claves de textura que consume la escena (referencia testeable). */
export const EPILOGUE_TEXTURES = {
  utterson: TEXTURE_KEYS.utterson,
  hyde: TEXTURE_KEYS.hyde,
  puff: TEXTURE_KEYS.fogPuff,
  captionPanel: TEXTURE_KEYS.parchmentFrame,
  arrow: TEXTURE_KEYS.arrow,
} as const satisfies Record<string, string>;

/** Color de la vela del escritorio (el glow cálido que titila la escena). */
export const EPILOGUE_CANDLE = {
  color: lampFire,
  /** Posición RELATIVA al manuscrito (px sobre el lienzo, el puff encima). */
  offsetX: 0,
  offsetY: -46,
  scale: 0.85,
  alpha: 0.28,
} as const;

/** Color de un tinte de puff de niebla del cierre (alternancia determinista). */
export function fogPuffTintFor(index: number): HexColor {
  return index % 2 === 0 ? fogNear : fogMid;
}

/**
 * Presupuesto de niebla del EPÍLOGO (SPEC §10.4 ≤ 30): TODOS los sprites de
 * niebla transitorios que los players pueden crear en un paseo completo + el
 * glow de la vela, para sumar a los slots del fondo del estudio.
 */
export function epilogueFogSprites(): number {
  return (
    EPILOGUE_FOG.puffs.count +
    EPILOGUE_EMERGENCE.darkPuffs.count +
    EPILOGUE_CLOSING.puffs.count +
    1 // el resplandor de la vela (permanente, creado en create())
  );
}

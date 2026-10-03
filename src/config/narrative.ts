/**
 * DATOS + LÓGICA PURA de la fase narrativa (PLAN Etapa 3 / SPEC §4.1, §6, §9).
 *
 * Arquitectura exigida por el plan: TODO lo testeable vive aquí, sin Phaser
 * en runtime (jsdom no puede cargarlo) — `NarrativeScene` y `ui/Panel` solo
 * consumen estas tablas y funciones:
 *
 *  1. Nivel activo: `activeLevelFor` (scene-start data `{ levelId? }`).
 *  2. Máquina de progresión de paneles: `narrativeProgress` (reducer puro,
 *     estado `{index,total,done}`, acciones tap/skip, índice SIEMPRE acotado).
 *  3. Marcado de énfasis: `parseLoreSegments` (parser de `**negritas**` del
 *     texto de lore — el panel 4 de SPEC §4.1 lleva la instrucción en negrita).
 *  4. Layout del panel: `NARRATIVE_PANEL_LAYOUT` + `panelTextLayout` (wrapper
 *     de palabras SIN Phaser: garantiza que ningún texto desborda el pergamino).
 *  5. Composición de escena + botón «Saltar» + estilos (dimensiones 720×1280,
 *     contraste SPEC §9, táctil ≥ 64 px).
 *  6. Fondos por viñeta: `LORE_BACKGROUNDS` (qué capas/texturas/colores usa
 *     cada `LoreBackground`, con props estáticos para el laboratorio).
 */

import type { ButtonLayout } from '../ui/buttonState';
import type { HexColor } from './palette';
import {
  labGreen,
  lampFire,
  nightBackground,
  parchmentDark,
  parchmentLight,
  potionPurple,
  street,
  textPrimary,
} from './palette';
import { TEXTURE_KEYS } from '../art/textures';
import {
  ALLEY_PARALLAX_LAYERS,
  LAB_PARALLAX_LAYERS,
  STREET_PARALLAX_LAYERS,
  type ParallaxLayer,
} from '../art/parallax';
import { BASE_WIDTH } from './dimensions';
import { LEVELS, getLevel } from './levels';
import type { LevelConfig, LoreBackground } from './levels/types';

// ---- 1. Nivel activo ---------------------------------------------------------

/**
 * Nivel que debe renderizar `NarrativeScene`: el pedido por `levelId`, el 1
 * por defecto, y si el id no está registrado cae al PRIMER nivel del registro
 * (degrada con gracia en vez de romper; los niños nunca ven un error).
 */
export function activeLevelFor(levelId?: number): LevelConfig {
  return getLevel(levelId ?? 1) ?? LEVELS[0];
}

// ---- 2. Máquina de progresión de paneles (reducer puro) ----------------------

/** Acciones del jugador sobre la viñeta (const-object, NO enum). */
export const NarrativeAction = {
  /** Tap en la escena: avanza al siguiente panel (o termina en el último). */
  Tap: 'tap',
  /** Botón «Saltar»: termina la narrativa inmediatamente. */
  Skip: 'skip',
} as const;

export type NarrativeAction = (typeof NarrativeAction)[keyof typeof NarrativeAction];

/** Estado de la progresión por paneles (invariante: 0 ≤ index < max(1,total)). */
export interface NarrativeProgressState {
  /** Índice del panel actual (0-based). Queda congelado al terminar. */
  index: number;
  /** Total de paneles del nivel (≥ 1). */
  total: number;
  /** True cuando la narrativa terminó (tap en el último panel o «Saltar»). */
  done: boolean;
}

/** Estado inicial para `total` paneles (clampa totales inválidos a 1). */
export function initialNarrativeState(total: number): NarrativeProgressState {
  return { index: 0, total: Math.max(1, Math.floor(total)), done: false };
}

/**
 * Reducer puro de la progresión:
 *
 *  - `skip` → `done: true` inmediato (el índice NO se toca: el indicador
 *    muestra el panel por el que iba).
 *  - `tap` avanza una viñeta; un tap EN EL ÚLTIMO panel termina (`done`).
 *  - Con `done: true` toda acción es idempotente (devuelve el mismo estado).
 *  - El índice NUNCA sale de [0, total-1]: no hay «más allá del último».
 */
export function narrativeProgress(
  state: NarrativeProgressState,
  action: NarrativeAction,
): NarrativeProgressState {
  if (state.done) {
    return state;
  }
  if (action === NarrativeAction.Skip) {
    return { ...state, done: true };
  }
  if (state.index >= state.total - 1) {
    // Tap sobre el último panel: la viñeta termina (índice congelado en el
    // último, para que el indicador muestre «4/4»).
    return { ...state, done: true };
  }
  return { ...state, index: state.index + 1 };
}

/** Etiqueta del indicador de progreso: «1/4» … «4/4» (SPEC §6). */
export function progressLabel(state: NarrativeProgressState): string {
  return `${Math.min(state.index, state.total - 1) + 1}/${state.total}`;
}

// ---- 3. Marcado de énfasis (**negritas**) ------------------------------------

/** Un tramo de texto de lore: plano o enfatizado (negrita/énfasis visual). */
export interface LoreSegment {
  text: string;
  /** True si el tramo estaba entre `**…**` (énfasis, p. ej. la instrucción). */
  bold: boolean;
}

/**
 * Parser de `**negritas**`: parte el texto por el marcador `**`; los tramos
 * en posición impar son énfasis. Tolerante: un marcador sin cerrar convierte
 * el resto en énfasis; sin marcadores devuelve un único tramo plano. Nunca
 * devuelve array vacío.
 */
export function parseLoreSegments(text: string): readonly LoreSegment[] {
  const segments: LoreSegment[] = [];
  const parts = text.split('**');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length === 0) continue;
    segments.push({ text: parts[i], bold: i % 2 === 1 });
  }
  if (segments.length === 0) {
    segments.push({ text: '', bold: false });
  }
  return segments;
}

/** El texto plano (sin marcadores): lo que debe caber en el panel. */
export function stripLoreMarkers(text: string): string {
  return parseLoreSegments(text)
    .map((segment) => segment.text)
    .join('');
}

// ---- 4. Layout del panel (wrap SIN Phaser) -----------------------------------

/** Config de layout del panel narrativo (datos, coherentes con 720×1280). */
export interface NarrativePanelLayout {
  /** Ancho del pergamino (px). */
  panelWidth: number;
  /** Alto del pergamino (px). */
  panelHeight: number;
  /** Margen horizontal del pergamino respecto a los bordes del lienzo. */
  marginX: number;
  /** Padding interior del pergamino (≥ 44: estándar táctil, SPEC §9). */
  padding: number;
  /** Tamaño de fuente del cuerpo (≥ 32: legible infantil, SPEC §9). */
  fontSize: number;
  /** Alto de línea (px): interlineado para lectura cómoda. */
  lineHeightPx: number;
  /**
   * Ancho medio estimado de carácter como fracción del tamaño de fuente
   * (Crimson Text ≈ 0.52 em para texto español en minúscula).
   */
  charWidthFactor: number;
  /**
   * Margen de seguridad del wrap (×): la estimación es MÁS ancha que la
   * fuente real, así las líneas calculadas nunca desbordan al renderizar.
   */
  wrapSafetyFactor: number;
}

/**
 * Layout por defecto: pergamino 640×480 (40 px de margen en 720 de ancho),
 * padding 48, cuerpo Crimson Text 34 px con interlineado 48. El texto de los
 * 4 paneles reales del Nivel 1 cabe con holgura (ver tests).
 */
export const NARRATIVE_PANEL_LAYOUT: NarrativePanelLayout = {
  panelWidth: 640,
  panelHeight: 480,
  marginX: 40,
  padding: 48,
  fontSize: 34,
  lineHeightPx: 48,
  charWidthFactor: 0.52,
  wrapSafetyFactor: 1.1,
};

/** Ancho del área de texto dentro del pergamino (panelWidth − 2·padding). */
export function panelTextWidth(layout: NarrativePanelLayout): number {
  return layout.panelWidth - 2 * layout.padding;
}

/** Máximo de líneas que caben en el alto del pergamino. */
export function panelMaxLines(layout: NarrativePanelLayout): number {
  return Math.floor(panelTextHeight(layout) / layout.lineHeightPx);
}

/** Alto del área de texto dentro del pergamino (panelHeight − 2·padding). */
export function panelTextHeight(layout: NarrativePanelLayout): number {
  return layout.panelHeight - 2 * layout.padding;
}

/** Una palabra del lore con su bandera de énfasis (heredada del segmento). */
export interface LoreWord {
  text: string;
  bold: boolean;
}

/** Una línea ya wrappeada: palabras que caben juntas en el ancho del área. */
export interface WrappedLine {
  words: readonly LoreWord[];
}

/** Resultado del layout: líneas listas para renderizar + veredicto de ajuste. */
export interface PanelTextLayout {
  lines: readonly WrappedLine[];
  lineCount: number;
  /** Alto estimado del bloque (lineCount · lineHeightPx). */
  textHeightPx: number;
  /** Ancho estimado de la línea más larga (px). */
  widestLinePx: number;
  /** ¿Cabe TODO el texto en el panel (líneas y anchos)? */
  fits: boolean;
}

/** Tokeniza el texto en palabras conservando el flag de énfasis. */
function loreWords(text: string): readonly LoreWord[] {
  const words: LoreWord[] = [];
  for (const segment of parseLoreSegments(text)) {
    for (const word of segment.text.split(/\s+/)) {
      if (word.length > 0) {
        words.push({ text: word, bold: segment.bold });
      }
    }
  }
  return words;
}

/** Ancho estimado (px) de una palabra/espacio según el layout. */
function estimateWidth(charCount: number, layout: NarrativePanelLayout): number {
  return (
    charCount * layout.fontSize * layout.charWidthFactor * layout.wrapSafetyFactor
  );
}

/**
 * Wrapper de palabras puro (greedy): calcula las líneas del texto contra el
 * ancho del área del pergamino con una métrica ESTIMADA y conservadora
 * (charWidthFactor · wrapSafetyFactor por carácter). `fits` es el detector de
 * desborde: false si se necesitan más líneas de las que caben o si una única
 * palabra es más ancha que el área.
 *
 * Como la estimación sobreestima el ancho real de la fuente, si `fits` es
 * true aquí, el render con la fuente verdadera también cabe.
 */
export function panelTextLayout(
  text: string,
  layout: NarrativePanelLayout = NARRATIVE_PANEL_LAYOUT,
): PanelTextLayout {
  const maxWidth = panelTextWidth(layout);
  const spacePx = estimateWidth(1, layout);
  const lines: LoreWord[][] = [];
  let current: LoreWord[] = [];
  let currentPx = 0;

  for (const word of loreWords(text)) {
    const wordPx = estimateWidth(word.text.length, layout);
    if (current.length > 0 && currentPx + spacePx + wordPx > maxWidth) {
      lines.push(current);
      current = [];
      currentPx = 0;
    }
    currentPx += (current.length === 0 ? 0 : spacePx) + wordPx;
    current.push(word);
  }
  if (current.length > 0) {
    lines.push(current);
  }
  // Texto vacío: una línea vacía (el panel se muestra sin contenido).
  if (lines.length === 0) {
    lines.push([]);
  }

  const widestLinePx = lines.reduce((widest, line) => {
    const linePx = line.reduce(
      (sum, word, index) => sum + estimateWidth(word.text.length, layout) + (index > 0 ? spacePx : 0),
      0,
    );
    return Math.max(widest, linePx);
  }, 0);

  return {
    lines: lines.map((words) => ({ words })),
    lineCount: lines.length,
    textHeightPx: lines.length * layout.lineHeightPx,
    widestLinePx,
    fits: lines.length <= panelMaxLines(layout) && widestLinePx <= maxWidth,
  };
}

// ---- 5. Composición de escena, estilos y botón «Saltar» ----------------------

/** Estilo visual del pergamino oscuro (marco reutilizable de `ui/Panel`). */
export const NARRATIVE_PANEL_STYLE = {
  /** Superficie: pergamino OSCURO (SPEC §6 «pergamino», contraste §9). */
  fill: parchmentDark,
  /** Borde doble sepia claro (SPEC §7.2). */
  stroke: parchmentLight,
  cornerRadius: 20,
  borderWidth: 7,
} as const;

/** Estilo del texto de los paneles (tipografía SPEC §7.3, contraste §9). */
export const NARRATIVE_TEXT_STYLE = {
  /** Cuerpo: Crimson Text (bloques largos, SPEC §7.3) con fallback serif. */
  fontFamily: '"Crimson Text", Georgia, serif',
  /** Texto principal de la paleta sobre el pergamino oscuro. */
  color: textPrimary,
  /** Énfasis (**negritas**): fuego de farola — cálido, contrastado, paleta. */
  emphasisColor: lampFire,
} as const;

/** Layout compacto del botón «Saltar» (esquina, táctil ≥ 64 px, SPEC §9). */
export const NARRATIVE_SKIP_BUTTON: { label: string; layout: ButtonLayout } = {
  label: 'Saltar',
  layout: {
    minWidth: 220,
    height: 72,
    cornerRadius: 14,
    paddingX: 24,
    fontSize: 30,
    fontFamily: '"Special Elite", Georgia, serif',
    states: {
      idle: { fill: parchmentDark, stroke: parchmentLight, text: textPrimary },
      hover: { fill: labGreen, stroke: parchmentLight, text: textPrimary },
      pressed: { fill: potionPurple, stroke: parchmentLight, text: textPrimary },
    },
  },
};

/** Composición de la escena narrativa sobre el lienzo base 720×1280. */
export const NARRATIVE_SCENE_LAYOUT = {
  /** Centro del panel de texto (mitad inferior: el fondo respira arriba). */
  panelCenter: { x: BASE_WIDTH / 2, y: 950 },
  /** Centro del botón «Saltar» (esquina superior derecha, margen 40). */
  skipButton: { x: BASE_WIDTH - 40 - 110, y: 96 },
  /** Ancla izquierda del indicador de progreso (esquina superior izquierda). */
  progress: { x: 56, y: 96 },
  /** Profundidades: fondo (capas 0–5 + props 6–8) < panel < UI. */
  depths: { panel: 10, ui: 12, propStart: 6 },
  /** Timing de los crossfades de avance (feedback sutil, ms). */
  // Etapa 7 (pulido): 110/200/280 → 130/240/320 — crossfades un pelín más
  // largos para que el cambio de viñeta se lea sin parpadeo (ritmo infantil).
  fade: { contentOutMs: 130, contentInMs: 240, backgroundMs: 320 },
  /** Tipografía del indicador «1/4». */
  progressStyle: {
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 30,
    color: textPrimary,
  },
} as const;

// ---- 6. Fondos por viñeta ----------------------------------------------------

/** Un elemento estático del fondo (se dibuja ENCIMA de las capas). */
export interface LorePropSlot {
  /** Clave de textura (valor de `TEXTURE_KEYS`). */
  key: string;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  /** Tinte multiplicativo (paleta) para variantes de color de la textura. */
  tint?: HexColor;
  /** Profundidad de pintado (por encima de las capas de niebla). */
  depth: number;
  /** Si true, la escena pulsa su alfa (brillo de poción). */
  glow?: boolean;
}

/** Suelo/calle del fondo (banda de adoquines bajo la línea de calle). */
export interface LoreGround {
  color: HexColor;
  /** Y donde empieza la banda de suelo (hasta el borde inferior). */
  y: number;
}

/** Qué pinta `NarrativeScene` de fondo para cada `LoreBackground`. */
export interface LoreBackgroundDef {
  /** Color base del cielo. */
  backgroundColor: HexColor;
  /** Capas con deriva (niebla, siluetas, farolas — `art/parallax`). */
  layers: readonly ParallaxLayer[];
  /** Banda de suelo (solo exteriores; el laboratorio se apoya en la mesa). */
  ground?: LoreGround;
  /** Elementos estáticos encima de las capas (mesa, frascos…). */
  props: readonly LorePropSlot[];
}

/**
 * Tabla de fondos por viñeta (SPEC §4.1 + §7.2): la mitad inferior la tapa
 * el panel de texto, así que calle/farolas/mesa se componen en la banda
 * superior (~0–700 px). El laboratorio usa la mesa + frascos teñidos
 * (verde poción / púrpura polvos) con brillo pulsante.
 */
export const LORE_BACKGROUNDS: Readonly<Record<LoreBackground, LoreBackgroundDef>> = {
  street: {
    backgroundColor: nightBackground,
    layers: STREET_PARALLAX_LAYERS,
    ground: { color: street, y: 700 },
    props: [],
  },
  alley: {
    backgroundColor: nightBackground,
    layers: ALLEY_PARALLAX_LAYERS,
    ground: { color: street, y: 690 },
    props: [],
  },
  lab: {
    backgroundColor: nightBackground,
    layers: LAB_PARALLAX_LAYERS,
    props: [
      // Mesa del laboratorio: apoya en la banda visible sobre el panel.
      { key: TEXTURE_KEYS.labBench, x: BASE_WIDTH / 2, y: 610, scale: 1, alpha: 1, depth: 6 },
      // Frascos sobre el tablero (y≈520–556): verdes y púrpuras, con brillo.
      { key: TEXTURE_KEYS.labFlask, x: 205, y: 463, scale: 1.2, alpha: 0.95, tint: labGreen, depth: 7, glow: true },
      { key: TEXTURE_KEYS.labFlask, x: 305, y: 476, scale: 1, alpha: 0.95, tint: potionPurple, depth: 7, glow: true },
      { key: TEXTURE_KEYS.labFlask, x: 465, y: 454, scale: 1.35, alpha: 0.95, tint: potionPurple, depth: 7, glow: true },
      { key: TEXTURE_KEYS.labFlask, x: 585, y: 482, scale: 0.9, alpha: 0.95, tint: labGreen, depth: 7, glow: true },
    ],
  },
};

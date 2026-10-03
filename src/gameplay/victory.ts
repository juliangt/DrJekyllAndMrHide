/**
 * VICTORIA (PLAN Etapa 6 / SPEC §5, §6, §7.1, §11): DATOS + LÓGICA PURA de la
 * pantalla de victoria — `VictoryScene` es una capa fina que consume este
 * módulo (misma arquitectura que quizState para el quiz: jsdom no puede
 * cargar Phaser, así que TODO lo testeable vive aquí, sin Phaser en runtime).
 *
 *  1. Desglose de puntaje: `buildScoreBreakdown({taps, quiz, bonus})` recibe
 *     los PUNTOS acumulados por categoría (los que devuelve
 *     `ScoreSystem.getBreakdown()`) y produce las líneas del desglose
 *     («taps + quiz + bonus», SPEC §6) con el total VERIFICADO (la suma de
 *     las líneas ES el total devuelto). El máximo teórico del Nivel 1 es
 *     ~214 (SPEC §5): 30 de taps + 100 del quiz + hasta 84 de bonus.
 *  2. Récord: `recordLabel(current, previous)` compara el total de la tanda
 *     con el `lastScore` guardado ANTES de `markLevelComplete` — estrictamente
 *     mayor → «¡Nuevo récord!»; iguala o no lo supera → «Récord: N» (en la
 *     iguala N ES el total actual, marcado como récord según SPEC §11).
 *     `isNewRecord` expone el booleano para el color de la línea.
 *  3. Nombre del diploma: `sanitizeName` (trim, colapso de espacios, máx.
 *     20, fallback «Valiente lector/a») y `diplomaText(name, total)` con
 *     estructura FIJA de líneas (saltos \n manuales, cada línea cabe en el
 *     ancho interno): el nombre SIEMPRE cae en la línea `NAME_LINE_INDEX`,
 *     así la escena sabe exactamente dónde anclar la zona de firma y el
 *     input DOM que la edita.
 *  4. `VICTORY_LAYOUT`: composición de la pantalla contra 720×1280 — diploma
 *     pergamino CLARO (reutiliza `ui/Modal`), placa del desglose, sello de
 *     cera púrpura, botones ≥ 64 px (SPEC §9), colores de paleta y depths.
 *     `victoryNameZone` deriva de él el rectángulo (coords de juego) que la
 *     escena mapea a CSS con `canvasPointToCss` (ui/nameField).
 *
 * Sin import de Phaser.
 */

import { BASE_WIDTH } from '../config/dimensions';
import type { HexColor } from '../config/palette';
import {
  fogNear,
  labGreen,
  lampFire,
  nightBackground,
  parchmentDark,
  parchmentLight,
  potionPurple,
  success,
  textPrimary,
} from '../config/palette';
import { TEXTURE_KEYS } from '../art/textures';
import { TAP_POINTS } from './scoring';
import type { ButtonLayout } from '../ui/buttonState';
import { ButtonVisualState } from '../ui/buttonState';

// ---- 1. Desglose de puntaje (SPEC §5/§6) -------------------------------------

/** Una línea del desglose mostrada en el diploma. */
export interface ScoreBreakdownLine {
  /** Rótulo en español (p. ej. «Sustos a la niña (3 × 10)»). */
  label: string;
  /** Puntos de la categoría (≥ 0). */
  value: number;
}

/** Desglose listo para renderizar: líneas + total verificado. */
export interface ScoreBreakdownView {
  /** Tres líneas fijas: taps, quiz y bonus de tiempo (SPEC §6). */
  lines: readonly ScoreBreakdownLine[];
  /** Total de la tanda: SIEMPRE la suma de las líneas (verificado). */
  total: number;
}

/** Entrada de `buildScoreBreakdown`: puntos acumulados POR CATEGORÍA. */
export interface ScoreBreakdownInput {
  /** Puntos de taps (los «taps» de `ScoreSystem.getBreakdown()`). */
  taps: number;
  /** Puntos del quiz (0 o 100 — todo o nada, D5/D7). */
  quiz: number;
  /** Puntos del bonus de tiempo (2 × segundos restantes). */
  bonus: number;
}

/** Puntos sanos: entero finito ≥ 0; cualquier otra cosa → 0. */
function sanitizePoints(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Rótulo de la línea de taps: «Sustos a la niña (3 × 10)» cuando cierra. */
function tapsLabel(points: number): string {
  if (points > 0 && points % TAP_POINTS === 0) {
    return `Sustos a la niña (${points / TAP_POINTS} × ${TAP_POINTS})`;
  }
  return 'Sustos a la niña';
}

/**
 * Desglose del puntaje final (SPEC §6 «puntaje final desglosado»): tres
 * líneas fijas (taps + quiz + bonus) y el total como SUMA VERIFICADA de
 * esas líneas. Las entradas no finitas o negativas se tratan como 0 (el
 * ScoreSystem nunca acumula basura, pero el módulo puro es defensivo).
 */
export function buildScoreBreakdown(input: ScoreBreakdownInput): ScoreBreakdownView {
  const taps = sanitizePoints(input.taps);
  const quiz = sanitizePoints(input.quiz);
  const bonus = sanitizePoints(input.bonus);
  const lines: readonly ScoreBreakdownLine[] = [
    { label: tapsLabel(taps), value: taps },
    { label: 'Quiz del libro', value: quiz },
    { label: 'Bonus de tiempo', value: bonus },
  ];
  return { lines, total: taps + quiz + bonus };
}

// ---- 2. Récord (SPEC §11) ------------------------------------------------------

/**
 * ¿El total actual SUPERa el récord previo? (La iguala no es «nuevo» récord,
 * pero sí se muestra marcada como récord — ver `recordLabel`.)
 */
export function isNewRecord(current: number, previous: number): boolean {
  return sanitizePoints(current) > sanitizePoints(previous);
}

/**
 * Rótulo del récord para el diploma: `current > previous` → «¡Nuevo récord!»;
 * en cualquier otro caso (iguala o no llega) → «Récord: N», donde N es el
 * récord vigente (en la iguala, el propio total: marcado como récord, SPEC
 * §11). Entradas basura se tratan como 0.
 */
export function recordLabel(current: number, previous: number): string {
  const safeCurrent = sanitizePoints(current);
  const safePrevious = sanitizePoints(previous);
  if (safeCurrent > safePrevious) {
    return '¡Nuevo récord!';
  }
  return `Récord: ${Math.max(safeCurrent, safePrevious)}`;
}

// ---- 3. Nombre y texto del diploma ---------------------------------------------

/** Longitud máxima del nombre firmado en el diploma. */
export const NAME_MAX_LENGTH = 20;

/** Nombre por defecto cuando el jugador no firma (opcional, SPEC §6). */
export const DEFAULT_READER_NAME = 'Valiente lector/a';

/**
 * Normaliza el nombre firmado: colapsa espacios, recorta a 20 caracteres y
 * cae al fallback «Valiente lector/a» si queda vacío. Caracteres raros no
 * rompen: se renderiza en un `Phaser.Text` (no HTML), así que solo se
 * limpia el espacio en blanco — el resto pasa tal cual.
 */
export function sanitizeName(raw: string): string {
  const cleaned = (typeof raw === 'string' ? raw : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : DEFAULT_READER_NAME;
}

/** Partes del diploma: intro fija, línea del NOMBRE y cuerpo fijo. */
export interface DiplomaParts {
  /** Línea 1 (fija): «Se otorga el presente diploma a». */
  top: string;
  /** Línea 2: el nombre (siempre presente — sanitizeName trae fallback). */
  name: string;
  /** Resto del cuerpo (fijo, con el total interpolado). */
  bottom: string;
}

/** Línea (0-based) del diploma donde vive el NOMBRE. */
export const NAME_LINE_INDEX = 1;

/** Nº total de líneas del diploma (1 intro + 1 nombre + 4 cuerpo). */
export const DIPLOMA_LINE_COUNT = 6;

/**
 * Partes del diploma con estructura FIJA (la escena compone la vista con
 * ellas para poder anclar la zona de firma a la línea del nombre).
 * `diplomaText` es su unión con '\n'.
 */
export function diplomaParts(name: string, total: number): DiplomaParts {
  return {
    top: 'Se otorga el presente diploma a',
    name: sanitizeName(name),
    bottom: [
      'por haber leído El extraño caso',
      'del Dr. Jekyll y Mr. Hyde, de',
      'R. L. Stevenson, y demostrarlo',
      `con ${sanitizePoints(total)} puntos ante la niebla.`,
    ].join('\n'),
  };
}

/**
 * Texto completo del diploma (con o sin nombre): el nombre cae SIEMPRE en
 * la línea `NAME_LINE_INDEX` (los saltos son manuales y cada línea cabe en
 * el ancho interno del diploma con la métrica conservadora de la paleta).
 */
export function diplomaText(name: string, total: number): string {
  const parts = diplomaParts(name, total);
  return `${parts.top}\n${parts.name}\n${parts.bottom}`;
}

// ---- 4. DATOS de composición (720×1280, SPEC §6/§7.1/§9) -----------------------

/** Estilo del marco del diploma (pergamino CLARO, reutiliza `ui/Modal`). */
export const VICTORY_PANEL_STYLE = {
  fill: parchmentLight,
  stroke: parchmentDark,
  cornerRadius: 24,
  borderWidth: 8,
} as const;

/** Layout de los botones «Jugar de nuevo» / «Volver al inicio» (≥ 64 px). */
export const VICTORY_BUTTON: ButtonLayout = {
  minWidth: 460,
  height: 76,
  cornerRadius: 18,
  paddingX: 32,
  fontSize: 30,
  fontFamily: '"Special Elite", Georgia, serif',
  states: {
    [ButtonVisualState.Idle]: { fill: parchmentDark, stroke: parchmentLight, text: textPrimary },
    [ButtonVisualState.Hover]: { fill: labGreen, stroke: parchmentLight, text: textPrimary },
    [ButtonVisualState.Pressed]: { fill: potionPurple, stroke: parchmentLight, text: textPrimary },
  },
};

/** Etiquetas de la pantalla de victoria (español, tono amable 10+). */
export const VICTORY_LABELS = {
  heading: '¡Victoria!',
  playAgain: 'Jugar de nuevo',
  backToMenu: 'Volver al inicio',
  namePlaceholder: 'Tu nombre',
  nameHint: 'Toca tu nombre en el diploma para firmarlo',
  breakdownTotal: 'Total',
} as const;

/** Composición de la pantalla de victoria sobre el lienzo base (datos). */
export const VICTORY_LAYOUT = {
  /** Velo suave: el diploma flota sobre el callejón atenuado. */
  veil: { color: nightBackground as HexColor, alpha: 0.55 },
  /** Diploma pergamino claro centrado (SPEC §6, estilo carta del quiz). */
  panel: {
    centerX: BASE_WIDTH / 2,
    centerY: 620,
    width: 648,
    height: 800,
    padding: 44,
  },
  /** Titular celebratorio (UnifrakturCook, SPEC §7.3). */
  heading: {
    text: VICTORY_LABELS.heading,
    centerY: 296,
    fontSize: 56,
    fontFamily: 'UnifrakturCook, Georgia, serif',
    color: potionPurple,
  },
  /** Cuerpo del diploma (diplomaText: 6 líneas fijas, nombre en la 2ª). */
  body: {
    topY: 352,
    fontSize: 28,
    lineHeightPx: 40,
    fontFamily: '"Crimson Text", Georgia, serif',
    color: parchmentDark,
    nameLineIndex: NAME_LINE_INDEX,
  },
  /** Zona de firma sobre la línea del nombre (coords de juego). */
  nameZone: {
    /** Ancho de la zona interactiva y del subrayado (px de juego). */
    width: 320,
    /** Alto de la zona (cubre la línea completa del nombre). */
    height: 46,
  },
  /** Input DOM de firma (el mapeo a CSS lo hace ui/nameField). */
  nameInput: {
    placeholder: VICTORY_LABELS.namePlaceholder,
    maxLength: NAME_MAX_LENGTH,
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 28,
    /** Tinta sobre el pergamino (mismo color que el cuerpo). */
    color: parchmentDark,
    /** Fondo OPACO del pergamino: cubre la línea mientras se edita. */
    backgroundColor: parchmentLight,
  },
  /** Subrayado bajo el nombre (invita a firmar). */
  underline: {
    /** Longitud y grosor del trazo (px de juego). */
    width: 280,
    height: 2,
    /** Offset bajo el centro de la línea del nombre. */
    offsetY: 24,
    color: parchmentDark,
    alpha: 0.45,
  },
  /** Pista de firma al pie del diploma (tenue, no estorba). */
  hint: {
    text: VICTORY_LABELS.nameHint,
    centerY: 992,
    fontSize: 20,
    fontFamily: '"Special Elite", Georgia, serif',
    color: fogNear,
  },
  /** Placa del desglose (inset oscuro, patrón placa del quiz). */
  plaque: {
    fill: parchmentDark,
    stroke: parchmentLight,
    strokeAlpha: 0.35,
    cornerRadius: 12,
    topY: 636,
    paddingX: 24,
    paddingY: 16,
    /** Alto de cada fila del desglose (4: taps, quiz, bonus, total). */
    rowHeightPx: 34,
    /** Ancho de la placa (px, centrada en el diploma). */
    width: 560,
  },
  /** Tipos/colores de las filas del desglose (Special Elite, tinta clara). */
  breakdown: {
    fontSize: 26,
    fontFamily: '"Special Elite", Georgia, serif',
    labelColor: parchmentLight,
    valueColor: textPrimary,
    /** El Total destaca en fuego de farola (paleta, SPEC §7.1). */
    totalColor: lampFire,
    /** Separador fino sobre la fila del total. */
    separatorColor: parchmentLight,
    separatorAlpha: 0.35,
  },
  /** Línea del récord, bajo la placa (verde success si es nuevo). */
  record: {
    centerY: 850,
    fontSize: 26,
    fontFamily: '"Special Elite", Georgia, serif',
    newRecordColor: success,
    color: textPrimary,
  },
  /** Sello de cera púrpura (textura nueva de la Etapa 6). */
  seal: {
    textureKey: TEXTURE_KEYS.waxSeal,
    centerX: 575,
    centerY: 928,
    size: 132,
    rotationRad: 0.12,
  },
  /** Botones de cierre (centrados, apilados bajo el diploma). */
  buttons: {
    playAgainCenterY: 1092,
    menuCenterY: 1188,
  },
  /** Profundidades: velo < diploma < contenido < sello < UI. */
  depths: { veil: 20, panel: 30, content: 32, seal: 34, ui: 36 },
  /** Fade-in del contenido al entrar. */
  fadeInMs: 500,
} as const;

export type VictoryLayout = typeof VICTORY_LAYOUT;

/**
 * Rectángulo (coords de juego 720×1280) de la ZONA DE FIRMA: centro de la
 * línea del nombre derivado del layout. El `Phaser.Text` del cuerpo usa
 * `lineSpacing = lineHeightPx − fontSize`, así que la línea `i` (0-based)
 * ocupa `topY + i·lineHeightPx … + fontSize` y su centro es
 * `topY + i·lineHeightPx + fontSize/2`. La escena vuelve la zona
 * interactiva y la mapea a CSS con `canvasPointToCss` (ui/nameField).
 */
export function victoryNameZone(
  layout: VictoryLayout = VICTORY_LAYOUT,
): { centerX: number; centerY: number; width: number; height: number } {
  const { body, nameZone, panel } = layout;
  return {
    centerX: panel.centerX,
    centerY:
      body.topY +
      body.nameLineIndex * body.lineHeightPx +
      body.fontSize / 2,
    width: nameZone.width,
    height: nameZone.height,
  };
}

/** Centro Y absoluto de la fila `index` del desglose dentro de la placa. */
export function breakdownRowCenterY(index: number, layout: VictoryLayout = VICTORY_LAYOUT): number {
  return layout.plaque.topY + layout.plaque.paddingY + (index + 0.5) * layout.plaque.rowHeightPx;
}

/** Alto total de la placa del desglose (padding + 4 filas). */
export function breakdownPlaqueHeight(layout: VictoryLayout = VICTORY_LAYOUT): number {
  return 2 * layout.plaque.paddingY + 4 * layout.plaque.rowHeightPx;
}

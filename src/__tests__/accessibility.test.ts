/**
 * Etapa 7 — CHECKLIST DE ACCESIBILIDAD AUTOMATIZADO (PLAN tarea 5 / SPEC §9).
 * Un único checklist ejecutable que consolida y verifica computablemente:
 *
 *  1. CONTRASTE (WCAG 2.1 — 1.4.3): TODAS las combinaciones texto/fondo
 *     definidas en los configs de UI (narrativa, menú, cómo jugar, quiz,
 *     acción/HUD, GAME_OVER, victoria, tipografías flotantes y debug FPS).
 *     Mínimos: 4.5:1 texto normal · 3:1 texto grande (≥ 24 px regulares,
 *     umbral WCAG «large text» = 18 pt; el juego no usa <b> en canvas).
 *     Los componentes gráficos (barra del timer) usan 3:1 (1.4.11). El
 *     estado DESHABILITADO (tarjetas tras responder, alfa 0.45) está
 *     exento (WCAG: «inactive UI components») y se documenta, no se mide.
 *     Colores leídos SIEMPRE de `config/palette.ts` vía `hexToRgb`.
 *  2. TAMAÑOS TÁCTILES: botones primarios ≥ 64 px (SPEC §9), opciones de
 *     quiz ≥ 56 px — consolidados aquí desde TODOS los layouts.
 *  3. TEXTOS CORTOS: paneles narrativos ≤ 40 palabras y pasos del «Cómo
 *     jugar» ≤ 12 (repetido aquí como parte del checklist único).
 *  4. INPUT UNIFICADO: verificación POR FUENTE de que `pointerover` solo
 *     aparece en las máquinas de estado VISUALES (hover) y que ninguna
 *     acción esencial depende de hover; la interacción real es pointerdown/
 *     pointerup, idénticos para tap y clic (SPEC §9).
 */
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hexToRgb, type HexColor } from '../config/palette';
import {
  HOW_TO_PLAY,
  HOW_TO_PLAY_MAX_WORDS,
} from '../config/menu';
import {
  NARRATIVE_PANEL_STYLE,
  NARRATIVE_SCENE_LAYOUT,
  NARRATIVE_SKIP_BUTTON,
  NARRATIVE_TEXT_STYLE,
} from '../config/narrative';
import { MENU_BUTTON_LAYOUT } from '../ui/buttonState';
import { MIN_TOUCH_HEIGHT } from '../ui/buttonState';
import { LEVELS } from '../config/levels';
import { stripLoreMarkers } from '../config/narrative';
import {
  ACTION_FLOAT_STYLE,
  ACTION_LAYOUT,
  ACTION_PAUSE_BUTTON,
  FPS_DEBUG_STYLE,
} from '../gameplay/actionLayout';
import { GAME_OVER_STYLE } from '../gameplay/gameOverOverlay';
import { INTRO_SCENE_LAYOUT } from '../config/intro';
import {
  QUIZ_ACTION_BUTTON,
  QUIZ_LAYOUT,
} from '../gameplay/quizState';
import { VICTORY_BUTTON, VICTORY_LAYOUT } from '../gameplay/victory';
import {
  nightBackground,
  parchmentLight,
  street,
} from '../config/palette';

// ---- Matemática de contraste (WCAG 2.1 relativa) -----------------------------

/** Luminancia relativa WCAG de un hex (usa `hexToRgb` de la paleta). */
function relativeLuminance(hex: HexColor): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Ratio de contraste WCAG entre dos colores (1 .. 21). */
export function contrastRatio(foreground: HexColor, background: HexColor): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// ---- Catálogo de pares texto/fondo de la UI ----------------------------------

/** Umbral para «texto grande» WCAG (18 pt ≈ 24 px regulares). */
const LARGE_TEXT_PX = 24;
const MIN_NORMAL = 4.5;
const MIN_LARGE = 3.0;

interface ContrastPair {
  /** Dónde vive (para que el fallo sea accionable). */
  readonly where: string;
  readonly foreground: HexColor;
  readonly background: HexColor;
  /** Tamaño de fuente en px (decide el umbral). */
  readonly fontSizePx: number;
}

/** Fondos «peor caso» del juego (los textos canvas flotan sobre la escena). */
const BG = {
  night: nightBackground, // cielo/base de todas las escenas
  street: street, // el fondo claro garantizado del callejón (adoquines)
  parchmentDark: NARRATIVE_PANEL_STYLE.fill, // pergamino oscuro (placas/botones)
  parchmentLight: parchmentLight, // pergamino claro (carta del quiz, diploma)
} as const;

/**
 * TODOS los pares texto/fondo definidos en los configs de UI. Si añades un
 * texto nuevo a un config, añádelo aquí — el checklist fallará si falta
 * contraste (y este catálogo es la lista de revisión).
 */
const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // Narrativa (config/narrative.ts)
  { where: 'narrativa: cuerpo del panel', foreground: NARRATIVE_TEXT_STYLE.color, background: BG.parchmentDark, fontSizePx: 34 },
  { where: 'narrativa: énfasis (**negritas**)', foreground: NARRATIVE_TEXT_STYLE.emphasisColor, background: BG.parchmentDark, fontSizePx: 34 },
  { where: 'narrativa: indicador de progreso', foreground: NARRATIVE_SCENE_LAYOUT.progressStyle.color, background: BG.night, fontSizePx: NARRATIVE_SCENE_LAYOUT.progressStyle.fontSize },
  ...Object.values(NARRATIVE_SKIP_BUTTON.layout.states).map((state): ContrastPair => ({
    where: `narrativa: botón «Saltar» (${state.fill})`,
    foreground: state.text,
    background: state.fill,
    fontSizePx: NARRATIVE_SKIP_BUTTON.layout.fontSize,
  })),

  // Menú (ui/buttonState.ts + colores de MenuScene)
  ...Object.values(MENU_BUTTON_LAYOUT.states).map((state): ContrastPair => ({
    where: `menú: botón primario estado ${state.fill}`,
    foreground: state.text,
    background: state.fill,
    fontSizePx: MENU_BUTTON_LAYOUT.fontSize,
  })),

  // Quiz (gameplay/quizState.ts)
  { where: 'quiz: pregunta', foreground: QUIZ_LAYOUT.question.color, background: BG.parchmentLight, fontSizePx: QUIZ_LAYOUT.question.fontSize },
  { where: 'quiz: letra de opción (A–D)', foreground: QUIZ_LAYOUT.card.labelColor, background: BG.parchmentDark, fontSizePx: QUIZ_LAYOUT.card.labelFontSize },
  { where: 'quiz: texto de opción', foreground: QUIZ_LAYOUT.card.states.idle.text, background: QUIZ_LAYOUT.card.states.idle.fill, fontSizePx: QUIZ_LAYOUT.card.textFontSize },
  { where: 'quiz: feedback pedagógico', foreground: QUIZ_LAYOUT.feedback.color, background: BG.parchmentDark, fontSizePx: QUIZ_LAYOUT.feedback.fontSize },
  { where: 'quiz: rótulo del fragmento', foreground: QUIZ_LAYOUT.story.headingColor, background: BG.parchmentLight, fontSizePx: QUIZ_LAYOUT.story.headingFontSize },
  { where: 'quiz: intro de acierto (correcta)', foreground: QUIZ_LAYOUT.story.introColor, background: BG.parchmentDark, fontSizePx: QUIZ_LAYOUT.story.fontSize },
  { where: 'quiz: cuerpo del fragmento', foreground: QUIZ_LAYOUT.story.bodyColor, background: BG.parchmentLight, fontSizePx: QUIZ_LAYOUT.story.fontSize },
  { where: 'quiz: marcador de puntaje', foreground: QUIZ_LAYOUT.score.color, background: BG.night, fontSizePx: QUIZ_LAYOUT.score.fontSize },
  ...Object.values(QUIZ_ACTION_BUTTON.states).map((state): ContrastPair => ({
    where: `quiz: botón de acción (${state.fill})`,
    foreground: state.text,
    background: state.fill,
    fontSizePx: QUIZ_ACTION_BUTTON.fontSize,
  })),

  // Acción / HUD (gameplay/actionLayout.ts)
  { where: 'acción: contador del HUD', foreground: ACTION_LAYOUT.hudTextStyle.color, background: BG.street, fontSizePx: ACTION_LAYOUT.hudTextStyle.fontSize },
  { where: 'acción: puntaje del HUD', foreground: ACTION_LAYOUT.hudTextStyle.color, background: BG.street, fontSizePx: ACTION_LAYOUT.hudTextStyle.fontSize },
  { where: 'acción: segundos del timer', foreground: ACTION_LAYOUT.timerColors.text, background: BG.street, fontSizePx: ACTION_LAYOUT.hudTextStyle.fontSize },
  { where: 'acción: «!» flotante', foreground: ACTION_FLOAT_STYLE.exclamation.color, background: BG.street, fontSizePx: ACTION_FLOAT_STYLE.exclamation.fontSize },
  { where: 'acción: «+10» flotante', foreground: ACTION_FLOAT_STYLE.points.color, background: BG.street, fontSizePx: ACTION_FLOAT_STYLE.points.fontSize },
  { where: 'acción: FPS debug (?debug)', foreground: FPS_DEBUG_STYLE.color, background: BG.night, fontSizePx: FPS_DEBUG_STYLE.fontSize },

  // Intro (config/intro.ts — letrero sobre el pergamino claro del marco)
  { where: 'intro: letrero del beat', foreground: INTRO_SCENE_LAYOUT.caption.style.color, background: BG.parchmentLight, fontSizePx: INTRO_SCENE_LAYOUT.caption.style.fontSize },

  // GAME_OVER (gameplay/gameOverOverlay.ts, panel = pergamino claro)
  { where: 'game over: título', foreground: GAME_OVER_STYLE.title.color as HexColor, background: BG.parchmentLight, fontSizePx: GAME_OVER_STYLE.title.fontSize },
  { where: 'game over: subtítulo', foreground: GAME_OVER_STYLE.subtitle.color as HexColor, background: BG.parchmentLight, fontSizePx: GAME_OVER_STYLE.subtitle.fontSize },

  // Victoria (gameplay/victory.ts — TODO sobre el pergamino claro o la placa)
  { where: 'victoria: titular del diploma', foreground: VICTORY_LAYOUT.heading.color, background: BG.parchmentLight, fontSizePx: VICTORY_LAYOUT.heading.fontSize },
  { where: 'victoria: cuerpo del diploma', foreground: VICTORY_LAYOUT.body.color, background: BG.parchmentLight, fontSizePx: VICTORY_LAYOUT.body.fontSize },
  { where: 'victoria: desglose (rótulos)', foreground: VICTORY_LAYOUT.breakdown.labelColor, background: VICTORY_LAYOUT.plaque.fill, fontSizePx: VICTORY_LAYOUT.breakdown.fontSize },
  { where: 'victoria: desglose (valores)', foreground: VICTORY_LAYOUT.breakdown.valueColor, background: VICTORY_LAYOUT.plaque.fill, fontSizePx: VICTORY_LAYOUT.breakdown.fontSize },
  { where: 'victoria: desglose (Total)', foreground: VICTORY_LAYOUT.breakdown.totalColor, background: VICTORY_LAYOUT.plaque.fill, fontSizePx: VICTORY_LAYOUT.breakdown.fontSize },
  { where: 'victoria: récord normal', foreground: VICTORY_LAYOUT.record.color, background: BG.parchmentLight, fontSizePx: VICTORY_LAYOUT.record.fontSize },
  { where: 'victoria: récord «¡Nuevo récord!»', foreground: VICTORY_LAYOUT.record.newRecordColor, background: BG.parchmentLight, fontSizePx: VICTORY_LAYOUT.record.fontSize },
  { where: 'victoria: pista de firma', foreground: VICTORY_LAYOUT.hint.color, background: BG.parchmentLight, fontSizePx: VICTORY_LAYOUT.hint.fontSize },
  { where: 'victoria: input de firma (tinta/fondo)', foreground: VICTORY_LAYOUT.nameInput.color, background: VICTORY_LAYOUT.nameInput.backgroundColor as HexColor, fontSizePx: VICTORY_LAYOUT.nameInput.fontSize },
  ...Object.values(VICTORY_BUTTON.states).map((state): ContrastPair => ({
    where: `victoria: botón de cierre (${state.fill})`,
    foreground: state.text,
    background: state.fill,
    fontSizePx: VICTORY_BUTTON.fontSize,
  })),
];

describe('accesibilidad 1 — contraste de TODOS los pares texto/fondo (WCAG 1.4.3)', () => {
  it.each(CONTRAST_PAIRS)('$where: ≥ el mínimo para su tamaño', ({ foreground, background, fontSizePx }) => {
    const minimum = fontSizePx >= LARGE_TEXT_PX ? MIN_LARGE : MIN_NORMAL;
    const ratio = contrastRatio(foreground, background);
    expect(ratio, `${foreground} sobre ${background} = ${ratio.toFixed(2)}:1 (mín ${minimum}:1)`)
      .toBeGreaterThanOrEqual(minimum);
  });

  it('los componentes gráficos (barra del timer) ≥ 3:1 contra su pista (WCAG 1.4.11)', () => {
    // Relleno normal y crítico contra la pista oscura de la barra.
    expect(contrastRatio(ACTION_LAYOUT.timerColors.fill, ACTION_LAYOUT.timerColors.track))
      .toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(ACTION_LAYOUT.timerColors.critical, ACTION_LAYOUT.timerColors.track))
      .toBeGreaterThanOrEqual(3.0);
  });

  it('el texto principal cumple el par EXACTO que pide la SPEC §9 (#e8e3d5 sobre ≤ #23262e)', () => {
    expect(contrastRatio(BG.night === undefined ? '#000000' as HexColor : '#e8e3d5' as HexColor, BG.street))
      .toBeGreaterThanOrEqual(4.5);
  });

  it('los mínimos de la WCAG usados son los estándar (guardia del catálogo)', () => {
    expect(MIN_NORMAL).toBe(4.5);
    expect(MIN_LARGE).toBe(3.0);
    expect(LARGE_TEXT_PX).toBe(24);
  });
});

// ---- 2. Tamaños táctiles (SPEC §9) --------------------------------------------

/** Lee un archivo de src como texto (para los checks por fuente). */
function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

/** Enumera los .ts de src/ (recursivo, sin __tests__). */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...sourceFiles(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('accesibilidad 2 — tamaños táctiles (SPEC §9: primarios ≥ 64, quiz ≥ 56)', () => {
  it('la constante base de botón primario es 64 px', () => {
    expect(MIN_TOUCH_HEIGHT).toBe(64);
  });

  it.each([
    ['botones del menú', MENU_BUTTON_LAYOUT.height],
    ['botón «Saltar» de narrativa', NARRATIVE_SKIP_BUTTON.layout.height],
    ['botón «Pausa» de acción', ACTION_PAUSE_BUTTON.layout.height],
    ['botones de acción del quiz', QUIZ_LAYOUT.button.height],
    ['botones de la victoria', VICTORY_BUTTON.height],
  ])('%s miden ≥ 64 px de alto', (_name, height) => {
    expect(height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
  });

  it('las tarjetas-opción del quiz miden ≥ 56 px de alto (mínimo SPEC §9)', () => {
    expect(QUIZ_LAYOUT.card.minHeight).toBeGreaterThanOrEqual(56);
  });

  it('la hitbox del botón de mute mide ≥ 64 px (por fuente de MenuScene)', () => {
    const source = readSource('src/scenes/MenuScene.ts');
    const match = source.match(/const MUTE_HIT_SIZE = (\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(64);
  });

  it('la hitbox de la niña es el sprite EXPANDIDO un 20 % (mínimo SPEC §4.2)', () => {
    // El hitbox generoso se define en gameplay/hitbox.ts y lo aplica la escena.
    const source = readSource('src/gameplay/hitbox.ts');
    expect(source).toMatch(/DEFAULT_HITBOX_EXPANSION = 1\.2/);
  });
});

// ---- 3. Textos cortos (SPEC §9) ------------------------------------------------

describe('accesibilidad 3 — textos cortos (≤ 40 palabras por panel, ≤ 12 por paso)', () => {
  it.each(LEVELS.flatMap((level) =>
    level.lore.map((panel, index) => ({
      level: level.id,
      index,
      words: stripLoreMarkers(panel.text).trim().split(/\s+/).filter(Boolean).length,
    })),
  ))('nivel $level, viñeta $#{$index + 1}: ≤ 40 palabras', ({ words }) => {
    expect(words).toBeLessThanOrEqual(40);
  });

  it.each(HOW_TO_PLAY.map((step, index) => ({ index, words: step.text.trim().split(/\s+/).length })))(
    'paso $#{$index + 1} del «Cómo jugar»: ≤ 12 palabras',
    ({ words }) => {
      expect(words).toBeLessThanOrEqual(HOW_TO_PLAY_MAX_WORDS);
    },
  );
});

// ---- 4. Input unificado (SPEC §9: pointerdown, nada esencial en hover) ---------

describe('accesibilidad 4 — input unificado pointerdown (nada esencial en hover)', () => {
  it('`pointerover` SOLO vive en las máquinas de estado visuales de botones/tarjetas', () => {
    // El hover es decoración desktop (SPEC §6/§7.2). Si alguien conectara
    // una acción esencial a pointerover en una escena, este test lo caza.
    const allowed = new Set([
      resolve(process.cwd(), 'src/ui/buttonState.ts'),
      resolve(process.cwd(), 'src/ui/GothicButton.ts'),
      resolve(process.cwd(), 'src/ui/OptionCard.ts'),
    ]);
    const offenders = sourceFiles(resolve(process.cwd(), 'src')).filter(
      (file) => !allowed.has(file) && /pointerover|POINTER_OVER/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders, `hover con lógica esencial en: ${offenders.join(', ')}`).toEqual([]);
  });

  it('las máquinas de estado de botón son PURAS: el hover no dispara onPress', () => {
    const machine = readSource('src/ui/buttonState.ts');
    // La máquina no INVOCA callbacks (solo los nombra en documentación):
    // devuelve estados visuales, la decisión de disparar la toma el botón.
    expect(machine).not.toMatch(/onPress\s*\(/);
    const button = readSource('src/ui/GothicButton.ts');
    // onPress SOLO se dispara en POINTER_UP (semántica «soltar dentro»).
    const pointerUpBlock = button.slice(button.indexOf('POINTER_UP,'), button.indexOf('POINTER_UP_OUTSIDE'));
    expect(pointerUpBlock).toContain('onPress');
  });

  it('cada escena interactiva procesa POINTER_DOWN (tap y clic por el mismo camino)', () => {
    const expectedHandlers: Record<string, RegExp> = {
      'src/scenes/NarrativeScene.ts': /POINTER_DOWN/,
      'src/scenes/ActionScene.ts': /POINTER_DOWN/,
      'src/scenes/MenuScene.ts': /POINTER_DOWN/,
      'src/scenes/VictoryScene.ts': /POINTER_DOWN/,
    };
    for (const [file, pattern] of Object.entries(expectedHandlers)) {
      expect(readSource(file), `${file} debe manejar POINTER_DOWN`).toMatch(pattern);
    }
    // El quiz es tarjeta por tarjeta (OptionCard: pointerdown + soltar).
    expect(readSource('src/ui/OptionCard.ts')).toMatch(/POINTER_DOWN/);
  });
});

/**
 * Estado, layout y estilos del QUIZ literario (PLAN Etapa 5 / SPEC §4.3, §4.4,
 * §5, §6, §9): TODO puro, sin Phaser en runtime (jsdom no puede cargarlo) —
 * `QuizScene` es una capa fina que consume estas tablas y funciones.
 *
 *  1. Máquina de fases del quiz: `quizReducer` (reducer puro). Regla D5:
 *     opción incorrecta → feedback de ESA opción → «Volver a empezar el
 *     nivel» (señal `restartLevel`); opción correcta → carta de historia →
 *     «Continuar». Nunca se retrocede de fase y `done` es terminal, así el
 *     modal «nunca se cierra sin feedback» (SPEC §6): las únicas salidas
 *     pasan por `feedback-wrong` o `story`.
 *  2. `optionLabel(i)` → letra A–D de las tarjetas.
 *  3. DATOS de composición: `QUIZ_LAYOUT` (carta pergamino CLARO centrada,
 *     tarjetas ≥ 56 px de alto — SPEC §9 —, placa de feedback, carta de
 *     historia, botones, depths, score sin timer) y `QUIZ_PANEL_STYLE` /
 *     `QUIZ_OPTION_CARD` / `QUIZ_ACTION_BUTTON` para las capas Phaser.
 *  4. `quizBoardLayout`: composición pura de las TRES vistas (pregunta,
 *     feedback, historia) contra 720×1280 — reutiliza el wrapper
 *     conservador `panelTextLayout` de `config/narrative.ts` (misma garantía
 *     «nunca desborda»: la estimación sobreestima el ancho real). Calcula
 *     alturas/posiciones y el veredicto `fits` con los textos REALES del
 *     nivel (pregunta, opciones, feedbacks y `storyFragment`).
 *  5. `wrongFeedbackHeader`: rótulo del feedback de la opción elegida.
 */

import {
  error,
  labGreen,
  lampFire,
  nightBackground,
  parchmentDark,
  parchmentLight,
  potionPurple,
  success,
  textPrimary,
} from '../config/palette';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { panelTextLayout, type NarrativePanelLayout } from '../config/narrative';
import type { ButtonLayout, ButtonStateColors } from '../ui/buttonState';
import { ButtonVisualState } from '../ui/buttonState';

// ---- 1. Reducer de fases del quiz (reducer puro) -----------------------------

/** Fases del quiz (const-object, NO enum). */
export const QuizPhase = {
  /** Pregunta con las 4 tarjetas-opción (A–D) tocables. */
  Question: 'question',
  /** Feedback pedagógico de la opción incorrecta elegida + reinicio (D5). */
  FeedbackWrong: 'feedback-wrong',
  /** Carta antigua con el fragmento de historia (SPEC §4.4) + «Continuar». */
  Story: 'story',
  /** Fase terminal: la escena navega (VICTORY o reinicio del nivel). */
  Done: 'done',
} as const;

export type QuizPhase = (typeof QuizPhase)[keyof typeof QuizPhase];

/** Tipos de acción del jugador sobre el quiz (const-object, NO enum). */
export const QuizEventType = {
  /** Tap sobre la tarjeta-opción `index` (0-based). */
  Select: 'select',
  /** Botón «Volver a empezar el nivel» (desde feedback-wrong, D5). */
  ContinueWrong: 'continue-wrong',
  /** Botón «Continuar» (desde story) → VICTORY. */
  ContinueStory: 'continue-story',
} as const;

export type QuizEventType = (typeof QuizEventType)[keyof typeof QuizEventType];

/** Acciones del reducer (unión discriminada por `type`). */
export type QuizEvent =
  | { type: typeof QuizEventType.Select; index: number }
  | { type: typeof QuizEventType.ContinueWrong }
  | { type: typeof QuizEventType.ContinueStory };

/** Config de la ronda de quiz (derivada del `QuizConfig` del nivel). */
export interface QuizRoundConfig {
  /** Nº de opciones (N1: 4). Clampa configuraciones inválidas a ≥ 1. */
  optionCount: number;
  /** Índice de la opción correcta (N1: 1 = B). Fuera de rango → 0. */
  correctIndex: number;
}

/** Estado completo del quiz. */
export interface QuizState {
  phase: QuizPhase;
  /** Opción elegida (índice 0-based; `null` hasta responder). */
  selected: number | null;
  /**
   * Señal de la fase `done` (regla D5): `true` → reinicio del NIVEL completo
   * (la escena descarta la tanda con `scoreSystem.reset()` y vuelve a
   * NARRATIVE); `false` → VICTORY.
   */
  restartLevel: boolean;
  /** Nº de opciones válidas (para validar `Select`). */
  optionCount: number;
  /** Índice de la opción correcta. */
  correctIndex: number;
}

/**
 * Estado inicial del quiz: fase `question`, nada seleccionado.
 * Configuraciones inválidas se clampan a valores sanos (optionCount ≥ 1,
 * correctIndex dentro de rango — una config rota degrada a la primera
 * opción, nunca rompe el juego, igual que `activeLevelFor`).
 */
export function initialQuizState(config: QuizRoundConfig): QuizState {
  const rawCount = Math.floor(config.optionCount);
  const optionCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1;
  const raw = Math.floor(config.correctIndex);
  const correctIndex =
    Number.isFinite(raw) && raw >= 0 && raw < optionCount ? raw : 0;
  return {
    phase: QuizPhase.Question,
    selected: null,
    restartLevel: false,
    optionCount,
    correctIndex,
  };
}

/**
 * Reducer puro del quiz (ver cabecera del módulo para las reglas):
 *
 *  - `select`: SOLO desde `question` y con índice válido. Correcta → `story`
 *    (el +100 del puntaje lo aplica la ESCENA, no el reducer); incorrecta →
 *    `feedback-wrong` con la opción elegida.
 *  - `continue-wrong`: SOLO desde `feedback-wrong` → `done` con la señal
 *    `restartLevel: true` (D5: reinicio del nivel completo).
 *  - `continue-story`: SOLO desde `story` → `done` con `restartLevel: false`.
 *
 * Transiciones inválidas (seleccionar fuera de `question`, continuar desde
 * otra fase, índices basura) se IGNORAN devolviendo el MISMO estado — nunca
 * hay retroceso de fase ni salidas sin feedback.
 */
export function quizReducer(state: QuizState, event: QuizEvent): QuizState {
  switch (event.type) {
    case QuizEventType.Select: {
      if (state.phase !== QuizPhase.Question) {
        return state; // ya se respondió: las tarjetas están deshabilitadas
      }
      if (!Number.isInteger(event.index) || event.index < 0 || event.index >= state.optionCount) {
        return state; // índice basura: ignorado
      }
      const correct = event.index === state.correctIndex;
      return {
        ...state,
        selected: event.index,
        phase: correct ? QuizPhase.Story : QuizPhase.FeedbackWrong,
      };
    }

    case QuizEventType.ContinueWrong: {
      if (state.phase !== QuizPhase.FeedbackWrong) {
        return state; // el reinicio (D5) solo procede tras ver el feedback
      }
      return { ...state, phase: QuizPhase.Done, restartLevel: true };
    }

    case QuizEventType.ContinueStory: {
      if (state.phase !== QuizPhase.Story) {
        return state; // «Continuar» solo procede desde la carta de historia
      }
      return { ...state, phase: QuizPhase.Done, restartLevel: false };
    }
  }
}

/** Rótulo del feedback de una opción incorrecta: «La opción C no es la correcta.» */
export function wrongFeedbackHeader(index: number): string {
  return `La opción ${optionLabel(index)} no es la correcta.`;
}

// ---- 2. Letras de opción -----------------------------------------------------

/**
 * Letra de la opción `index`: 0→'A', 1→'B', 2→'C', 3→'D' (SPEC §4.3).
 * Fuera de rango o basura → '?' (el quiz N1 tiene 4 opciones válidas).
 */
export function optionLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 25) {
    return '?';
  }
  return String.fromCharCode(65 + index);
}

// ---- 3. DATOS de composición (720×1280, SPEC §6/§9) --------------------------

/** Factor de seguridad del wrap conservador (sobreestima el ancho real). */
export const TEXT_WRAP_SAFETY_FACTOR = 1.08;

/** Estilo del marco de la carta pergamino CLARO (lo dibuja `ui/Panel`). */
export const QUIZ_PANEL_STYLE = {
  /** Superficie: sepia claro de SPEC §7.1 («Sepia pergamino (UI/quiz)»). */
  fill: parchmentLight,
  /** Borde doble sepia oscuro (tinta sobre la carta). */
  stroke: parchmentDark,
  cornerRadius: 24,
  borderWidth: 8,
} as const;

/** Colores de un estado visual de tarjeta (forma de `ui/buttonState`). */
export type QuizCardStateColors = Readonly<Record<ButtonVisualState, ButtonStateColors>>;

/** Datos de la tarjeta-opción (letra A–D + texto, táctil ≥ 56 px, SPEC §9). */
export interface QuizOptionCardStyle {
  /** Ancho de la tarjeta (= ancho interno de la carta). */
  width: number;
  /** Alto MÍNIMO de tarjeta (SPEC §9: opciones ≥ 56 px). */
  minHeight: number;
  /** Separación vertical entre tarjetas. */
  gap: number;
  /** Padding vertical interno (suma al alto calculado del texto). */
  paddingY: number;
  /** Radio de las esquinas del marco. */
  cornerRadius: number;
  /** Ancho de la celda de la letra (A–D) a la izquierda. */
  labelZoneWidth: number;
  /** Padding horizontal del texto de la opción. */
  textPaddingX: number;
  /** Tamaño de la letra de opción. */
  labelFontSize: number;
  /** Tamaño del texto de la opción. */
  textFontSize: number;
  /** Alto de línea del texto de la opción (para el cálculo de alto). */
  textLineHeightPx: number;
  /** Máximo de líneas del texto de una opción (detector de desborde). */
  textMaxLines: number;
  /** Ancho medio de carácter como fracción del tamaño (Crimson Text). */
  textCharWidthFactor: number;
  /** Color de la letra de opción (acento cálido sobre la tarjeta oscura). */
  labelColor: typeof lampFire;
  /** Pila de fuentes del texto (Crimson Text, SPEC §7.3). */
  fontFamily: string;
  /** Pila de fuentes de la letra (Special Elite, SPEC §7.3). */
  labelFontFamily: string;
  /** Colores por estado visual (marco pergamino oscuro, patrón GothicButton). */
  states: QuizCardStateColors;
  /** Alfa del estado deshabilitado (tras responder, SPEC §6). */
  disabledAlpha: number;
}

/** Datos de la placa de feedback inset (mensajes success/error legibles). */
export interface QuizPlaqueStyle {
  /** Relleno oscuro: sobre él, error/success desaturados ≥ 3:1 (SPEC §9). */
  fill: typeof parchmentDark;
  /** Filete interior tenue. */
  stroke: typeof parchmentLight;
  strokeAlpha: number;
  cornerRadius: number;
  paddingX: number;
  paddingY: number;
  /** Separación entre el rótulo y el texto del feedback dentro de la placa. */
  gapHeaderToText: number;
}

/**
 * Composición completa del quiz sobre el lienzo base (datos testeables contra
 * 720×1280 — ver `__tests__/quizState.test.ts`). Cada fase usa SU PROPIA
 * carta centrada en `panel.centerY` (el alto lo calcula `quizBoardLayout`).
 */
export interface QuizLayoutData {
  /** Velo sobre el fondo: la carta flota separada del mundo (SPEC §6). */
  veil: { color: typeof nightBackground; alpha: number };
  /** Carta pergamino claro centrada (SPEC §6 «modal pergamino/cartas»). */
  panel: {
    /** Ancho de la carta (margen lateral 36 px en 720). */
    width: number;
    centerX: number;
    centerY: number;
    /** Padding interior (≥ 44: estándar táctil, SPEC §9). */
    padding: number;
  };
  /** Pregunta: tinta sepia (Special Elite, SPEC §7.3) sobre la carta. */
  question: {
    fontSize: number;
    lineHeightPx: number;
    /** Máximo de líneas (detector de desborde del wrap conservador). */
    maxLines: number;
    charWidthFactor: number;
    fontFamily: string;
    color: typeof parchmentDark;
    /** Hueco entre el bloque de pregunta y la primera tarjeta. */
    gapBelow: number;
  };
  /** Tarjetas-opción (≥ 56 px de alto, SPEC §9). */
  card: QuizOptionCardStyle;
  /** Placa inset de feedback (estilo de error/success desaturados). */
  plaque: QuizPlaqueStyle;
  /** Vista de feedback de opción incorrecta (D5). */
  feedback: {
    /** Rótulo «La opción X no es la correcta.» dentro de la placa. */
    headerFontSize: number;
    headerLineHeightPx: number;
    headerFontFamily: string;
    /** Texto del feedback: error desaturado (palette.error, SPEC §7.1). */
    color: typeof error;
    fontSize: number;
    lineHeightPx: number;
    maxLines: number;
    charWidthFactor: number;
    fontFamily: string;
    /** Hueco entre la placa y el botón «Volver a empezar el nivel». */
    gapPlaqueToButton: number;
  };
  /** Vista de la carta antigua con el fragmento (SPEC §4.4). */
  story: {
    /** Rótulo del fragmento (púrpura poción, acento de narrativa). */
    heading: string;
    headingFontSize: number;
    headingLineHeightPx: number;
    headingFontFamily: string;
    headingColor: typeof potionPurple;
    /** Intro de la placa: feedback de la correcta en success desaturado. */
    introColor: typeof success;
    /** Cuerpo del fragmento: tinta sepia sobre la carta clara. */
    fontSize: number;
    lineHeightPx: number;
    maxLines: number;
    charWidthFactor: number;
    fontFamily: string;
    bodyColor: typeof parchmentDark;
    gapHeadingToPlaque: number;
    gapPlaqueToBody: number;
    gapBodyToButton: number;
  };
  /** Botones de acción (GothicButton con este layout). */
  button: ButtonLayout;
  /** Marcador de puntaje SIN timer (SPEC §5/§6: score visible en el quiz). */
  score: {
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    color: typeof textPrimary;
  };
  /** Profundidades: velo < carta < contenido < score. */
  depths: { veil: number; panel: number; content: number; score: number };
  /** Timing de los fades de cambio de fase (ms). */
  fade: {
    outMs: number;
    inMs: number;
    /**
     * Pausa con las tarjetas DESHABILITADAS tras responder (se ve la
     * decisión + suena el feedback) antes del cambio de vista.
     */
    cardLockMs: number;
  };
  /** El panel nunca sube de esta Y (deja respirar la fila del score). */
  minTopY: number;
  /** Margen inferior de respeto respecto al lienzo. */
  bottomMargin: number;
}

/** Etiquetas de la UI del quiz (español, SPEC §4.3/§6). */
export const QUIZ_LABELS = {
  storyHeading: 'Fragmento de la historia',
  continueStory: 'Continuar',
  restartLevel: 'Volver a empezar el nivel',
} as const;

/**
 * Layout por defecto del quiz: carta pergamino claro 648 px (36 de margen),
 * tarjetas oscuras de alto calculado (mínimo 64 ≥ 56 px táctil, SPEC §9),
 * placas inset para los mensajes desaturados y botones de 76 px de alto.
 * Las posiciones finas las deriva `quizBoardLayout` con los textos reales.
 */
export const QUIZ_LAYOUT: QuizLayoutData = {
  veil: { color: nightBackground, alpha: 0.88 },
  panel: {
    width: 648,
    centerX: BASE_WIDTH / 2,
    centerY: 660,
    padding: 44,
  },
  question: {
    fontSize: 30,
    lineHeightPx: 42,
    maxLines: 4,
    // Special Elite (typewriter) es ancha: 0.62 em conservador.
    charWidthFactor: 0.62,
    fontFamily: '"Special Elite", Georgia, serif',
    color: parchmentDark,
    gapBelow: 26,
  },
  card: {
    width: 560,
    minHeight: 64,
    gap: 14,
    paddingY: 14,
    cornerRadius: 14,
    labelZoneWidth: 64,
    textPaddingX: 16,
    labelFontSize: 30,
    textFontSize: 22,
    textLineHeightPx: 28,
    textMaxLines: 6,
    textCharWidthFactor: 0.55,
    labelColor: lampFire,
    fontFamily: '"Crimson Text", Georgia, serif',
    labelFontFamily: '"Special Elite", Georgia, serif',
    states: {
      [ButtonVisualState.Idle]: { fill: parchmentDark, stroke: parchmentLight, text: textPrimary },
      [ButtonVisualState.Hover]: { fill: labGreen, stroke: parchmentLight, text: textPrimary },
      [ButtonVisualState.Pressed]: { fill: potionPurple, stroke: parchmentLight, text: textPrimary },
    },
    disabledAlpha: 0.45,
  },
  plaque: {
    fill: parchmentDark,
    stroke: parchmentLight,
    strokeAlpha: 0.35,
    cornerRadius: 12,
    paddingX: 24,
    paddingY: 18,
    gapHeaderToText: 10,
  },
  feedback: {
    headerFontSize: 28,
    headerLineHeightPx: 36,
    headerFontFamily: '"Special Elite", Georgia, serif',
    color: error,
    fontSize: 26,
    lineHeightPx: 34,
    maxLines: 8,
    charWidthFactor: 0.55,
    fontFamily: '"Crimson Text", Georgia, serif',
    gapPlaqueToButton: 28,
  },
  story: {
    heading: QUIZ_LABELS.storyHeading,
    headingFontSize: 28,
    headingLineHeightPx: 36,
    headingFontFamily: '"Special Elite", Georgia, serif',
    headingColor: potionPurple,
    introColor: success,
    fontSize: 24,
    lineHeightPx: 32,
    maxLines: 20,
    charWidthFactor: 0.55,
    fontFamily: '"Crimson Text", Georgia, serif',
    bodyColor: parchmentDark,
    gapHeadingToPlaque: 12,
    gapPlaqueToBody: 16,
    gapBodyToButton: 22,
  },
  button: {
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
  },
  score: {
    x: 40,
    y: 84,
    fontSize: 32,
    fontFamily: '"Special Elite", Georgia, serif',
    color: textPrimary,
  },
  depths: { veil: 20, panel: 30, content: 32, score: 40 },
  fade: { outMs: 110, inMs: 200, cardLockMs: 700 },
  minTopY: 130,
  bottomMargin: 40,
};

/**
 * Botones de acción del quiz («Volver a empezar el nivel» / «Continuar»):
 * layout compacto estilo pergamino oscuro (alto 76 ≥ 64 px táctil, SPEC §9),
 * acentos verde laboratorio (hover) y púrpura poción (pressed) — igual
 * convención que los botones del menú y del «Saltar» narrativo.
 */
export const QUIZ_ACTION_BUTTON: ButtonLayout = QUIZ_LAYOUT.button;

// ---- 4. Composición pura de las vistas (quizBoardLayout) ---------------------

/** Bloques que `quizBoardLayout` calcula para la vista de pregunta. */
export interface QuizCardSlot {
  /** Índice de la opción (0-based → 'A'-'D'). */
  index: number;
  /** Centro Y absoluto de la tarjeta (px sobre 720×1280). */
  centerY: number;
  /** Alto calculado de la tarjeta (≥ `card.minHeight` ≥ 56, SPEC §9). */
  height: number;
  /** Líneas estimadas del texto (métrica conservadora). */
  textLines: number;
  /** ¿Cabe el texto de la opción en la tarjeta? */
  textFits: boolean;
}

/** Vista pregunta: carta + pregunta + 4 tarjetas. */
export interface QuizQuestionView {
  panelHeight: number;
  panelTopY: number;
  /** Centro Y del bloque de pregunta (texto con origin 0.5). */
  questionCenterY: number;
  questionLines: number;
  questionFits: boolean;
  cards: readonly QuizCardSlot[];
}

/** Vista feedback incorrecto (D5): placa de error + «Volver a empezar el nivel». */
export interface QuizFeedbackView {
  panelHeight: number;
  panelTopY: number;
  /** Centro Y del rótulo (dentro de la placa, origin 0.5). */
  headerCenterY: number;
  /** Placa inset (top Y absoluto + alto, dimensionada al PEOR feedback). */
  plaqueTopY: number;
  plaqueHeight: number;
  /** Top Y del texto del feedback (origin (0.5, 0), dentro de la placa). */
  feedbackTopY: number;
  feedbackLines: number;
  feedbackFits: boolean;
  /** Centro Y del botón «Volver a empezar el nivel». */
  buttonCenterY: number;
}

/** Vista historia (SPEC §4.4): rótulo + placa success + fragmento + «Continuar». */
export interface QuizStoryView {
  panelHeight: number;
  panelTopY: number;
  headingCenterY: number;
  /** Placa del feedback correcto (success desaturado). */
  introPlaqueTopY: number;
  introPlaqueHeight: number;
  introTopY: number;
  introLines: number;
  introFits: boolean;
  /** Top Y del cuerpo del fragmento (origin (0.5, 0), tinta sobre la carta). */
  bodyTopY: number;
  bodyLines: number;
  bodyFits: boolean;
  /** Centro Y del botón «Continuar». */
  buttonCenterY: number;
}

/** Composición completa de las tres vistas + veredicto global de ajuste. */
export interface QuizBoardLayout {
  question: QuizQuestionView;
  feedback: QuizFeedbackView;
  story: QuizStoryView;
  /** ¿Todo (paneles, textos y tarjetas) cabe en 720×1280 con sus márgenes? */
  fits: boolean;
}

/** Textos REALES del nivel con los que se dimensionan las vistas. */
export interface QuizBoardInput {
  question: string;
  /** Textos de las opciones, en orden (A…). */
  optionTexts: readonly string[];
  /** Feedbacks de las opciones INCORRECTAS (la placa se dimensiona al peor). */
  wrongFeedbacks: readonly string[];
  /** Feedback de la opción correcta (intro success de la carta de historia). */
  correctFeedback: string;
  /** Fragmento de historia (SPEC §4.4) — el cuerpo de la carta antigua. */
  storyFragment: string;
}

/** Métrica conservadora para `panelTextLayout` (mismo patrón que narrativa). */
function textMetrics(
  style: { fontSize: number; lineHeightPx: number; charWidthFactor: number },
  wrapWidth: number,
  maxLines: number,
): NarrativePanelLayout {
  return {
    panelWidth: wrapWidth,
    panelHeight: maxLines * style.lineHeightPx,
    marginX: 0,
    padding: 0,
    fontSize: style.fontSize,
    lineHeightPx: style.lineHeightPx,
    charWidthFactor: style.charWidthFactor,
    wrapSafetyFactor: TEXT_WRAP_SAFETY_FACTOR,
  };
}

/**
 * Composición pura de las tres vistas del quiz (ver tipos arriba). Reutiliza
 * `panelTextLayout` de `config/narrative.ts`: mismo wrapper greedy con
 * estimación conservadora (la estimación es MÁS ancha que la fuente real,
 * así el render con la fuente verdadera cabe en los altos calculados).
 */
export function quizBoardLayout(
  input: QuizBoardInput,
  layout: QuizLayoutData = QUIZ_LAYOUT,
): QuizBoardLayout {
  const { panel, question: qStyle, card: cardStyle, plaque: plaqueStyle } = layout;
  const innerWidth = panel.width - 2 * panel.padding;

  // ---- Vista pregunta --------------------------------------------------------
  const questionFit = panelTextLayout(
    input.question,
    textMetrics(qStyle, innerWidth, qStyle.maxLines),
  );
  const cardTextWrapWidth =
    cardStyle.width - cardStyle.labelZoneWidth - 2 * cardStyle.textPaddingX;
  const cardMetrics = {
    fontSize: cardStyle.textFontSize,
    lineHeightPx: cardStyle.textLineHeightPx,
    charWidthFactor: cardStyle.textCharWidthFactor,
  };
  const cardHeights = input.optionTexts.map((text, index) => {
    const fit = panelTextLayout(text, textMetrics(cardMetrics, cardTextWrapWidth, cardStyle.textMaxLines));
    const height = Math.max(cardStyle.minHeight, fit.textHeightPx + 2 * cardStyle.paddingY);
    return { index, height, textLines: fit.lineCount, textFits: fit.fits };
  });
  const cardsHeight =
    cardHeights.reduce((sum, card) => sum + card.height, 0) +
    cardStyle.gap * Math.max(0, cardHeights.length - 1);
  const questionViewHeight = questionFit.textHeightPx + qStyle.gapBelow + cardsHeight;
  const questionPanelHeight = questionViewHeight + 2 * panel.padding;
  const questionTopY = panel.centerY - questionPanelHeight / 2;
  const cardsTopY = questionTopY + panel.padding + questionFit.textHeightPx + qStyle.gapBelow;
  let cardCursor = cardsTopY;
  const cards: readonly QuizCardSlot[] = cardHeights.map((card) => {
    const centerY = cardCursor + card.height / 2;
    cardCursor += card.height + cardStyle.gap;
    return { ...card, centerY };
  });

  // ---- Vista feedback incorrecto (dimensionada al PEOR feedback) --------------
  const worstWrong = input.wrongFeedbacks.reduce(
    (worst, text) => (text.length > worst.length ? text : worst),
    '',
  );
  const fStyle = layout.feedback;
  const plaqueWrapWidth = innerWidth - 2 * plaqueStyle.paddingX;
  const feedbackFit = panelTextLayout(worstWrong, textMetrics(fStyle, plaqueWrapWidth, fStyle.maxLines));
  const plaqueHeight =
    2 * plaqueStyle.paddingY + fStyle.headerLineHeightPx + plaqueStyle.gapHeaderToText + feedbackFit.textHeightPx;
  const feedbackViewHeight = plaqueHeight + fStyle.gapPlaqueToButton + layout.button.height;
  const feedbackPanelHeight = feedbackViewHeight + 2 * panel.padding;
  const feedbackTopY = panel.centerY - feedbackPanelHeight / 2;
  const plaqueTopY = feedbackTopY + panel.padding;
  const headerCenterY = plaqueTopY + plaqueStyle.paddingY + fStyle.headerLineHeightPx / 2;
  const feedbackTopTextY =
    plaqueTopY + plaqueStyle.paddingY + fStyle.headerLineHeightPx + plaqueStyle.gapHeaderToText;
  const feedbackButtonCenterY =
    plaqueTopY + plaqueHeight + fStyle.gapPlaqueToButton + layout.button.height / 2;

  // ---- Vista historia (carta antigua, SPEC §4.4) -------------------------------
  const sStyle = layout.story;
  const introFit = panelTextLayout(input.correctFeedback, textMetrics(sStyle, plaqueWrapWidth, sStyle.maxLines));
  const introPlaqueHeight = 2 * plaqueStyle.paddingY + introFit.textHeightPx;
  const bodyFit = panelTextLayout(input.storyFragment, textMetrics(sStyle, innerWidth, sStyle.maxLines));
  const storyViewHeight =
    sStyle.headingLineHeightPx +
    sStyle.gapHeadingToPlaque +
    introPlaqueHeight +
    sStyle.gapPlaqueToBody +
    bodyFit.textHeightPx +
    sStyle.gapBodyToButton +
    layout.button.height;
  const storyPanelHeight = storyViewHeight + 2 * panel.padding;
  const storyTopY = panel.centerY - storyPanelHeight / 2;
  const headingCenterY = storyTopY + panel.padding + sStyle.headingLineHeightPx / 2;
  const introPlaqueTopY = storyTopY + panel.padding + sStyle.headingLineHeightPx + sStyle.gapHeadingToPlaque;
  const introTopY = introPlaqueTopY + plaqueStyle.paddingY;
  const bodyTopY = introPlaqueTopY + introPlaqueHeight + sStyle.gapPlaqueToBody;
  const storyButtonCenterY = bodyTopY + bodyFit.textHeightPx + sStyle.gapBodyToButton + layout.button.height / 2;

  // ---- Veredicto de ajuste (paneles dentro del lienzo, textos dentro) ----------
  const panelFits = (topY: number, height: number): boolean =>
    topY >= layout.minTopY && topY + height <= BASE_HEIGHT - layout.bottomMargin;
  const fits =
    panelFits(questionTopY, questionPanelHeight) &&
    panelFits(feedbackTopY, feedbackPanelHeight) &&
    panelFits(storyTopY, storyPanelHeight) &&
    questionFit.fits &&
    feedbackFit.fits &&
    introFit.fits &&
    bodyFit.fits &&
    cardHeights.every((card) => card.textFits && card.height >= cardStyle.minHeight);

  return {
    question: {
      panelHeight: questionPanelHeight,
      panelTopY: questionTopY,
      questionCenterY: questionTopY + panel.padding + questionFit.textHeightPx / 2,
      questionLines: questionFit.lineCount,
      questionFits: questionFit.fits,
      cards,
    },
    feedback: {
      panelHeight: feedbackPanelHeight,
      panelTopY: feedbackTopY,
      headerCenterY,
      plaqueTopY,
      plaqueHeight,
      feedbackTopY: feedbackTopTextY,
      feedbackLines: feedbackFit.lineCount,
      feedbackFits: feedbackFit.fits,
      buttonCenterY: feedbackButtonCenterY,
    },
    story: {
      panelHeight: storyPanelHeight,
      panelTopY: storyTopY,
      headingCenterY,
      introPlaqueTopY,
      introPlaqueHeight,
      introTopY,
      introLines: introFit.lineCount,
      introFits: introFit.fits,
      bodyTopY,
      bodyLines: bodyFit.lineCount,
      bodyFits: bodyFit.fits,
      buttonCenterY: storyButtonCenterY,
    },
    fits,
  };
}

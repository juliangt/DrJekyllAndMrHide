/**
 * Etapa 5 — test de la LÓGICA y los DATOS del quiz literario
 * (`src/gameplay/quizState.ts`, todo puro sin Phaser):
 *
 *  - `initialQuizState` / `quizReducer`: todas las transiciones válidas e
 *    inválidas de las fases question → feedback-wrong/story → done; la señal
 *    D5 de reinicio; idempotencia; NUNCA retroceso de fase ni fase inválida.
 *  - `optionLabel`: letras A–D (y guard para basura).
 *  - `quizBoardLayout` con los datos REALES del Nivel 1: las tres vistas
 *    (pregunta, feedback, historia) caben en 720×1280, tarjetas ≥ 56 px
 *    (SPEC §9), sin solapes, botones dentro del panel, y el storyFragment
 *    real cabe en la carta antigua (SPEC §4.4). El detector de desborde
 *    funciona con textos artificiales.
 *  - Estilos de feedback desaturados (success/error de SPEC §7.1) y colores
 *    desde la paleta; botones con alto táctil; depths ordenados.
 *  - `QUIZ_POINTS` = +100 del quiz (SPEC §5) en gameplay/scoring.
 */
import { describe, expect, it } from 'vitest';
import { level1 } from '../config/levels/level1';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { PALETTE, error, lampFire, nightBackground, parchmentDark, parchmentLight, potionPurple, success, textPrimary } from '../config/palette';
import {
  QUIZ_ACTION_BUTTON,
  QUIZ_LABELS,
  QUIZ_LAYOUT,
  QUIZ_PANEL_STYLE,
  QuizEventType,
  QuizPhase,
  initialQuizState,
  optionLabel,
  quizBoardLayout,
  quizReducer,
  wrongFeedbackHeader,
  type QuizEvent,
  type QuizState,
} from '../gameplay/quizState';
import { QUIZ_POINTS } from '../gameplay/scoring';
import { ButtonVisualState, MIN_TOUCH_HEIGHT, type ButtonLayout } from '../ui/buttonState';

const { Select, ContinueWrong, ContinueStory } = QuizEventType;

/** Composición de la vista con los datos REALES del Nivel 1 (B correcta). */
const QUIZ = level1.quiz;
const CORRECT_INDEX = 1;
const board = quizBoardLayout({
  question: QUIZ.question,
  optionTexts: QUIZ.options.map((option) => option.text),
  wrongFeedbacks: QUIZ.options.filter((option) => !option.correct).map((option) => option.feedback),
  correctFeedback: QUIZ.options[CORRECT_INDEX].feedback,
  storyFragment: QUIZ.storyFragment,
});

function select(index: number): QuizEvent {
  return { type: Select, index };
}

describe('initialQuizState — estado inicial y clamps de config', () => {
  it('fase question, nada seleccionado, sin señal de reinicio', () => {
    const state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    expect(state).toEqual({
      phase: QuizPhase.Question,
      selected: null,
      restartLevel: false,
      optionCount: 4,
      correctIndex: 1,
    });
  });

  it('optionCount inválido (0, negativo, float, NaN) clampa a ≥ 1', () => {
    expect(initialQuizState({ optionCount: 0, correctIndex: 0 }).optionCount).toBe(1);
    expect(initialQuizState({ optionCount: -3, correctIndex: 0 }).optionCount).toBe(1);
    expect(initialQuizState({ optionCount: 4.9, correctIndex: 0 }).optionCount).toBe(4);
    expect(initialQuizState({ optionCount: Number.NaN, correctIndex: 0 }).optionCount).toBe(1);
  });

  it('correctIndex fuera de rango o basura cae a 0 (degrada, nunca rompe)', () => {
    expect(initialQuizState({ optionCount: 4, correctIndex: 9 }).correctIndex).toBe(0);
    expect(initialQuizState({ optionCount: 4, correctIndex: -1 }).correctIndex).toBe(0);
    expect(initialQuizState({ optionCount: 4, correctIndex: Number.NaN }).correctIndex).toBe(0);
    expect(initialQuizState({ optionCount: 4, correctIndex: 2.6 }).correctIndex).toBe(2);
  });
});

describe('quizReducer — Select desde question (transiciones válidas)', () => {
  it('con la CORRECTA (B=1 del Nivel 1) → fase story, señal de reinicio apagada', () => {
    const state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    const next = quizReducer(state, select(1));
    expect(next.phase).toBe(QuizPhase.Story);
    expect(next.selected).toBe(1);
    expect(next.restartLevel).toBe(false);
    // El reducer NO aplica el +100: eso lo hace la escena (ScoreSystem).
    expect(next).not.toHaveProperty('score');
  });

  it('con una INCORRECTA (A, C o D) → fase feedback-wrong con ESA opción', () => {
    for (const wrong of [0, 2, 3]) {
      const state = initialQuizState({ optionCount: 4, correctIndex: 1 });
      const next = quizReducer(state, select(wrong));
      expect(next.phase).toBe(QuizPhase.FeedbackWrong);
      expect(next.selected).toBe(wrong);
    }
  });

  it('correctIndex no seleccionable como «wrong» (1 → story, no feedback)', () => {
    const state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    expect(quizReducer(state, select(1)).phase).toBe(QuizPhase.Story);
  });
});

describe('quizReducer — Select inválido (idempotente, mismo estado)', () => {
  const state = initialQuizState({ optionCount: 4, correctIndex: 1 });

  it('índices fuera de rango: -1, 4, 100', () => {
    for (const index of [-1, 4, 100]) {
      expect(quizReducer(state, select(index))).toBe(state);
    }
  });

  it('índices basura: NaN, float, Infinity', () => {
    for (const index of [Number.NaN, 2.5, Number.POSITIVE_INFINITY]) {
      expect(quizReducer(state, select(index))).toBe(state);
    }
  });

  it('desde feedback-wrong NO se puede cambiar la respuesta (tarjetas muertas)', () => {
    const wrong = quizReducer(state, select(0));
    expect(quizReducer(wrong, select(1))).toBe(wrong);
    expect(quizReducer(wrong, select(0))).toBe(wrong);
  });

  it('desde story NO se puede volver a seleccionar', () => {
    const story = quizReducer(state, select(1));
    expect(quizReducer(story, select(0))).toBe(story);
  });

  it('desde done NO se puede seleccionar (fase terminal)', () => {
    const done = quizReducer(quizReducer(state, select(1)), { type: ContinueStory });
    expect(quizReducer(done, select(0))).toBe(done);
  });
});

describe('quizReducer — ContinueWrong (señal D5 de reinicio de nivel)', () => {
  it('desde feedback-wrong → done con restartLevel TRUE (reinicio del NIVEL)', () => {
    const wrong = quizReducer(initialQuizState({ optionCount: 4, correctIndex: 1 }), select(3));
    const next = quizReducer(wrong, { type: ContinueWrong });
    expect(next.phase).toBe(QuizPhase.Done);
    expect(next.restartLevel).toBe(true);
    expect(next.selected).toBe(3); // conserva la opción que falló
  });

  it('SOLO desde feedback-wrong: question/story/done lo ignoran', () => {
    const state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    expect(quizReducer(state, { type: ContinueWrong })).toBe(state);
    const story = quizReducer(state, select(1));
    expect(quizReducer(story, { type: ContinueWrong })).toBe(story);
    const done = quizReducer(story, { type: ContinueStory });
    expect(quizReducer(done, { type: ContinueWrong })).toBe(done);
  });
});

describe('quizReducer — ContinueStory (salida a VICTORY)', () => {
  it('desde story → done con restartLevel FALSE (victoria, sin reinicio)', () => {
    const story = quizReducer(initialQuizState({ optionCount: 4, correctIndex: 1 }), select(1));
    const next = quizReducer(story, { type: ContinueStory });
    expect(next.phase).toBe(QuizPhase.Done);
    expect(next.restartLevel).toBe(false);
    expect(next.selected).toBe(1);
  });

  it('SOLO desde story: question/feedback-wrong/done lo ignoran', () => {
    const state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    expect(quizReducer(state, { type: ContinueStory })).toBe(state);
    const wrong = quizReducer(state, select(0));
    expect(quizReducer(wrong, { type: ContinueStory })).toBe(wrong);
  });
});

describe('quizReducer — nunca retrocede de fase y done es terminal', () => {
  it('camino incorrecto completo: question → feedback-wrong → done(restart); nada vuelve a question', () => {
    let state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    state = quizReducer(state, select(0));
    state = quizReducer(state, { type: ContinueWrong });
    for (const event of [select(2), { type: ContinueWrong }, { type: ContinueStory }] as QuizEvent[]) {
      expect(quizReducer(state, event)).toBe(state);
    }
    expect(state.phase).toBe(QuizPhase.Done);
  });

  it('camino correcto completo: question → story → done(victoria); nada vuelve atrás', () => {
    let state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    state = quizReducer(state, select(1));
    state = quizReducer(state, { type: ContinueStory });
    for (const event of [select(3), { type: ContinueWrong }, { type: ContinueStory }] as QuizEvent[]) {
      expect(quizReducer(state, event)).toBe(state);
    }
    expect(state.phase).toBe(QuizPhase.Done);
    expect(state.restartLevel).toBe(false);
  });

  it('reaplicar el mismo evento es idempotente (mismo objeto, sin efectos)', () => {
    const state = initialQuizState({ optionCount: 4, correctIndex: 1 });
    const once = quizReducer(state, select(2));
    const twice = quizReducer(once, select(2));
    expect(twice).toBe(once);
  });

  it('las fases devueltas SIEMPRE pertenecen a la unión QuizPhase', () => {
    let state: QuizState = initialQuizState({ optionCount: 4, correctIndex: 1 });
    const events: QuizEvent[] = [
      select(0), { type: ContinueWrong }, select(1), { type: ContinueStory },
      select(2), { type: ContinueWrong }, { type: ContinueStory },
    ];
    for (const event of events) {
      state = quizReducer(state, event);
      expect(Object.values(QuizPhase)).toContain(state.phase);
    }
  });

  it('config degenerada (1 opción, correcta la 0): select(0) → story', () => {
    const state = initialQuizState({ optionCount: 1, correctIndex: 0 });
    const next = quizReducer(state, select(0));
    expect(next.phase).toBe(QuizPhase.Story);
  });
});

describe('optionLabel — letras A–D (SPEC §4.3)', () => {
  it('0→A, 1→B, 2→C, 3→D', () => {
    expect(optionLabel(0)).toBe('A');
    expect(optionLabel(1)).toBe('B');
    expect(optionLabel(2)).toBe('C');
    expect(optionLabel(3)).toBe('D');
  });

  it('soporta hasta Z (banco de preguntas futuro) y guarda basura con "?"', () => {
    expect(optionLabel(25)).toBe('Z');
    expect(optionLabel(-1)).toBe('?');
    expect(optionLabel(26)).toBe('?');
    expect(optionLabel(Number.NaN)).toBe('?');
    expect(optionLabel(1.5)).toBe('?');
  });
});

describe('wrongFeedbackHeader — rótulo del feedback por opción', () => {
  it('nombra la LETRA elegida, no el índice', () => {
    expect(wrongFeedbackHeader(0)).toBe('La opción A no es la correcta.');
    expect(wrongFeedbackHeader(3)).toBe('La opción D no es la correcta.');
  });

  it('índice basura no rompe (letra "?")', () => {
    expect(wrongFeedbackHeader(-1)).toContain('?');
  });
});

// ---- Composición de las vistas con los datos REALES del Nivel 1 ---------------

describe('quizBoardLayout — coherencia 720×1280 con el quiz REAL del Nivel 1', () => {
  it('fits global: las tres vistas caben en el lienzo (pregunta, feedback, historia)', () => {
    expect(board.fits).toBe(true);
  });

  it.each([
    ['question', board.question],
    ['feedback', board.feedback],
    ['story', board.story],
  ] as const)('vista %s: panel dentro del lienzo, sin tapar la fila del score', (_name, view) => {
    expect(view.panelTopY).toBeGreaterThanOrEqual(QUIZ_LAYOUT.minTopY);
    expect(view.panelTopY + view.panelHeight).toBeLessThanOrEqual(
      BASE_HEIGHT - QUIZ_LAYOUT.bottomMargin,
    );
    expect(view.panelHeight).toBeGreaterThan(0);
  });

  it('la carta (648 px) deja margen lateral simétrico y holgado en 720', () => {
    expect(QUIZ_LAYOUT.panel.width).toBeLessThanOrEqual(BASE_WIDTH);
    const marginX = (BASE_WIDTH - QUIZ_LAYOUT.panel.width) / 2;
    expect(marginX).toBeGreaterThanOrEqual(24);
  });

  it('las 4 tarjetas existen, con alto ≥ 56 px (SPEC §9) y ≥ mínimo configurado', () => {
    expect(board.question.cards.length).toBe(QUIZ.options.length);
    for (const card of board.question.cards) {
      expect(card.height).toBeGreaterThanOrEqual(56);
      expect(card.height).toBeGreaterThanOrEqual(QUIZ_LAYOUT.card.minHeight);
      expect(card.textFits).toBe(true);
      expect(card.textLines).toBeGreaterThanOrEqual(1);
    }
  });

  it('la tarjeta B (texto largo del cheque) necesita más líneas que la A — el alto RESPONDE al dato', () => {
    const byIndex = board.question.cards;
    expect(byIndex[CORRECT_INDEX].textLines).toBeGreaterThan(byIndex[0].textLines);
    expect(byIndex[CORRECT_INDEX].height).toBeGreaterThan(byIndex[0].height);
  });

  it('tarjetas apiladas sin solape y con el gap configurado', () => {
    const cards = board.question.cards;
    for (let i = 1; i < cards.length; i++) {
      const prevBottom = cards[i - 1].centerY + cards[i - 1].height / 2;
      const currentTop = cards[i].centerY - cards[i].height / 2;
      expect(currentTop - prevBottom).toBeCloseTo(QUIZ_LAYOUT.card.gap, 6);
    }
  });

  it('la primera tarjeta arranca tras la pregunta (gapBelow exacto) y la última respeta el padding', () => {
    const { question: view } = board;
    const questionBottom = view.panelTopY + QUIZ_LAYOUT.panel.padding + view.questionLines * QUIZ_LAYOUT.question.lineHeightPx;
    const first = view.cards[0];
    expect(first.centerY - first.height / 2 - questionBottom).toBeCloseTo(QUIZ_LAYOUT.question.gapBelow, 6);

    const last = view.cards[view.cards.length - 1];
    expect(last.centerY + last.height / 2).toBeCloseTo(view.panelTopY + view.panelHeight - QUIZ_LAYOUT.panel.padding, 6);
  });

  it('los centros de los botones quedan DENTRO del panel de su vista', () => {
    const buttonHeight = QUIZ_LAYOUT.button.height;
    for (const view of [board.feedback, board.story]) {
      expect(view.buttonCenterY - buttonHeight / 2).toBeGreaterThanOrEqual(view.panelTopY);
      expect(view.buttonCenterY + buttonHeight / 2).toBeLessThanOrEqual(view.panelTopY + view.panelHeight);
    }
  });

  it('pregunta, feedback, intro y FRAGMENTO DE HISTORIA reales caben (SPEC §4.4)', () => {
    expect(board.question.questionFits).toBe(true);
    expect(board.feedback.feedbackFits).toBe(true);
    expect(board.story.introFits).toBe(true);
    expect(board.story.bodyFits).toBe(true);
    // El fragmento real es un texto largo (sanity del detector, no trivial).
    expect(board.story.bodyLines).toBeGreaterThanOrEqual(5);
    expect(board.story.bodyLines).toBeLessThanOrEqual(QUIZ_LAYOUT.story.maxLines);
  });
});

describe('quizBoardLayout — detector de desborde con textos artificiales', () => {
  const base = {
    question: QUIZ.question,
    optionTexts: QUIZ.options.map((option) => option.text),
    wrongFeedbacks: QUIZ.options.filter((option) => !option.correct).map((option) => option.feedback),
    correctFeedback: QUIZ.options[CORRECT_INDEX].feedback,
    storyFragment: QUIZ.storyFragment,
  };
  const longText = 'palabra larguirucha '.repeat(120);

  it('una pregunta enorme NO cabe (fits false, questionFits false)', () => {
    const result = quizBoardLayout({ ...base, question: longText });
    expect(result.question.questionFits).toBe(false);
    expect(result.fits).toBe(false);
  });

  it('una opción enorme NO cabe en su tarjeta (textFits false)', () => {
    const optionTexts = [...base.optionTexts];
    optionTexts[2] = longText;
    const result = quizBoardLayout({ ...base, optionTexts });
    expect(result.question.cards[2].textFits).toBe(false);
    expect(result.fits).toBe(false);
  });

  it('un fragmento de historia enorme NO cabe en la carta (bodyFits false)', () => {
    const result = quizBoardLayout({ ...base, storyFragment: longText });
    expect(result.story.bodyFits).toBe(false);
    expect(result.fits).toBe(false);
  });

  it('un feedback enorme dispara feedbackFits false (la placa no crece infinito)', () => {
    const wrongFeedbacks = [...base.wrongFeedbacks];
    wrongFeedbacks[0] = longText;
    const result = quizBoardLayout({ ...base, wrongFeedbacks });
    expect(result.feedback.feedbackFits).toBe(false);
    expect(result.fits).toBe(false);
  });
});

// ---- Estilos y colores (SPEC §7.1: desaturados, todo desde la paleta) --------

describe('estilos del quiz — colores SIEMPRE desde la paleta (SPEC §7.1)', () => {
  const PALETTE_VALUES = Object.values(PALETTE) as readonly string[];

  function expectInPalette(hex: string): void {
    expect(PALETTE_VALUES).toContain(hex);
  }

  it('la carta es pergamino CLARO con borde sepia oscuro (SPEC §6 «cartas antiguas»)', () => {
    expect(QUIZ_PANEL_STYLE.fill).toBe(parchmentLight);
    expect(QUIZ_PANEL_STYLE.stroke).toBe(parchmentDark);
    expect(QUIZ_PANEL_STYLE.cornerRadius).toBeGreaterThan(0);
    expect(QUIZ_PANEL_STYLE.borderWidth).toBeGreaterThan(0);
  });

  it('el velo usa el color de noche con alfa válida', () => {
    expect(QUIZ_LAYOUT.veil.color).toBe(nightBackground);
    expect(QUIZ_LAYOUT.veil.alpha).toBeGreaterThan(0);
    expect(QUIZ_LAYOUT.veil.alpha).toBeLessThanOrEqual(1);
  });

  it('tarjetas: relleno/borde/texto de los tres estados en la paleta', () => {
    const states = QUIZ_LAYOUT.card.states;
    for (const visual of Object.values(ButtonVisualState)) {
      const colors = states[visual];
      expectInPalette(colors.fill);
      expectInPalette(colors.stroke);
      expectInPalette(colors.text);
    }
    expect(states[ButtonVisualState.Idle].fill).toBe(parchmentDark);
    expect(states[ButtonVisualState.Hover].fill).toBe(PALETTE.labGreen);
    expect(states[ButtonVisualState.Pressed].fill).toBe(potionPurple);
    // Letra de opción: acento cálido de farola sobre la tarjeta oscura.
    expect(QUIZ_LAYOUT.card.labelColor).toBe(lampFire);
  });

  it('feedback de error: error DESATURADO (#b05a5a, SPEC §7.1) en rótulo y texto', () => {
    expect(QUIZ_LAYOUT.feedback.color).toBe(error);
    expect(QUIZ_LAYOUT.feedback.color).toBe('#b05a5a');
  });

  it('feedback de acierto (intro de la carta): success DESATURADO (#7fb069, SPEC §7.1)', () => {
    expect(QUIZ_LAYOUT.story.introColor).toBe(success);
    expect(QUIZ_LAYOUT.story.introColor).toBe('#7fb069');
  });

  it('tinta de la carta: pregunta y cuerpo del fragmento en sepia oscuro', () => {
    expect(QUIZ_LAYOUT.question.color).toBe(parchmentDark);
    expect(QUIZ_LAYOUT.story.bodyColor).toBe(parchmentDark);
    // Rótulo del fragmento: púrpura poción (acento de narrativa).
    expect(QUIZ_LAYOUT.story.headingColor).toBe(potionPurple);
  });

  it('placas inset oscuras: error/success ≥ 3:1 sobre su fondo (SPEC §9)', () => {
    expect(QUIZ_LAYOUT.plaque.fill).toBe(parchmentDark);
    expect(QUIZ_LAYOUT.plaque.stroke).toBe(parchmentLight);
  });

  it('score sin timer: estilo de la fila de puntaje de la paleta', () => {
    expect(QUIZ_LAYOUT.score.color).toBe(textPrimary);
    expectInPalette(QUIZ_LAYOUT.score.color);
  });

  it('alturas táctiles: tarjetas ≥ 56 (SPEC §9) y botones ≥ 64', () => {
    expect(QUIZ_LAYOUT.card.minHeight).toBeGreaterThanOrEqual(56);
    expect(QUIZ_ACTION_BUTTON.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
    expect(QUIZ_LAYOUT.button.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
  });

  it('el botón de acción comparte la convención de estados del resto del juego', () => {
    const layout: ButtonLayout = QUIZ_ACTION_BUTTON;
    expect(layout.states[ButtonVisualState.Idle].fill).toBe(parchmentDark);
    expect(layout.states[ButtonVisualState.Hover].fill).toBe(PALETTE.labGreen);
    expect(layout.states[ButtonVisualState.Pressed].fill).toBe(potionPurple);
  });

  it('depths ordenados: velo < panel < contenido < score', () => {
    const { depths } = QUIZ_LAYOUT;
    expect(depths.veil).toBeLessThan(depths.panel);
    expect(depths.panel).toBeLessThan(depths.content);
    expect(depths.content).toBeLessThan(depths.score);
  });

  it('la pausa de tarjetas bloqueadas tras responder es perceptible pero corta (< 1.2 s)', () => {
    expect(QUIZ_LAYOUT.fade.cardLockMs).toBeGreaterThanOrEqual(400);
    expect(QUIZ_LAYOUT.fade.cardLockMs).toBeLessThan(1200);
  });

  it('etiquetas exactas del PLAN/SPEC («Volver a empezar el nivel» / «Continuar»)', () => {
    expect(QUIZ_LABELS.restartLevel).toBe('Volver a empezar el nivel');
    expect(QUIZ_LABELS.continueStory).toBe('Continuar');
    expect(QUIZ_LAYOUT.story.heading).toBe('Fragmento de la historia');
  });
});

describe('puntuación del quiz (SPEC §5)', () => {
  it('quiz correcto = +100 (todo o nada, D5/D7)', () => {
    expect(QUIZ_POINTS).toBe(100);
  });
});

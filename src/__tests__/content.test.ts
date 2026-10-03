/**
 * Etapa 7 — REVISIÓN DE TEXTOS (PLAN tarea 6 / riesgo de contenido SPEC §13,
 * reencuadre D4): recorre TODOS los textos del juego y verifica que son aptos
 * para público 10+.
 *
 * GLOSA DE REVISIÓN (adulto/educador — revisión aplicada en Etapa 7):
 *  - LÉXICO VIOLENTO: sin ocurrencias. El reencuadre D4 convierte el
 *    episodio del libro en «sustos en la niebla»: la niña sale «asustada
 *    pero ilesa», nadie sufre daño visible y no aparece ninguna palabra de
 *    la lista prohibida (sangre, muerte, matar, asesinar, atropello,
 *    pisotea, cadáver, arma, …) en ninguno de los textos del juego.
 *  - TÉRMINOS REVISADOS Y PERMITIDOS (con razón): «ir preso» (pregunta del
 *    quiz, VERBATIM de start.md/SPEC §4.3 — habla de justicia, no de
 *    violencia), «Soborna» (opción C: soborno económico, no violento) y
 *    «testigos… un cheque que lo señala» (feedback D: intriga literaria).
 *  - TONO: gótico «lúgubre pero amable» (SPEC §1); el GAME_OVER anima a
 *    reintentar y JAMÁS dice «perdiste» (SPEC §6). Mayúsculas sostenidas:
 *    solo signos de exclamación naturales del español.
 *  - «ILESA» presente donde corresponde (SPEC §4.2/§4.4: la niña queda
 *    «asustada pero ilesa» en el fragmento de historia).
 *
 * Cualquier texto nuevo debe pasar por este test: el corpus se construye
 * desde los CONFIGS (fuente de verdad), no copiado a mano.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../config/levels';
import { stripLoreMarkers } from '../config/narrative';
import {
  HOW_TO_PLAY,
  HOW_TO_PLAY_CLOSE_LABEL,
  HOW_TO_PLAY_TITLE,
  MENU_SUBTITLE,
  MENU_TITLE,
  menuButtonsFor,
} from '../config/menu';
import { QUIZ_LABELS, initialQuizState, quizBoardLayout, wrongFeedbackHeader } from '../gameplay/quizState';
import { GAME_OVER_OVERLAY } from '../gameplay/gameOverOverlay';
import {
  DEFAULT_READER_NAME,
  VICTORY_LABELS,
  buildScoreBreakdown,
  diplomaParts,
  recordLabel,
} from '../gameplay/victory';
import { NARRATIVE_SKIP_BUTTON } from '../config/narrative';
import { ACTION_PAUSE_BUTTON } from '../gameplay/actionLayout';
import { INTRO_BEATS } from '../config/intro';

// ---- Corpus de TODOS los textos del juego ------------------------------------

/** Textos literales que viven en SCENAS (no en configs) — QA los fija aquí. */
const SCENE_LITERALS: readonly string[] = [
  'La niebla se levanta…', // PreloadScene.create (pantalla mínima)
  'Puntaje', // ui/Hud.ts scoreLabel («Puntaje: N»)
];

/** Normaliza: minúsculas y SIN tildes (comparación por raíces). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Léxico violento PROHIBIDO (raíces sin tildes; coinciden como prefijo de
 * palabra: 'sangr' captura sangre/sangriento, 'mata' captura matar/matanza).
 * Es la lista del PLAN (sangre, muerte, matar, asesinar, atropello,
 * pisotea, cadáver, arma…) ampliada con el resto del campo semántico.
 */
const FORBIDDEN_STEMS: readonly string[] = [
  // sangre y heridas
  'sangr', 'herid', 'moreton', 'cardenal',
  // muerte
  'muert', 'morir', 'muri', 'muere', 'fallec', 'cadaver', 'restos',
  // matar / agredir
  'mata', 'asesin', 'homicid', 'golpe', 'aplast', 'destroz', 'machac',
  'atropell', 'pisote', 'estrangul', 'ahog', 'tortur', 'flagel',
  // armas
  'arma', 'pistola', 'revolver', 'escopeta', 'rifle', 'cuchill', 'navaja',
  'daga', 'punal', 'hacha', 'veneno', 'envenen', 'dispar', 'bala', 'balazo',
  // violencia genérica
  'violenc', 'violent', 'crimen', 'crimin', 'delito', 'pelea', 'agresion',
  'agredir', 'agon', 'suicid', 'guerr', 'batalla',
];

/** Palabras con mayúscula sostenida permitidas (siglas/placeholders). */
const UPPERCASE_ALLOWLIST = new Set([
  'TBD', // placeholder del título pendiente (SPEC §1.1)
  '188X', // década imprecisa del panel 1, VERBATIM de SPEC §4.1 («Londres, 188X»)
]);

/**
 * Recolecta TODO el texto visible del juego desde los configs, etiquetado
 * para que un fallo diga EXACTAMENTE dónde corregir.
 */
function buildCorpus(): readonly { where: string; text: string }[] {
  const corpus: { where: string; text: string }[] = [];

  for (const level of LEVELS) {
    corpus.push({ where: `nivel ${level.id}: título`, text: level.title });
    level.lore.forEach((panel, index) => {
      corpus.push({ where: `nivel ${level.id}: viñeta ${index + 1}`, text: stripLoreMarkers(panel.text) });
    });
    corpus.push({ where: `nivel ${level.id}: HUD (etiqueta de meta)`, text: level.action.hudLabel });
    corpus.push({ where: `nivel ${level.id}: pregunta del quiz`, text: level.quiz.question });
    level.quiz.options.forEach((option, index) => {
      corpus.push({ where: `nivel ${level.id}: opción ${String.fromCharCode(65 + index)}`, text: option.text });
      corpus.push({ where: `nivel ${level.id}: feedback de la opción ${String.fromCharCode(65 + index)}`, text: option.feedback });
    });
    corpus.push({ where: `nivel ${level.id}: fragmento de historia`, text: level.quiz.storyFragment });
  }

  corpus.push({ where: 'menú: título', text: MENU_TITLE });
  corpus.push({ where: 'menú: subtítulo', text: MENU_SUBTITLE });
  corpus.push({ where: 'menú: título «Cómo jugar»', text: HOW_TO_PLAY_TITLE });
  corpus.push({ where: 'menú: botón cerrar «Cómo jugar»', text: HOW_TO_PLAY_CLOSE_LABEL });
  for (const step of HOW_TO_PLAY) {
    corpus.push({ where: `menú: paso «${step.title}» (título)`, text: step.title });
    corpus.push({ where: `menú: paso «${step.title}» (texto)`, text: step.text });
  }
  for (const button of menuButtonsFor({ inProgress: true })) {
    corpus.push({ where: `menú: botón «${button.label}»`, text: button.label });
  }

  corpus.push({ where: 'quiz: rótulo del fragmento', text: QUIZ_LABELS.storyHeading });
  corpus.push({ where: 'quiz: botón «Continuar»', text: QUIZ_LABELS.continueStory });
  corpus.push({ where: 'quiz: botón «Volver a empezar el nivel»', text: QUIZ_LABELS.restartLevel });
  for (const index of [0, 1, 2, 3]) {
    corpus.push({ where: `quiz: rótulo de feedback (opción ${String.fromCharCode(65 + index)})`, text: wrongFeedbackHeader(index) });
  }

  corpus.push({ where: 'game over: título', text: GAME_OVER_OVERLAY.title });
  corpus.push({ where: 'game over: subtítulo', text: GAME_OVER_OVERLAY.subtitle });
  corpus.push({ where: 'game over: botón «Reintentar»', text: GAME_OVER_OVERLAY.retryLabel });

  corpus.push({ where: 'narrativa: botón «Saltar»', text: NARRATIVE_SKIP_BUTTON.label });
  corpus.push({ where: 'acción: botón «Pausa»', text: ACTION_PAUSE_BUTTON.label });

  // Cinemática de introducción: los letreros visibles de cada beat.
  INTRO_BEATS.forEach((beat, index) => {
    if (beat.caption.length > 0) {
      corpus.push({ where: `intro: letrero del beat ${index + 1}`, text: beat.caption });
    }
  });

  corpus.push({ where: 'victoria: titular', text: VICTORY_LABELS.heading });
  corpus.push({ where: 'victoria: botón «Jugar de nuevo»', text: VICTORY_LABELS.playAgain });
  corpus.push({ where: 'victoria: botón «Volver al inicio»', text: VICTORY_LABELS.backToMenu });
  corpus.push({ where: 'victoria: placeholder del nombre', text: VICTORY_LABELS.namePlaceholder });
  corpus.push({ where: 'victoria: pista de firma', text: VICTORY_LABELS.nameHint });
  corpus.push({ where: 'victoria: rótulo del Total', text: VICTORY_LABELS.breakdownTotal });
  const diploma = diplomaParts(DEFAULT_READER_NAME, 214);
  corpus.push({ where: 'victoria: diploma (intro)', text: diploma.top });
  corpus.push({ where: 'victoria: diploma (nombre por defecto)', text: diploma.name });
  corpus.push({ where: 'victoria: diploma (cuerpo)', text: diploma.bottom });
  for (const line of buildScoreBreakdown({ taps: 30, quiz: 100, bonus: 84 }).lines) {
    corpus.push({ where: `victoria: desglose «${line.label}»`, text: line.label });
  }
  corpus.push({ where: 'victoria: récord (nuevo)', text: recordLabel(214, 0) });
  corpus.push({ where: 'victoria: récord (igualado)', text: recordLabel(150, 150) });

  SCENE_LITERALS.forEach((text, index) => {
    corpus.push({ where: `escena (literal fijado #${index + 1})`, text });
  });

  return corpus;
}

// ---- 1. Sin léxico violento ---------------------------------------------------

describe('contenido 1 — sin léxico violento explícito (SPEC §13 / D4)', () => {
  const corpus = buildCorpus();

  it('el corpus cubre TODAS las fuentes de texto del juego (≥ 40 entradas)', () => {
    // Guardia del propio checklist: si alguien añade una fuente y no pasa
    // por aquí, el número deja de cuadrar y se revisa el corpus.
    expect(corpus.length).toBeGreaterThanOrEqual(40);
  });

  it.each(corpus)('$where: sin palabras del léxico prohibido', ({ where, text }) => {
    const normalized = normalize(text);
    for (const stem of FORBIDDEN_STEMS) {
      const pattern = new RegExp(`\\b${stem}`, 'i');
      expect(pattern.test(normalized), `"${where}" contiene la raíz prohibida "${stem}": «${text}»`).toBe(false);
    }
  });

  it('la lista de raíces prohibidas incluye las pedidas por el PLAN', () => {
    for (const required of ['sangr', 'muert', 'mata', 'asesin', 'atropell', 'pisote', 'cadaver', 'arma']) {
      expect(FORBIDDEN_STEMS).toContain(required);
    }
  });
});

// ---- 2. Tono 10+ ---------------------------------------------------------------

describe('contenido 2 — tono 10+ (sin mayúsculas agresivas, feedback pedagógico)', () => {
  const corpus = buildCorpus();

  it.each(corpus)('$where: sin mayúsculas sostenidas agresivas', ({ text }) => {
    const words = text.split(/\s+/).map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''));
    for (const word of words) {
      if (word.length >= 4 && word === word.toUpperCase() && /\p{L}/u.test(word)) {
        expect(UPPERCASE_ALLOWLIST.has(word), `mayúscula sostenida no permitida: "${word}" en «${text}»`).toBe(true);
      }
    }
  });

  it('el GAME_OVER JAMÁS dice «perdiste» (tono animoso, SPEC §6)', () => {
    const texts = [GAME_OVER_OVERLAY.title, GAME_OVER_OVERLAY.subtitle, GAME_OVER_OVERLAY.retryLabel];
    for (const text of texts) {
      expect(normalize(text)).not.toMatch(/perdiste|derrota|fallaste|fracasaste/);
    }
  });

  it('el GAME_OVER anima a reintentar (mantiene la exhortación del SPEC)', () => {
    expect(GAME_OVER_OVERLAY.subtitle).toBe('¡Inténtalo de nuevo!');
  });

  it('TODOS los feedbacks del quiz son pedagógicos (3+ palabras, completos)', () => {
    for (const level of LEVELS) {
      level.quiz.options.forEach((option, index) => {
        const words = option.feedback.trim().split(/\s+/).length;
        expect(words, `feedback de la opción ${String.fromCharCode(65 + index)} del nivel ${level.id}`).toBeGreaterThanOrEqual(3);
        expect(option.feedback.endsWith('…') || /[.!?…]$/.test(option.feedback)).toBe(true);
      });
    }
  });

  it('la pregunta del quiz es una pregunta (cierra con «?»)', () => {
    for (const level of LEVELS) {
      expect(level.quiz.question.trim().endsWith('?')).toBe(true);
    }
  });
});

// ---- 3. «Ilesa» donde corresponde (D4) ------------------------------------------

describe('contenido 3 — la niña queda «asustada pero ilesa» (reencuadre D4)', () => {
  it('el fragmento de historia del Nivel 1 contiene «ilesa» y «asustada»', () => {
    for (const level of LEVELS) {
      const fragment = normalize(level.quiz.storyFragment);
      expect(fragment, `fragmento del nivel ${level.id}`).toMatch(/ilesa/);
      expect(fragment).toMatch(/asustada/);
    }
  });

  it('el reencuadre es EXPLÍCITO: asustada PERO ilesa (la fórmula completa)', () => {
    const level = LEVELS[0];
    expect(normalize(level.quiz.storyFragment)).toMatch(/asustada pero ilesa/);
  });
});

// ---- 4. Coherencia del quiz con el material fuente (verbatim SPEC §4.3) ---------

describe('contenido 4 — la pregunta y opciones del Nivel 1 son VERBATIM (start.md)', () => {
  const level1 = LEVELS[0];

  it('la pregunta es exactamente la del SPEC §4.3', () => {
    expect(level1.quiz.question).toBe('¿Cómo logra Mr. Hyde evitar ir preso tras el incidente con la niña?');
  });

  it('la opción B (el cheque) es la única correcta', () => {
    const correct = level1.quiz.options.filter((option) => option.correct === true);
    expect(correct.length).toBe(1);
    expect(level1.quiz.options[1].correct).toBe(true);
    expect(level1.quiz.options[1].text).toContain('cheque');
  });

  it('hay exactamente 4 opciones (A–D) y todas tienen feedback', () => {
    expect(level1.quiz.options.length).toBe(4);
    for (const option of level1.quiz.options) {
      expect(option.feedback.length).toBeGreaterThan(0);
    }
  });

  it('el tablero del quiz compone sus TRES vistas con los textos reales sin desbordar', () => {
    // Duplicado a propósito de la revisión: los textos REALES pasan por el
    // compositor puro (garantía «nunca desborda» del quiz).
    const correctIndex = level1.quiz.options.findIndex((option) => option.correct === true);
    const board = quizBoardLayout({
      question: level1.quiz.question,
      optionTexts: level1.quiz.options.map((option) => option.text),
      wrongFeedbacks: level1.quiz.options.filter((_, index) => index !== correctIndex).map((option) => option.feedback),
      correctFeedback: level1.quiz.options[correctIndex]!.feedback,
      storyFragment: level1.quiz.storyFragment,
    });
    expect(board.fits).toBe(true);
    expect(initialQuizState({ optionCount: level1.quiz.options.length, correctIndex }).optionCount).toBe(4);
  });
});

/**
 * Etapa 7 — REVISIÓN DE TEXTOS (PLAN tarea 6 / riesgo de contenido SPEC §13,
 * reencuadre D4): recorre TODOS los textos del juego y verifica que son aptos
 * para público 10+.
 *
 * GLOSA DE REVISIÓN (adulto/educador — revisión aplicada en Etapa 7, ampliada
 * en Fase 1 con los niveles 2 y 3):
 *  - LÉXICO VIOLENTO: la raíz «golpe» SALIÓ de la lista con las mecánicas de
 *    N2/N3 (cane-strike / transform-target): «golpe/bastonazo» es ahora un
 *    verbo de JUEGO caricaturesco — nadie sufre daño visible y el objetivo
 *    escapa o se transforma entre la niebla (mismo reencuadre D4). El resto
 *    del campo semántico violento (sangre, muerte, matar, asesinar,
 *    atropello, pisotea, cadáver, arma, …) sigue PROHIBIDO en todos los
 *    textos del juego.
 *  - TÉRMINOS REVISADOS Y PERMITIDOS (con razón): «ir preso» (pregunta del
 *    quiz N1, VERBATIM de start.md/SPEC §4.3 — habla de justicia, no de
 *    violencia), «Soborna» (opción C: soborno económico, no violento),
 *    «testigos… un cheque que lo señala» (feedback D: intriga literaria) y
 *    «¿Por qué Hyde mató…?» (pregunta del quiz N2, VERBATIM del material
 *    fuente: el feedback didáctico sí explica el episodio sin morbo).
 *  - TONO: gótico «lúgubre pero amable» (SPEC §1); el GAME_OVER anima a
 *    reintentar y JAMÁS dice «perdiste» (SPEC §6). Mayúsculas sostenidas:
 *    solo signos de exclamación naturales del español.
 *  - «ILESA» presente donde corresponde (SPEC §4.2/§4.4: la niña del N1
 *    queda «asustada pero ilesa» en su fragmento de historia; los fragmentos
 *    de N2/N3 narran sus episodios con el mismo espíritu D4).
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
import { EPILOGUE_BEATS } from '../config/epilogue';

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
 *
 * NOTA FASE 1 (niveles 2 y 3): la raíz «golpe» SALE de la lista — con las
 * mecánicas cane-strike / transform-target, «golpe/bastonazo» es un verbo de
 * juego caricaturesco (nadie sufre daño visible, D4) y aparece en textos
 * legítimos como «Golpéalo 5 veces» o el HUD «Golpes a Hyde». El resto del
 * campo semántico violento sigue prohibido en TODOS los textos.
 */
const FORBIDDEN_STEMS: readonly string[] = [
  // sangre y heridas
  'sangr', 'herid', 'moreton', 'cardenal',
  // muerte
  'muert', 'morir', 'muri', 'muere', 'fallec', 'cadaver', 'restos',
  // matar / agredir («golpe» retirado en Fase 1: verbo de juego de N2/N3)
  'mata', 'asesin', 'homicid', 'aplast', 'destroz', 'machac',
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
    // Textos propios de mecánicas concretas (unión discriminada por `mechanic`).
    if (level.action.mechanic === 'cane-strike') {
      corpus.push({
        where: `nivel ${level.id}: grito de victoria de Hyde (cane-strike)`,
        text: level.action.victoryLine,
      });
    }
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

  // Cinemática de cierre (Fase 4 — epílogo): los letreros visibles de cada beat.
  EPILOGUE_BEATS.forEach((beat, index) => {
    if (beat.caption.length > 0) {
      corpus.push({ where: `epílogo: letrero del beat ${index + 1}`, text: beat.caption });
    }
  });

  corpus.push({ where: 'victoria: titular', text: VICTORY_LABELS.heading });
  corpus.push({ where: 'victoria: botón «Jugar de nuevo»', text: VICTORY_LABELS.playAgain });
  corpus.push({ where: 'victoria: botón «Volver al inicio»', text: VICTORY_LABELS.backToMenu });
  corpus.push({ where: 'victoria: botón «Ver el final» (epílogo)', text: VICTORY_LABELS.watchEnding });
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

describe('contenido 3 — la niña queda «asustada pero ilesa» (reencuadre D4, Nivel 1)', () => {
  it('el fragmento de historia del NIVEL 1 contiene «ilesa» y «asustada»', () => {
    const level1 = LEVELS[0];
    expect(level1.id).toBe(1); // guardia: el episodio de la niña es el del N1
    const fragment = normalize(level1.quiz.storyFragment);
    expect(fragment).toMatch(/ilesa/);
    expect(fragment).toMatch(/asustada/);
  });

  it('el reencuadre es EXPLÍCITO: asustada PERO ilesa (la fórmula completa)', () => {
    const level1 = LEVELS[0];
    expect(normalize(level1.quiz.storyFragment)).toMatch(/asustada pero ilesa/);
  });

  it('los fragmentos de los NIVELES 2 y 3 narran sus episodios con el mismo espíritu D4', () => {
    for (const level of LEVELS.filter((level) => level.id !== 1)) {
      const fragment = normalize(level.quiz.storyFragment);
      expect(fragment.trim().length, `fragmento del nivel ${level.id} vacío`).toBeGreaterThan(0);
      expect(fragment, `fragmento del nivel ${level.id} con léxico prohibido`).not.toMatch(
        /sangre|herid|muert|mata|asesin|atropell|pisote/,
      );
    }
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

  it('el tablero del quiz compone sus TRES vistas con los textos reales de TODOS los niveles sin desbordar', () => {
    // Duplicado a propósito de la revisión: los textos REALES de cada nivel
    // pasan por el compositor puro (garantía «nunca desborda» del quiz).
    for (const level of LEVELS) {
      const correctIndex = level.quiz.options.findIndex((option) => option.correct === true);
      const board = quizBoardLayout({
        question: level.quiz.question,
        optionTexts: level.quiz.options.map((option) => option.text),
        wrongFeedbacks: level.quiz.options.filter((_, index) => index !== correctIndex).map((option) => option.feedback),
        correctFeedback: level.quiz.options[correctIndex]!.feedback,
        storyFragment: level.quiz.storyFragment,
      });
      expect(board.fits, `el nivel ${level.id} desborda el tablero del quiz`).toBe(true);
      expect(initialQuizState({ optionCount: level.quiz.options.length, correctIndex }).optionCount).toBe(4);
    }
  });
});

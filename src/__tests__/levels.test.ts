/**
 * Etapa 1 — test de los DATOS del Nivel 1 (SPEC §4) y del registro:
 * tipado contra LevelConfig (compila), 4 paneles ≤ 40 palabras, parámetros
 * exactos de la mecánica ([120,180] px/s, [800,1500] ms, meta 3, 45 s),
 * quiz con 4 opciones verbatim (B correcta) y feedback en todas, fragmento
 * de historia con el episodio del cheque, getLevel e ids únicos.
 */
import { describe, expect, it } from 'vitest';
import { GIRL_TEXTURE_KEY, level1 } from '../config/levels/level1';
import { LEVELS, getLevel } from '../config/levels';
import type { LoreBackground } from '../config/levels/types';

/** Cuenta palabras de un panel (SPEC §9: máx. ~40). */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Cuenta oraciones de un fragmento (terminadores . ! ?). La elipsis «…» NO
 * cuenta: es un recurso de estilo DENTRO de la frase, no un cierre.
 */
function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

describe('registry (config/levels/index.ts)', () => {
  it('LEVELS contiene el Nivel 1 y getLevel(1) lo devuelve', () => {
    expect(LEVELS.length).toBe(1);
    expect(getLevel(1)).toBe(level1);
  });

  it('getLevel de id inexistente devuelve undefined', () => {
    expect(getLevel(2)).toBeUndefined();
  });

  it('ids únicos en el registro', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('level1 — nivel (SPEC §4)', () => {
  it('id 1 y título no vacío', () => {
    expect(level1.id).toBe(1);
    expect(level1.title.length).toBeGreaterThan(0);
  });
});

describe('level1 — lore: los 4 paneles de SPEC §4.1', () => {
  it('tiene exactamente 4 paneles', () => {
    expect(level1.lore.length).toBe(4);
  });

  it('cada panel tiene texto no vacío y ≤ 40 palabras', () => {
    for (const [index, panel] of level1.lore.entries()) {
      expect(panel.text.trim().length, `panel ${index + 1} vacío`).toBeGreaterThan(0);
      expect(wordCount(panel.text), `panel ${index + 1} excede 40 palabras`).toBeLessThanOrEqual(40);
    }
  });

  it('cada panel declara un fondo procedural válido', () => {
    const valid: readonly LoreBackground[] = ['alley', 'lab', 'street'];
    for (const panel of level1.lore) {
      expect(valid).toContain(panel.background);
    }
  });

  it('el arco narrativo de SPEC §4.1: calle → laboratorio → callejón', () => {
    expect(level1.lore[0].background).toBe('street');
    expect(level1.lore[1].background).toBe('lab');
    expect(level1.lore[2].background).toBe('alley');
  });

  it('el panel final instruye la mecánica (3 toques)', () => {
    expect(level1.lore[3].text).toContain('3 veces');
  });
});

describe('level1 — action: tap-target con los parámetros de SPEC §4.2', () => {
  it('mecánica tap-target', () => {
    expect(level1.action.mechanic).toBe('tap-target');
  });

  it('meta 3 taps y límite 45 s', () => {
    expect(level1.action.goal).toBe(3);
    expect(level1.action.timeLimitSec).toBe(45);
  });

  it('velocidad exacta [120, 180] px/s (ordenada)', () => {
    expect(level1.action.target.speedRange).toEqual([120, 180]);
  });

  it('cambio de dirección exacto [800, 1500] ms (ordenado)', () => {
    expect(level1.action.target.dirChangeMs).toEqual([800, 1500]);
  });

  it('hudLabel «Sustos causados»', () => {
    expect(level1.action.hudLabel).toBe('Sustos causados');
  });

  it('texture apunta a la clave planificada de la niña', () => {
    expect(GIRL_TEXTURE_KEY).toBe('girl');
    expect(level1.action.target.texture).toBe('girl');
  });
});

describe('level1 — quiz: pregunta y opciones verbatim de start.md (§4.3)', () => {
  it('pregunta exacta', () => {
    expect(level1.quiz.question).toBe(
      '¿Cómo logra Mr. Hyde evitar ir preso tras el incidente con la niña?',
    );
  });

  it('4 opciones A–D con los textos VERBATIM de start.md', () => {
    expect(level1.quiz.options.map((option) => option.text)).toEqual([
      'Se escapa en un carruaje secreto hacia Francia.',
      'Le da un cheque (firmado por el respetable Dr. Jekyll) al padre y a la familia de la niña para calmar el escándalo.',
      'Soborna al inspector Newcomen con una gema preciosa.',
      'La policía lo confunde con un mendigo y lo deja ir.',
    ]);
  });

  it('exactamente UNA opción correcta, en el índice B (1)', () => {
    const correctIndexes = level1.quiz.options
      .map((option, index) => (option.correct === true ? index : -1))
      .filter((index) => index >= 0);
    expect(correctIndexes).toEqual([1]);
  });

  it('feedback pedagógico no vacío en LAS 4 opciones', () => {
    for (const [index, option] of level1.quiz.options.entries()) {
      expect(option.feedback.trim().length, `opción ${index + 1} sin feedback`).toBeGreaterThan(0);
    }
  });

  it('el feedback de B es el verbatim de start.md (cheque de 100 libras)', () => {
    expect(level1.quiz.options[1].feedback).toBe(
      '¡Correcto! Hyde entrega un cheque por 100 libras firmado por el estimado Dr. Jekyll, revelando la extraña conexión financiera entre ambos.',
    );
  });

  it('los feedbacks de A, C y D son específicos de cada distractor', () => {
    expect(level1.quiz.options[0].feedback).toContain('Utterson');
    expect(level1.quiz.options[2].feedback).toContain('Newcomen');
    expect(level1.quiz.options[3].feedback).toContain('cheque');
  });
});

describe('level1 — storyFragment: el episodio del cheque (SPEC §4.4)', () => {
  const fragment = level1.quiz.storyFragment;

  it('no vacío y con 3–5 oraciones (ritmo de lectura)', () => {
    expect(fragment.trim().length).toBeGreaterThan(0);
    expect(sentenceCount(fragment)).toBeGreaterThanOrEqual(3);
    expect(sentenceCount(fragment)).toBeLessThanOrEqual(5);
  });

  it('contiene los tres ingredientes del episodio: cheque de 100 libras, firma de Jekyll, sospecha de Utterson', () => {
    expect(fragment).toMatch(/cheque/i);
    expect(fragment).toMatch(/cien libras/);
    expect(fragment).toContain('Jekyll');
    expect(fragment).toContain('Utterson');
  });

  it('tono 10+: la niña queda ilesa (violencia sugerida, nunca mostrada — D4)', () => {
    expect(fragment).toContain('ilesa');
    expect(fragment).not.toMatch(/sangre|atropell|pisote|muert/i);
  });
});

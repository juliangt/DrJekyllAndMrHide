/**
 * Etapa 1 (ampliada) — test de los DATOS de los tres niveles y del registro:
 * tipado contra LevelConfig (compila), paneles ≤ 40 palabras con fondos
 * válidos, parámetros exactos de cada mecánica (N1 tap-target, N2
 * cane-strike, N3 transform-target), quiz con 4 opciones del material
 * fuente (B/A/C correctas; la C del N3 adaptada al cómic: la confesión de
 * Jekyll) y feedback en todas, fragmento de historia con el episodio,
 * getLevel e ids únicos, y un guarda de regresión anti-«carta de Lanyon».
 */
import { describe, expect, it } from 'vitest';
import { CANE_TEXTURE_KEY, LANYON_TEXTURE_KEY, level2 } from '../config/levels/level2';
import { GIRL_TEXTURE_KEY, level1 } from '../config/levels/level1';
import { level3 } from '../config/levels/level3';
import { LEVELS, getLevel } from '../config/levels';
import { TEXTURE_DEFS, TEXTURE_KEYS } from '../art/textures';
import type { LoreBackground } from '../config/levels/types';

/** Cuenta palabras de un panel (SPEC §9: máx. ~40). */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---- Narrowing por discriminante (unión `ActionConfig`) ----------------------
//
// Cada nivel declara UNA mecánica: estos guardas lo fijan para el compilador
// (si el config cambia de `mechanic`, falla al cargar el test, no en cada
// `it()`) y documentan qué soporta cada nivel.

if (level1.action.mechanic !== 'tap-target') {
  throw new Error('level1.action debe declarar mechanic "tap-target"');
}
const action1 = level1.action;

if (level2.action.mechanic !== 'cane-strike') {
  throw new Error('level2.action debe declarar mechanic "cane-strike"');
}
const action2 = level2.action;

if (level3.action.mechanic !== 'transform-target') {
  throw new Error('level3.action debe declarar mechanic "transform-target"');
}
const action3 = level3.action;

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
  it('LEVELS contiene los niveles 1–3 en orden y getLevel los devuelve', () => {
    expect(LEVELS.length).toBe(3);
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3]);
    expect(getLevel(1)).toBe(level1);
    expect(getLevel(2)).toBe(level2);
    expect(getLevel(3)).toBe(level3);
  });

  it('getLevel de id inexistente devuelve undefined', () => {
    expect(getLevel(4)).toBeUndefined();
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
    expect(action1.mechanic).toBe('tap-target');
  });

  it('meta 3 taps y límite 45 s', () => {
    expect(action1.goal).toBe(3);
    expect(action1.timeLimitSec).toBe(45);
  });

  it('velocidad exacta [120, 180] px/s (ordenada)', () => {
    expect(action1.target.speedRange).toEqual([120, 180]);
  });

  it('cambio de dirección exacto [800, 1500] ms (ordenado)', () => {
    expect(action1.target.dirChangeMs).toEqual([800, 1500]);
  });

  it('hudLabel «Sustos causados»', () => {
    expect(action1.hudLabel).toBe('Sustos causados');
  });

  it('texture apunta a la clave planificada de la niña', () => {
    expect(GIRL_TEXTURE_KEY).toBe('girl');
    expect(action1.target.texture).toBe('girl');
  });

  it('wiring config↔art: la textura del objetivo EXISTE en el registro procedural', () => {
    // Cruz-check directo (auditoría): la clave declarada como DATO en el
    // nivel debe ser la de la textura generada en BootScene. Si alguien
    // renombra cualquiera de los dos lados, este test lo detecta aquí y no
    // como sprite invisible en runtime.
    expect(action1.target.texture).toBe(TEXTURE_KEYS.girl);
    expect(
      TEXTURE_DEFS.some((def) => def.key === action1.target.texture),
      `TEXTURE_DEFS no genera la clave "${action1.target.texture}"`,
    ).toBe(true);
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

describe('level2 — nivel «El Persecutor del Callejón»', () => {
  it('id 2 y título no vacío', () => {
    expect(level2.id).toBe(2);
    expect(level2.title).toBe('El Persecutor del Callejón');
  });
});

describe('level2 — lore: los 3 paneles del episodio de Lanyon', () => {
  it('tiene exactamente 3 paneles', () => {
    expect(level2.lore.length).toBe(3);
  });

  it('cada panel tiene texto no vacío y ≤ 40 palabras', () => {
    for (const [index, panel] of level2.lore.entries()) {
      expect(panel.text.trim().length, `panel ${index + 1} vacío`).toBeGreaterThan(0);
      expect(wordCount(panel.text), `panel ${index + 1} excede 40 palabras`).toBeLessThanOrEqual(40);
    }
  });

  it('cada panel declara un fondo procedural válido', () => {
    const valid: readonly LoreBackground[] = ['alley', 'lab', 'street'];
    for (const panel of level2.lore) {
      expect(valid).toContain(panel.background);
    }
  });

  it('el arco narrativo del nivel: calle → callejón → callejón', () => {
    expect(level2.lore[0].background).toBe('street');
    expect(level2.lore[1].background).toBe('alley');
    expect(level2.lore[2].background).toBe('alley');
  });

  it('cuenta la bisagra del arco: la fórmula ya vive dentro de Jekyll', () => {
    expect(level2.lore[0].text).toContain('sin beber la poción');
  });

  it('el panel final instruye la mecánica (5 bastonazos)', () => {
    expect(level2.lore[2].text).toContain('5 veces');
  });
});

describe('level2 — action: cane-strike con los parámetros del nivel', () => {
  it('mecánica cane-strike', () => {
    expect(action2.mechanic).toBe('cane-strike');
  });

  it('meta 5 bastonazos y límite 60 s', () => {
    expect(action2.goal).toBe(5);
    expect(action2.timeLimitSec).toBe(60);
  });

  it('velocidad exacta [150, 220] px/s (ordenada y MAYOR que la del N1)', () => {
    expect(action2.target.speedRange).toEqual([150, 220]);
    expect(action2.target.speedRange[0]).toBeGreaterThan(action1.target.speedRange[0]);
    expect(action2.target.speedRange[1]).toBeGreaterThan(action1.target.speedRange[1]);
  });

  it('cambio de dirección exacto [600, 1200] ms (más errático que el N1)', () => {
    expect(action2.target.dirChangeMs).toEqual([600, 1200]);
  });

  it('hudLabel «Bastonazos»', () => {
    expect(action2.hudLabel).toBe('Bastonazos');
  });

  it('el objetivo es el Dr. Lanyon y el bastón es de mango blanco (claves planificadas)', () => {
    expect(LANYON_TEXTURE_KEY).toBe('lanyon');
    expect(action2.target.texture).toBe('lanyon');
    expect(CANE_TEXTURE_KEY).toBe('cane');
    expect(action2.caneTexture).toBe('cane');
    // Fase 2 genera las texturas 'lanyon' y 'cane'; aquí solo se fija la
    // clave como DATO para que config y arte no se desincronicen.
  });

  it('el grito de victoria de Hyde es el de la novela', () => {
    expect(action2.victoryLine).toBe('¡De parte nuestra! Jajajaja.');
  });
});

describe('level2 — quiz: pregunta y opciones verbatim (A correcta)', () => {
  it('pregunta exacta', () => {
    expect(level2.quiz.question).toBe('¿Por qué Hyde mató al Dr. Lanyon?');
  });

  it('4 opciones A–D con los textos VERBATIM del material fuente', () => {
    expect(level2.quiz.options.map((option) => option.text)).toEqual([
      'Porque Lanyon se burló de su experimento diciéndole: ¡Adiós! ¡De parte nuestra!',
      'Porque le debía dinero.',
      'Porque le mató a su perrito.',
      'Porque le quiso dar la mano para saludarlo y Lanyon le hizo «osooo».',
    ]);
  });

  it('exactamente UNA opción correcta, en el índice A (0)', () => {
    const correctIndexes = level2.quiz.options
      .map((option, index) => (option.correct === true ? index : -1))
      .filter((index) => index >= 0);
    expect(correctIndexes).toEqual([0]);
  });

  it('feedback pedagógico no vacío en LAS 4 opciones', () => {
    for (const [index, option] of level2.quiz.options.entries()) {
      expect(option.feedback.trim().length, `opción ${index + 1} sin feedback`).toBeGreaterThan(0);
    }
  });

  it('el feedback de A referencia la novela (Lanyon presenció la transformación)', () => {
    expect(level2.quiz.options[0].feedback).toContain('transformación');
    expect(level2.quiz.options[0].feedback).toContain('callejón');
  });

  it('los feedbacks de B, C y D son específicos de cada distractor', () => {
    expect(level2.quiz.options[1].feedback).toContain('Jekyll');
    expect(level2.quiz.options[2].feedback).toContain('novela');
    expect(level2.quiz.options[3].feedback).toContain('saludo');
  });
});

describe('level2 — storyFragment: el episodio del bastón roto (cómic)', () => {
  const fragment = level2.quiz.storyFragment;

  it('no vacío y con 3–5 oraciones (ritmo de lectura)', () => {
    expect(fragment.trim().length).toBeGreaterThan(0);
    expect(sentenceCount(fragment)).toBeGreaterThanOrEqual(3);
    expect(sentenceCount(fragment)).toBeLessThanOrEqual(5);
  });

  it('contiene los tres ingredientes del episodio: calle nevada, bastón roto, conexión con Jekyll', () => {
    expect(fragment).toContain('nieve');
    expect(fragment).toContain('bastón');
    expect(fragment).toContain('roto');
    expect(fragment).toContain('Utterson');
    expect(fragment).toContain('Jekyll');
  });

  it('alineado al cómic: SIN carta de Lanyon (Lanyon muere sin dejar documento)', () => {
    expect(fragment).not.toMatch(/carta/i);
    expect(fragment).not.toMatch(/sobre sellado/i); // el sobre sellado es del N3 (confesión de Jekyll)
  });

  it('tono 10+: el episodio se narra sin mostrar violencia (D4)', () => {
    expect(fragment).not.toMatch(/sangre|atropell|pisote|muert/i);
  });
});

describe('level3 — nivel «El Asedio al Laboratorio»', () => {
  it('id 3 y título no vacío', () => {
    expect(level3.id).toBe(3);
    expect(level3.title).toBe('El Asedio al Laboratorio');
  });
});

describe('level3 — lore: los 3 paneles del episodio final', () => {
  it('tiene exactamente 3 paneles', () => {
    expect(level3.lore.length).toBe(3);
  });

  it('cada panel tiene texto no vacío y ≤ 40 palabras', () => {
    for (const [index, panel] of level3.lore.entries()) {
      expect(panel.text.trim().length, `panel ${index + 1} vacío`).toBeGreaterThan(0);
      expect(wordCount(panel.text), `panel ${index + 1} excede 40 palabras`).toBeLessThanOrEqual(40);
    }
  });

  it('cada panel declara un fondo procedural válido', () => {
    const valid: readonly LoreBackground[] = ['alley', 'lab', 'street'];
    for (const panel of level3.lore) {
      expect(valid).toContain(panel.background);
    }
  });

  it('el arco narrativo del nivel: calle → calle → laboratorio', () => {
    expect(level3.lore[0].background).toBe('street');
    expect(level3.lore[1].background).toBe('street');
    expect(level3.lore[2].background).toBe('lab');
  });

  it('presenta a Poole y Utterson forzando la puerta', () => {
    expect(level3.lore[1].text).toContain('Poole');
    expect(level3.lore[1].text).toContain('Utterson');
  });

  it('el panel final instruye la mecánica (6 golpes y la transformación)', () => {
    expect(level3.lore[2].text).toContain('6 veces');
    expect(level3.lore[2].text).toContain('3 segundos');
  });
});

describe('level3 — action: transform-target con los parámetros del nivel', () => {
  it('mecánica transform-target', () => {
    expect(action3.mechanic).toBe('transform-target');
  });

  it('meta 6 golpes a Hyde y límite 90 s', () => {
    expect(action3.goal).toBe(6);
    expect(action3.timeLimitSec).toBe(90);
  });

  it('revertMs 3000: tras cada golpe Hyde es Jekyll (invulnerable) 3 s', () => {
    expect(action3.revertMs).toBe(3000);
  });

  it('velocidad exacta [110, 170] px/s (ordenada)', () => {
    expect(action3.target.speedRange).toEqual([110, 170]);
  });

  it('cambio de dirección exacto [700, 1300] ms (ordenado)', () => {
    expect(action3.target.dirChangeMs).toEqual([700, 1300]);
  });

  it('hudLabel «Golpes a Hyde»', () => {
    expect(action3.hudLabel).toBe('Golpes a Hyde');
  });

  it('wiring config↔art: las dos caras del objetivo EXISTEN en el registro procedural', () => {
    // A diferencia de 'lanyon'/'cane' (Fase 2), 'hyde' y 'jekyll' ya se
    // generan en BootScene (intro): el cross-check directo aplica hoy.
    expect(action3.target.textureHyde).toBe(TEXTURE_KEYS.hyde);
    expect(action3.target.textureJekyll).toBe(TEXTURE_KEYS.jekyll);
    for (const texture of [action3.target.textureHyde, action3.target.textureJekyll]) {
      expect(
        TEXTURE_DEFS.some((def) => def.key === texture),
        `TEXTURE_DEFS no genera la clave "${texture}"`,
      ).toBe(true);
    }
  });
});

describe('level3 — quiz: pregunta y opciones verbatim (C correcta)', () => {
  it('pregunta exacta', () => {
    expect(level3.quiz.question).toBe('¿De qué forma el Dr. Jekyll confiesa que él es Hyde?');
  });

  it('4 opciones A–D con los textos del material fuente (C adaptada al cómic: la confesión de Jekyll)', () => {
    expect(level3.quiz.options.map((option) => option.text)).toEqual([
      'En un interrogatorio policial.',
      'Se lo dice en secreto a Poole y este se lo cuenta a todo el mundo.',
      'Mediante una confesión escrita por él mismo, hallada en un sobre sellado en el laboratorio.',
      'Lo cuenta por TikTok.',
    ]);
  });

  it('exactamente UNA opción correcta, en el índice C (2)', () => {
    const correctIndexes = level3.quiz.options
      .map((option, index) => (option.correct === true ? index : -1))
      .filter((index) => index >= 0);
    expect(correctIndexes).toEqual([2]);
  });

  it('feedback pedagógico no vacío en LAS 4 opciones', () => {
    for (const [index, option] of level3.quiz.options.entries()) {
      expect(option.feedback.trim().length, `opción ${index + 1} sin feedback`).toBeGreaterThan(0);
    }
  });

  it('el feedback de C referencia el sobre sellado con la confesión que explica el tormento (sin carta de Lanyon)', () => {
    expect(level3.quiz.options[2].feedback).toContain('confesión');
    expect(level3.quiz.options[2].feedback).toContain('sobre sellado');
    expect(level3.quiz.options[2].feedback).not.toContain('Lanyon');
  });

  it('los feedbacks de A, B y D son específicos de cada distractor', () => {
    expect(level3.quiz.options[0].feedback).toContain('puerta');
    expect(level3.quiz.options[1].feedback).toContain('Poole');
    expect(level3.quiz.options[3].feedback).toContain('188X');
  });
});

describe('level3 — storyFragment: el episodio del sobre sellado con la confesión (cómic)', () => {
  const fragment = level3.quiz.storyFragment;

  it('no vacío y con 3–5 oraciones (ritmo de lectura)', () => {
    expect(fragment.trim().length).toBeGreaterThan(0);
    expect(sentenceCount(fragment)).toBeGreaterThanOrEqual(3);
    expect(sentenceCount(fragment)).toBeLessThanOrEqual(5);
  });

  it('contiene los ingredientes del episodio: Poole y Utterson entran, un único sobre con la confesión de Jekyll, la verdad para el lector', () => {
    expect(fragment).toContain('Poole');
    expect(fragment).toContain('Utterson');
    expect(fragment).toContain('Newcomen');
    expect(fragment).toMatch(/un único sobre/);
    expect(fragment).toContain('confesión');
    expect(fragment).toContain('Jekyll');
  });

  it('alineado al cómic: UNA sola confesión (sin carta de Lanyon) y el cuerpo de Jekyll desaparece', () => {
    expect(fragment).not.toMatch(/Lanyon/i);
    expect(fragment).not.toMatch(/dos documentos|dos cartas/);
    expect(fragment).toContain('rastro'); // del doctor Jekyll no queda rastro
  });

  it('tono 10+: el final se narra sin mostrar violencia (D4)', () => {
    expect(fragment).not.toMatch(/sangre|atropell|pisote|muert/i);
  });
});

describe('guard de regresión — alineación al cómic: NO existe carta de Lanyon', () => {
  /**
   * Fuente de verdad (el cómic): Lanyon muere ASESINADO a bastonazos por
   * Hyde en una calle nevada y NO deja ningún documento. La única carta
   * dirigida a Utterson es la «Confesión Completa de Henry Jekyll», hallada
   * en un sobre sellado en el laboratorio (N3). Este guarda recorre TODO
   * texto de los niveles y prohíbe que la «carta de Lanyon» vuelva a
   * colarse (ni como «carta del doctor Lanyon» ni variantes).
   */
  const levelTexts: readonly string[] = LEVELS.flatMap((level) => [
    level.title,
    ...level.lore.map((panel) => panel.text),
    level.action.hudLabel,
    ...(level.action.mechanic === 'cane-strike' ? [level.action.victoryLine] : []),
    level.quiz.question,
    ...level.quiz.options.flatMap((option) => [option.text, option.feedback]),
    level.quiz.storyFragment,
  ]);

  it('el guarda recorre los textos de los 3 niveles (lore + quiz + fragmentos)', () => {
    expect(levelTexts.length).toBeGreaterThanOrEqual(3 * 10);
  });

  it('ningún texto de nivel menciona la «carta de Lanyon» / «carta del doctor Lanyon»', () => {
    const pattern = /carta\s+(de|del)\s+(doctor\s+|dr\.\s*)?lanyon/i;
    for (const [index, text] of levelTexts.entries()) {
      expect(pattern.test(text), `el texto ${index} menciona una carta de Lanyon: «${text}»`).toBe(false);
    }
  });
});

/**
 * Etapa 3 — test de la LÓGICA y los DATOS de la fase narrativa
 * (`src/config/narrative.ts`, todo puro sin Phaser):
 *
 *  - `activeLevelFor`: nivel activo por scene-start data (default 1, fallback
 *    grácil ante ids desconocidos).
 *  - `narrativeProgress`: avance secuencial por tap, tap en el último → done,
 *    skip → done inmediato, idempotencia y JAMÁS índice fuera de rango.
 *  - `parseLoreSegments` / `stripLoreMarkers`: parser de **negritas** de la
 *    instrucción del panel 4 (SPEC §4.1).
 *  - `panelTextLayout` + `NARRATIVE_PANEL_LAYOUT`: el wrap SIN Phaser — los
 *    4 paneles REALES de level1 caben en el pergamino; un texto largo
 *    artificial NO (el detector de desborde funciona); el wrap es greedy
 *    correcto y no pierde palabras.
 *  - Layout/estilos: dimensiones coherentes con 720×1280, padding ≥ estándar
 *    táctil, colores de la paleta y contraste WCAG ≥ 4.5 (SPEC §9).
 *  - `LORE_BACKGROUNDS`: cubre los 3 tipos de fondo, sólo texturas
 *    registradas y colores de la paleta, composición válida (slots en lienzo,
 *    alfas de niebla, farolas en exteriores, mesa+frascos en el laboratorio).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LORE_BACKGROUNDS,
  NARRATIVE_INTRO_RETOLD_PANELS,
  NARRATIVE_PANEL_LAYOUT,
  NARRATIVE_PANEL_STYLE,
  NARRATIVE_SCENE_LAYOUT,
  NARRATIVE_SKIP_BUTTON,
  NARRATIVE_TEXT_STYLE,
  NarrativeAction,
  activeLevelFor,
  initialNarrativeState,
  narrativeProgress,
  narrativeStartIndex,
  panelMaxLines,
  panelTextHeight,
  panelTextLayout,
  panelTextWidth,
  parseLoreSegments,
  progressLabel,
  stripLoreMarkers,
  type LoreBackgroundDef,
  type NarrativeProgressState,
} from '../config/narrative';
import { level1 } from '../config/levels/level1';
import { LEVELS } from '../config/levels';
import type { LoreBackground } from '../config/levels/types';
import type { ParallaxLayer } from '../art/parallax';
import { TEXTURE_KEYS } from '../art/textures';
import { PALETTE, type HexColor } from '../config/palette';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { MIN_TOUCH_HEIGHT, type ButtonLayout } from '../ui/buttonState';

const { Tap, Skip, Back } = NarrativeAction;

/** Palabras de un texto (misma métrica que levels.test). */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

describe('activeLevelFor — nivel activo de la escena (scene-start data)', () => {
  it('sin levelId: el Nivel 1 por defecto', () => {
    expect(activeLevelFor(undefined)).toBe(level1);
  });

  it('levelId 1: el Nivel 1 explícito', () => {
    expect(activeLevelFor(1)).toBe(level1);
  });

  it('levelId desconocido: cae al primer nivel registrado (degrada sin romper)', () => {
    expect(activeLevelFor(99)).toBe(LEVELS[0]);
  });
});

describe('narrativeProgress — máquina de progresión de paneles', () => {
  it('estado inicial: index 0, done false', () => {
    expect(initialNarrativeState(4)).toEqual({ index: 0, total: 4, done: false });
  });

  it('avance secuencial: 3 taps recorren los 4 paneles del Nivel 1 (0→3)', () => {
    let state = initialNarrativeState(4);
    const indexes: number[] = [];
    for (let i = 0; i < 3; i++) {
      state = narrativeProgress(state, Tap);
      indexes.push(state.index);
    }
    expect(indexes).toEqual([1, 2, 3]);
    expect(state.done).toBe(false);
  });

  it('el tap EN el último panel termina la narrativa (done) y congela el índice', () => {
    let state = initialNarrativeState(4);
    for (let i = 0; i < 3; i++) {
      state = narrativeProgress(state, Tap);
    }
    state = narrativeProgress(state, Tap); // tap sobre el panel 4/4
    expect(state).toEqual({ index: 3, total: 4, done: true });
  });

  it('skip desde el PRIMER panel: done inmediato sin mover el índice', () => {
    const state = narrativeProgress(initialNarrativeState(4), Skip);
    expect(state).toEqual({ index: 0, total: 4, done: true });
  });

  it('skip a mitad de narrativa: done inmediato conservando el panel actual', () => {
    let state = initialNarrativeState(4);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Skip);
    expect(state).toEqual({ index: 1, total: 4, done: true });
  });

  it('con done, taps y skips extra NO cambian nada (idempotente)', () => {
    let state = narrativeProgress(initialNarrativeState(4), Skip);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Skip);
    expect(state.done).toBe(true);
    expect(state.index).toBe(0);
  });

  it('NUNCA devuelve un índice fuera de [0, total-1] (propiedad con secuencia larga)', () => {
    let state = initialNarrativeState(4);
    for (let i = 0; i < 50; i++) {
      state = narrativeProgress(state, Tap);
      expect(state.index).toBeGreaterThanOrEqual(0);
      expect(state.index).toBeLessThanOrEqual(state.total - 1);
    }
    expect(state.done).toBe(true);
  });

  it('mezcla taps y skip: el índice sigue acotado', () => {
    let state = initialNarrativeState(4);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Skip);
    expect(state.index).toBeLessThan(state.total);
    expect(state.done).toBe(true);
  });

  it('narrativa de UN panel: el primer tap ya termina', () => {
    let state = initialNarrativeState(1);
    state = narrativeProgress(state, Tap);
    expect(state).toEqual({ index: 0, total: 1, done: true });
  });

  it('total inválido (0 o negativo) se clampa a 1', () => {
    expect(initialNarrativeState(0).total).toBe(1);
    expect(initialNarrativeState(-3).total).toBe(1);
  });

  it('back (flecha «atrás»): retrocede un panel sin tocar done', () => {
    let state = initialNarrativeState(4);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Back);
    expect(state).toEqual({ index: 1, total: 4, done: false });
  });

  it('back en el PRIMER panel: idempotente (no hay «antes del primero»)', () => {
    let state = initialNarrativeState(4);
    state = narrativeProgress(state, Back);
    state = narrativeProgress(state, Back);
    expect(state).toEqual({ index: 0, total: 4, done: false });
  });

  it('back tras done: no hace nada (idempotente como toda acción con done)', () => {
    let state = initialNarrativeState(4);
    for (let i = 0; i < 3; i++) {
      state = narrativeProgress(state, Tap);
    }
    state = narrativeProgress(state, Tap); // done
    state = narrativeProgress(state, Back);
    expect(state).toEqual({ index: 3, total: 4, done: true });
  });

  it('adelante y atrás alternados recorren los paneles sin salir de rango', () => {
    let state = initialNarrativeState(4);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Back);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Tap);
    expect(state.index).toBe(3);
    expect(state.done).toBe(false);
  });

  it('estado inicial con startIndex: la intro salta los paneles que YA contó', () => {
    // La cinemática reproduce los paneles 1–3 del Nivel 1: desde la intro se
    // arranca en el 4 («Es hora del susto»); el indicador lo deja claro.
    expect(initialNarrativeState(4, narrativeStartIndex(true, 4))).toEqual({
      index: 3,
      total: 4,
      done: false,
    });
  });
});

describe('narrativeStartIndex — arranque de la narrativa según el origen', () => {
  it('sin intro: arranca en el primer panel (el libro completo)', () => {
    expect(narrativeStartIndex(false, 4)).toBe(0);
    expect(narrativeStartIndex(false, 1)).toBe(0);
  });

  it('desde la intro: salta los paneles que la cinemática ya contó (1–3)', () => {
    expect(narrativeStartIndex(true, 4)).toBe(NARRATIVE_INTRO_RETOLD_PANELS);
    expect(narrativeStartIndex(true, 4)).toBe(3);
  });

  it('NUNCA sale del rango: con menos paneles que los contados, cae en el último', () => {
    expect(narrativeStartIndex(true, 1)).toBe(0);
    expect(narrativeStartIndex(true, 3)).toBe(2);
    expect(narrativeStartIndex(true, 0)).toBe(0);
  });
});

describe('fromIntro — SOLO la cinemática lo pasa (Fase 4: N2/N3 arrancan SIEMPRE en panel 0)', () => {
  const readSource = (relativePath: string): string =>
    readFileSync(resolve(process.cwd(), relativePath), 'utf8');

  it('NarrativeScene decide el arranque por scene-start data (fromIntro ?? false → panel 0 por defecto)', () => {
    const sceneSource = readSource('src/scenes/NarrativeScene.ts');
    expect(sceneSource).toContain('narrativeStartIndex(data.fromIntro ?? false, total)');
  });

  it('la ÚNICA salida con fromIntro es el cierre de IntroScene, vía la función pura introNarrativePayload (fromIntro true solo para N1 — Fase 5)', () => {
    expect(readSource('src/scenes/IntroScene.ts')).toContain(
      'wipeTo(this, SceneKey.NARRATIVE, introNarrativePayload(data.levelId))',
    );
    // La decisión (fromIntro true SOLO para el nivel 1) vive en config/intro.
    expect(readSource('src/config/intro.ts')).toContain(
      'fromIntro: target === INTRO_TARGET_LEVEL_ID',
    );
  });

  it('ninguna OTRA escena pasa fromIntro: la narrativa de N2/N3 (quiz→N, continuar) empieza completa', () => {
    for (const scene of ['MenuScene', 'ActionScene', 'QuizScene', 'VictoryScene']) {
      expect(readSource(`src/scenes/${scene}.ts`), scene).not.toContain('fromIntro');
    }
  });
});

describe('progressLabel — indicador «1/4 … 4/4» (SPEC §6)', () => {
  it('recorre 1/4 → 4/4 con los taps del Nivel 1', () => {
    let state: NarrativeProgressState = initialNarrativeState(4);
    const labels = [progressLabel(state)];
    for (let i = 0; i < 4; i++) {
      state = narrativeProgress(state, Tap);
      labels.push(progressLabel(state));
    }
    expect(labels).toEqual(['1/4', '2/4', '3/4', '4/4', '4/4']);
  });

  it('tras skip desde el panel 2 muestra «2/4» (panel por el que iba)', () => {
    let state = initialNarrativeState(4);
    state = narrativeProgress(state, Tap);
    state = narrativeProgress(state, Skip);
    expect(progressLabel(state)).toBe('2/4');
  });
});

describe('parseLoreSegments — parser de **negritas** (SPEC §4.1)', () => {
  it('texto sin marcadores: un único tramo plano', () => {
    expect(parseLoreSegments('Londres, 188X. La niebla…')).toEqual([
      { text: 'Londres, 188X. La niebla…', bold: false },
    ]);
  });

  it('el panel 4 del Nivel 1 lleva la instrucción como tramo enfatizado', () => {
    const segments = parseLoreSegments(level1.lore[3].text);
    expect(segments.length).toBe(2);
    expect(segments[0].bold).toBe(false);
    expect(segments[1].bold).toBe(true);
    expect(segments[1].text).toContain('Tócala 3 veces');
  });

  it('stripLoreMarkers devuelve el texto plano (los marcadores NO se pintan)', () => {
    const plain = stripLoreMarkers(level1.lore[3].text);
    expect(plain).not.toContain('**');
    expect(plain).toBe('«Es hora del susto», susurra Hyde. Tócala 3 veces antes de que la niebla lo cubra todo.');
  });

  it('marcador sin cerrar: el resto queda enfatizado, sin lanzar error', () => {
    const segments = parseLoreSegments('plano **énfasis sin cierre');
    expect(segments).toEqual([
      { text: 'plano ', bold: false },
      { text: 'énfasis sin cierre', bold: true },
    ]);
  });

  it('texto vacío: un tramo vacío (nunca array vacío)', () => {
    expect(parseLoreSegments('')).toEqual([{ text: '', bold: false }]);
  });
});

describe('panelTextLayout — wrap puro y detector de desborde', () => {
  /** Ancho estimado por carácter según el layout (misma fórmula del módulo). */
  const charPx = NARRATIVE_PANEL_LAYOUT.fontSize *
    NARRATIVE_PANEL_LAYOUT.charWidthFactor *
    NARRATIVE_PANEL_LAYOUT.wrapSafetyFactor;
  const maxWidth = panelTextWidth(NARRATIVE_PANEL_LAYOUT);

  it('áreas del panel: ancho/alto de texto derivados del layout', () => {
    expect(panelTextWidth(NARRATIVE_PANEL_LAYOUT)).toBe(
      NARRATIVE_PANEL_LAYOUT.panelWidth - 2 * NARRATIVE_PANEL_LAYOUT.padding,
    );
    expect(panelTextHeight(NARRATIVE_PANEL_LAYOUT)).toBe(
      NARRATIVE_PANEL_LAYOUT.panelHeight - 2 * NARRATIVE_PANEL_LAYOUT.padding,
    );
  });

  it('CA: los 4 paneles REALES del Nivel 1 caben en el pergamino por defecto', () => {
    for (const [index, panel] of level1.lore.entries()) {
      const layout = panelTextLayout(panel.text);
      expect(layout.fits, `panel ${index + 1} no cabe: ${layout.lineCount} líneas`).toBe(true);
      expect(layout.lineCount).toBeGreaterThanOrEqual(1);
      expect(layout.lineCount).toBeLessThanOrEqual(panelMaxLines(NARRATIVE_PANEL_LAYOUT));
      expect(layout.widestLinePx).toBeLessThanOrEqual(maxWidth);
    }
  });

  it('el wrap ENVUELVE de verdad: cada panel real ocupa más de una línea', () => {
    for (const panel of level1.lore) {
      expect(panelTextLayout(panel.text).lineCount).toBeGreaterThan(1);
    }
  });

  it('sin pérdida de palabras: las líneas reconstruidas son el texto plano', () => {
    for (const panel of level1.lore) {
      const layout = panelTextLayout(panel.text);
      const rebuilt = layout.lines
        .map((line) => line.words.map((word) => word.text).join(' '))
        .join(' ');
      expect(rebuilt).toBe(stripLoreMarkers(panel.text));
    }
  });

  it('wrap greedy: cada línea (salvo la última) está llena hasta el límite', () => {
    const layout = panelTextLayout(level1.lore[1].text);
    for (let i = 0; i < layout.lines.length - 1; i++) {
      const line = layout.lines[i];
      const nextWord = layout.lines[i + 1].words[0];
      const linePx = line.words.reduce(
        (sum, word, index) =>
          sum + word.text.length * charPx + (index > 0 ? charPx : 0),
        0,
      );
      expect(linePx).toBeLessThanOrEqual(maxWidth);
      expect(linePx + charPx + nextWord.text.length * charPx).toBeGreaterThan(maxWidth);
    }
  });

  it('el énfasis viaja con las palabras: las líneas conservan el flag bold', () => {
    const layout = panelTextLayout(level1.lore[3].text);
    const boldWords = layout.lines.flatMap((line) => line.words.filter((w) => w.bold));
    expect(boldWords.length).toBeGreaterThan(0);
    expect(boldWords.map((w) => w.text).join(' ')).toContain('Tócala 3 veces');
  });

  it('DETECTOR: un texto largo artificial NO cabe (el límite funciona)', () => {
    const artificial =
      'Esta es una viñeta artificial larguísima que enumera muchísimos detalles ' +
      'innecesarios sobre la niebla, los faroles, los adoquines, las chimeneas y ' +
      'los gatos del callejón solo para demostrar que el detector de desborde ' +
      'del layout de panel se entera cuando un texto excede el pergamino.';
    expect(wordCount(artificial)).toBeGreaterThan(40);
    const layout = panelTextLayout(artificial);
    expect(layout.fits).toBe(false);
    expect(layout.lineCount).toBeGreaterThan(panelMaxLines(NARRATIVE_PANEL_LAYOUT));
  });

  it('DETECTOR: una única palabra más ancha que el área NO cabe', () => {
    const layout = panelTextLayout('Supercalifragilsticoespialidoso'.repeat(4));
    expect(layout.lineCount).toBe(1);
    expect(layout.widestLinePx).toBeGreaterThan(maxWidth);
    expect(layout.fits).toBe(false);
  });

  it('la estimación es conservadora: el ancho estimado por línea ≤ área', () => {
    for (const panel of level1.lore) {
      const layout = panelTextLayout(panel.text);
      for (const line of layout.lines) {
        const linePx = line.words.reduce(
          (sum, word, index) =>
            sum + word.text.length * charPx + (index > 0 ? charPx : 0),
          0,
        );
        expect(linePx).toBeLessThanOrEqual(maxWidth);
      }
    }
  });
});

describe('NARRATIVE_PANEL_LAYOUT — dimensiones coherentes con 720×1280 (SPEC §9)', () => {
  it('el panel cabe en el lienzo con su margen declarado', () => {
    const { panelWidth, marginX } = NARRATIVE_PANEL_LAYOUT;
    expect(marginX).toBeGreaterThanOrEqual(24);
    expect(2 * marginX + panelWidth).toBeLessThanOrEqual(BASE_WIDTH);
  });

  it('el panel cabe verticalmente en su posición de escena', () => {
    const { panelCenter } = NARRATIVE_SCENE_LAYOUT;
    const top = panelCenter.y - NARRATIVE_PANEL_LAYOUT.panelHeight / 2;
    const bottom = panelCenter.y + NARRATIVE_PANEL_LAYOUT.panelHeight / 2;
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  it('padding del pergamino ≥ estándar táctil (44 px)', () => {
    expect(NARRATIVE_PANEL_LAYOUT.padding).toBeGreaterThanOrEqual(44);
  });

  it('cuerpo legible infantil: fuente ≥ 32 px con interlineado holgado', () => {
    expect(NARRATIVE_PANEL_LAYOUT.fontSize).toBeGreaterThanOrEqual(32);
    expect(NARRATIVE_PANEL_LAYOUT.lineHeightPx).toBeGreaterThanOrEqual(
      NARRATIVE_PANEL_LAYOUT.fontSize * 1.3,
    );
  });

  it('holgura real: el panel admite al menos 5 líneas (los reales usan ≤ 5)', () => {
    expect(panelMaxLines(NARRATIVE_PANEL_LAYOUT)).toBeGreaterThanOrEqual(5);
  });

  it('el factor de seguridad sobredimensiona el ancho (wrap conservador)', () => {
    expect(NARRATIVE_PANEL_LAYOUT.wrapSafetyFactor).toBeGreaterThan(1);
    expect(NARRATIVE_PANEL_LAYOUT.charWidthFactor).toBeGreaterThan(0.4);
  });
});

describe('Estilos — paleta y contraste (SPEC §7.1/§9)', () => {
  /** Luminancia relativa WCAG de un hex. */
  function luminance(hex: HexColor): number {
    const value = Number.parseInt(hex.slice(1), 16);
    const channel = (shift: number): number => {
      const c = ((value >> shift) & 0xff) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  }

  /** Ratio de contraste WCAG entre dos hex de la paleta. */
  function contrast(a: HexColor, b: HexColor): number {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  }

  const paletteValues = new Set<string>(Object.values(PALETTE));

  it('todos los colores del panel y del texto son de la paleta', () => {
    for (const color of [
      NARRATIVE_PANEL_STYLE.fill,
      NARRATIVE_PANEL_STYLE.stroke,
      NARRATIVE_TEXT_STYLE.color,
      NARRATIVE_TEXT_STYLE.emphasisColor,
    ]) {
      expect(paletteValues.has(color as HexColor), `${color} no está en la paleta`).toBe(true);
    }
  });

  it('el cuerpo del texto contrasta ≥ 4.5:1 sobre el pergamino oscuro', () => {
    expect(contrast(NARRATIVE_TEXT_STYLE.color, NARRATIVE_PANEL_STYLE.fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('el énfasis (instrucción) también contrasta ≥ 4.5:1', () => {
    expect(
      contrast(NARRATIVE_TEXT_STYLE.emphasisColor, NARRATIVE_PANEL_STYLE.fill),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('el marco del panel es un pergamino OSCURO con borde claro (SPEC §6/§7.2)', () => {
    expect(luminance(NARRATIVE_PANEL_STYLE.fill)).toBeLessThan(
      luminance(NARRATIVE_PANEL_STYLE.stroke),
    );
  });

  it('tipografías del SPEC §7.3 con fallback serif', () => {
    expect(NARRATIVE_TEXT_STYLE.fontFamily).toContain('Crimson Text');
    expect(NARRATIVE_TEXT_STYLE.fontFamily).toContain('Georgia');
  });
});

describe('NARRATIVE_SKIP_BUTTON — «Saltar» táctil (SPEC §6/§9)', () => {
  it('etiqueta exacta', () => {
    expect(NARRATIVE_SKIP_BUTTON.label).toBe('Saltar');
  });

  it('layout completo como ButtonLayout con los 3 estados', () => {
    const layout: ButtonLayout = NARRATIVE_SKIP_BUTTON.layout;
    expect(Object.keys(layout.states).sort()).toEqual(['hover', 'idle', 'pressed']);
    for (const state of Object.values(layout.states)) {
      expect(state).toHaveProperty('fill');
      expect(state).toHaveProperty('stroke');
      expect(state).toHaveProperty('text');
    }
  });

  it('alto ≥ 64 px (estándar táctil, SPEC §9)', () => {
    expect(NARRATIVE_SKIP_BUTTON.layout.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
  });

  it('colores por estado desde la paleta', () => {
    const paletteValues = new Set<string>(Object.values(PALETTE));
    for (const state of Object.values(NARRATIVE_SKIP_BUTTON.layout.states)) {
      for (const color of [state.fill, state.stroke, state.text]) {
        expect(paletteValues.has(color as HexColor), `${color}`).toBe(true);
      }
    }
  });

  it('posicionado dentro del lienzo con margen cómodo', () => {
    const { skipButton } = NARRATIVE_SCENE_LAYOUT;
    const half = NARRATIVE_SKIP_BUTTON.layout.minWidth / 2;
    expect(skipButton.x - half).toBeGreaterThanOrEqual(24);
    expect(skipButton.x + half).toBeLessThanOrEqual(BASE_WIDTH - 24);
    expect(skipButton.y - NARRATIVE_SKIP_BUTTON.layout.height / 2).toBeGreaterThanOrEqual(24);
  });
});

describe('NARRATIVE_SCENE_LAYOUT — composición de la escena', () => {
  it('el panel y la UI viven dentro del lienzo con profundidades ordenadas', () => {
    const { panelCenter, depths } = NARRATIVE_SCENE_LAYOUT;
    expect(panelCenter.x).toBe(BASE_WIDTH / 2);
    expect(depths.panel).toBeGreaterThan(9); // sobre el fondo (capas 1–7 + velo 9)
    expect(depths.ui).toBeGreaterThan(depths.panel);
  });

  it('el indicador de progreso cae en la esquina superior izquierda', () => {
    const { progress } = NARRATIVE_SCENE_LAYOUT;
    expect(progress.x).toBeGreaterThan(0);
    expect(progress.x).toBeLessThan(BASE_WIDTH / 2);
    expect(progress.y).toBeGreaterThan(0);
    expect(progress.y).toBeLessThan(200);
  });

  it('las flechas del costado caen a CADA lado, en la banda sobre el panel (táctil ≥ 64 px)', () => {
    const { nav, panelCenter, depths } = NARRATIVE_SCENE_LAYOUT;
    // Una a cada costado, simétricas respecto del centro.
    expect(nav.marginX).toBeGreaterThan(0);
    expect(nav.marginX).toBeLessThan(BASE_WIDTH / 2 - 32);
    // En la banda del fondo: bajo la UI superior, sobre el borde del panel.
    expect(nav.y).toBeGreaterThan(200);
    expect(nav.y).toBeLessThan(panelCenter.y - NARRATIVE_PANEL_LAYOUT.panelHeight / 2);
    // Escala 0.9 sobre la textura 64×96 ≈ 86 px de alto (táctil ≥ 64 px).
    expect(nav.scale * 96).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
    expect(nav.disabledAlpha).toBeGreaterThanOrEqual(0);
    expect(nav.disabledAlpha).toBeLessThan(0.5);
    expect(nav.pressedScale).toBeGreaterThan(0);
    expect(nav.pressedScale).toBeLessThan(1);
    // La flecha vive con la UI (encima del panel y de la capa de tap).
    expect(depths.ui).toBeGreaterThan(depths.panel);
  });
});

describe('LORE_BACKGROUNDS — tabla de fondos por viñeta', () => {
  const registeredTextures = new Set<string>(Object.values(TEXTURE_KEYS));
  const paletteValues = new Set<string>(Object.values(PALETTE));
  const entries = Object.entries(LORE_BACKGROUNDS) as Array<[LoreBackground, LoreBackgroundDef]>;

  it('cubre EXACTAMENTE los 3 tipos de LoreBackground', () => {
    expect(Object.keys(LORE_BACKGROUNDS).sort()).toEqual(['alley', 'lab', 'street']);
  });

  it('los 4 paneles reales del Nivel 1 piden fondos en el orden del SPEC §4.1', () => {
    expect(level1.lore.map((panel) => panel.background)).toEqual([
      'street',
      'lab',
      'alley',
      'alley',
    ]);
    for (const panel of level1.lore) {
      expect(LORE_BACKGROUNDS[panel.background]).toBeDefined();
    }
  });

  it('cada fondo declara un color base de la paleta', () => {
    for (const [type, def] of entries) {
      expect(paletteValues.has(def.backgroundColor), `${type}.backgroundColor`).toBe(true);
    }
  });

  it('los exteriores tienen ESTRELLAS en la banda de cielo; el laboratorio (interior) no', () => {
    expect(LORE_BACKGROUNDS.street.stars?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(LORE_BACKGROUNDS.alley.stars?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(LORE_BACKGROUNDS.lab.stars).toBeUndefined();
    for (const [type, def] of entries) {
      for (const star of def.stars ?? []) {
        // Dentro del lienzo y arriba de las siluetas (banda de cielo).
        expect(star.x, `${type} star.x`).toBeGreaterThan(0);
        expect(star.x, `${type} star.x`).toBeLessThan(BASE_WIDTH);
        expect(star.y, `${type} star.y`).toBeGreaterThan(0);
        expect(star.y, `${type} star.y`).toBeLessThan(400);
        expect(star.scale, `${type} star.scale`).toBeGreaterThan(0);
        // Alfa base del titileo: visible pero tenue (no strobo).
        expect(star.alpha, `${type} star.alpha`).toBeGreaterThan(0);
        expect(star.alpha, `${type} star.alpha`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('las capas usan SOLO texturas registradas y tintes de la paleta', () => {
    for (const [type, def] of entries) {
      expect(def.layers.length, `${type} sin capas`).toBeGreaterThan(0);
      for (const layer of def.layers) {
        expect(
          registeredTextures.has(layer.key),
          `${type}: ${layer.key} no está en TEXTURE_KEYS`,
        ).toBe(true);
        if (layer.tint) {
          expect(paletteValues.has(layer.tint), `${type}: tinte ${layer.tint}`).toBe(true);
        }
      }
    }
  });

  it('alfas válidas y niebla tenue (≤ 0.3, SPEC §7.2)', () => {
    for (const [type, def] of entries) {
      for (const layer of def.layers) {
        expect(layer.alpha, `${type}/${layer.key}`).toBeGreaterThan(0);
        expect(layer.alpha, `${type}/${layer.key}`).toBeLessThanOrEqual(1);
        if (layer.key === TEXTURE_KEYS.fog) {
          expect(layer.alpha, `${type}: niebla muy opaca`).toBeLessThanOrEqual(0.3);
        }
      }
    }
  });

  it('capas ordenadas por profundidad, sin empates (lejos → cerca)', () => {
    for (const [type, def] of entries) {
      const depths = def.layers.map((layer) => layer.depth);
      expect(depths, type).toEqual([...depths].sort((a, b) => a - b));
      expect(new Set(depths).size, type).toBe(depths.length);
    }
  });

  it('los slots caen en el lienzo base (con holgura de deriva)', () => {
    for (const [type, def] of entries) {
      for (const layer of def.layers) {
        for (const slot of layer.slots) {
          expect(slot.y, `${type}`).toBeGreaterThanOrEqual(0);
          expect(slot.y, `${type}`).toBeLessThanOrEqual(BASE_HEIGHT);
          expect(slot.scale, `${type}`).toBeGreaterThan(0);
          expect(slot.x + layer.drift.amplitude, `${type}`).toBeGreaterThan(0);
          expect(slot.x - layer.drift.amplitude, `${type}`).toBeLessThan(BASE_WIDTH);
        }
      }
    }
  });

  it('exteriores: street y alley tienen edificios + farolas; el suelo es calle', () => {
    for (const type of ['street', 'alley'] as const) {
      const def = LORE_BACKGROUNDS[type];
      const keys = def.layers.map((layer) => layer.key);
      expect(keys, type).toContain(TEXTURE_KEYS.building);
      expect(keys, type).toContain(TEXTURE_KEYS.lampPost);
      expect(def.ground, `${type} sin suelo`).toBeDefined();
      expect(def.ground?.color).toBe(PALETTE.street);
      expect(def.ground?.y, `${type}: suelo fuera del lienzo`).toBeGreaterThan(0);
      expect(def.ground?.y).toBeLessThan(BASE_HEIGHT);
    }
  });

  it('laboratorio: SIN edificios ni farolas, CON varias capas de vapor', () => {
    const def = LORE_BACKGROUNDS.lab;
    const keys = def.layers.map((layer) => layer.key);
    expect(keys).not.toContain(TEXTURE_KEYS.building);
    expect(keys).not.toContain(TEXTURE_KEYS.lampPost);
    const fogLayers = def.layers.filter((layer) => layer.key === TEXTURE_KEYS.fog);
    expect(fogLayers.length).toBeGreaterThanOrEqual(2);
    // El laboratorio se apoya en la mesa, no en adoquines.
    expect(def.ground).toBeUndefined();
  });

  it('laboratorio: mesa + frascos con brillo en los DOS colores de poción', () => {
    const props = LORE_BACKGROUNDS.lab.props;
    expect(props.some((prop) => prop.key === TEXTURE_KEYS.labBench)).toBe(true);
    const flasks = props.filter((prop) => prop.key === TEXTURE_KEYS.labFlask);
    expect(flasks.length).toBeGreaterThanOrEqual(2);
    expect(flasks.some((flask) => flask.tint === PALETTE.labGreen)).toBe(true);
    expect(flasks.some((flask) => flask.tint === PALETTE.potionPurple)).toBe(true);
    expect(flasks.some((flask) => flask.glow)).toBe(true);
  });

  it('props: texturas registradas, tintes de la paleta, dentro del lienzo', () => {
    for (const [type, def] of entries) {
      for (const prop of def.props) {
        expect(registeredTextures.has(prop.key), `${type}: ${prop.key}`).toBe(true);
        expect(prop.alpha, `${type}`).toBeGreaterThan(0);
        expect(prop.alpha, `${type}`).toBeLessThanOrEqual(1);
        expect(prop.scale, `${type}`).toBeGreaterThan(0);
        expect(prop.x, `${type}`).toBeGreaterThanOrEqual(0);
        expect(prop.x).toBeLessThanOrEqual(BASE_WIDTH);
        expect(prop.y, `${type}`).toBeGreaterThanOrEqual(0);
        expect(prop.y).toBeLessThanOrEqual(BASE_HEIGHT);
        if (prop.tint) {
          expect(paletteValues.has(prop.tint), `${type}: tinte ${prop.tint}`).toBe(true);
        }
        // Los props se pintan ENCIMA de las capas de niebla.
        const maxLayerDepth = Math.max(...def.layers.map((layer) => layer.depth));
        expect(prop.depth, `${type}`).toBeGreaterThan(maxLayerDepth);
      }
    }
  });

  it('los frascos se apoyan sobre el tablero de la mesa (composición)', () => {
    const bench = LORE_BACKGROUNDS.lab.props.find((prop) => prop.key === TEXTURE_KEYS.labBench);
    expect(bench).toBeDefined();
    const flasks = LORE_BACKGROUNDS.lab.props.filter((prop) => prop.key === TEXTURE_KEYS.labFlask);
    for (const flask of flasks) {
      // Fondo del frasco (y + mitad de alto escalado) ≈ sobre el tablero.
      const bottom = flask.y + 64 * flask.scale;
      expect(bottom).toBeGreaterThan(bench!.y - 140);
      expect(bottom).toBeLessThan(bench!.y + 140);
    }
  });

  it('los tres fondos comparten la forma de capa de art/parallax (ParallaxLayer)', () => {
    for (const [type, def] of entries) {
      for (const layer of def.layers as readonly ParallaxLayer[]) {
        expect(layer.drift.speed, type).toBeGreaterThan(0);
        expect(layer.drift.amplitude, type).toBeGreaterThanOrEqual(0);
        expect(layer.slots.length, type).toBeGreaterThan(0);
      }
    }
  });
});

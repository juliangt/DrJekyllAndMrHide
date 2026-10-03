/**
 * Etapa 6 — test del módulo PURO de la victoria (`gameplay/victory.ts`,
 * SPEC §5, §6, §11): desglose de puntaje con total VERIFICADO, rótulo del
 * récord, sanitización del nombre, texto del diploma (con y sin nombre) y
 * los DATOS de composición (`VICTORY_LAYOUT`) contra el lienzo 720×1280 con
 * colores de paleta y botones ≥ 64 px (SPEC §9).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READER_NAME,
  DIPLOMA_LINE_COUNT,
  NAME_LINE_INDEX,
  NAME_MAX_LENGTH,
  VICTORY_BUTTON,
  VICTORY_LABELS,
  VICTORY_LAYOUT,
  VICTORY_PANEL_STYLE,
  breakdownPlaqueHeight,
  breakdownRowCenterY,
  buildScoreBreakdown,
  diplomaParts,
  diplomaText,
  isNewRecord,
  recordLabel,
  sanitizeName,
  victoryNameZone,
} from '../gameplay/victory';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { PALETTE, hexToNumber } from '../config/palette';
import { MIN_TOUCH_HEIGHT } from '../ui/buttonState';
import { TEXTURE_KEYS } from '../art/textures';

// ---- buildScoreBreakdown ------------------------------------------------------

describe('buildScoreBreakdown — desglose con total verificado (SPEC §6)', () => {
  it('ejemplo del CA del PLAN: 3 taps (30) + quiz (100) + bonus (40) → total 170', () => {
    const view = buildScoreBreakdown({ taps: 30, quiz: 100, bonus: 40 });
    expect(view.lines.map((line) => line.value)).toEqual([30, 100, 40]);
    expect(view.total).toBe(170);
  });

  it('el total es SIEMPRE la suma de las líneas (suma verificada)', () => {
    const cases: ReadonlyArray<{ taps: number; quiz: number; bonus: number }> = [
      { taps: 30, quiz: 100, bonus: 84 }, // máximo teórico del N1: 214
      { taps: 30, quiz: 100, bonus: 0 },
      { taps: 0, quiz: 0, bonus: 0 },
      { taps: 10, quiz: 100, bonus: 2 },
    ];
    for (const input of cases) {
      const view = buildScoreBreakdown(input);
      const sum = view.lines.reduce((acc, line) => acc + line.value, 0);
      expect(view.total).toBe(sum);
    }
  });

  it('produce exactamente TRES líneas fijas: taps, quiz y bonus', () => {
    const view = buildScoreBreakdown({ taps: 30, quiz: 100, bonus: 40 });
    expect(view.lines.length).toBe(3);
    expect(view.lines[0].label).toBe('Sustos a la niña (3 × 10)');
    expect(view.lines[1].label).toBe('Quiz del libro');
    expect(view.lines[2].label).toBe('Bonus de tiempo');
  });

  it('la línea de taps muestra «X × 10» solo cuando cierra la multiplicación', () => {
    expect(buildScoreBreakdown({ taps: 30, quiz: 0, bonus: 0 }).lines[0].label).toBe(
      'Sustos a la niña (3 × 10)',
    );
    expect(buildScoreBreakdown({ taps: 0, quiz: 0, bonus: 0 }).lines[0].label).toBe(
      'Sustos a la niña',
    );
    // 25 no es múltiplo de 10: sin multiplicación (defensiva).
    expect(buildScoreBreakdown({ taps: 25, quiz: 0, bonus: 0 }).lines[0].label).toBe(
      'Sustos a la niña',
    );
  });

  it('el máximo teórico del Nivel 1 (SPEC §5): 30 + 100 + 84 = 214', () => {
    const view = buildScoreBreakdown({ taps: 30, quiz: 100, bonus: 84 });
    expect(view.total).toBe(214);
  });

  it('entradas basura (negativas / no finitas) se tratan como 0, sin NaN', () => {
    const view = buildScoreBreakdown({
      taps: Number.NaN,
      quiz: -50,
      bonus: Number.POSITIVE_INFINITY,
    });
    expect(view.lines.map((line) => line.value)).toEqual([0, 0, 0]);
    expect(view.total).toBe(0);
  });
});

// ---- recordLabel / isNewRecord --------------------------------------------------

describe('recordLabel — récord del save (SPEC §11)', () => {
  it('total MAYOR que el previo → «¡Nuevo récord!»', () => {
    expect(recordLabel(170, 100)).toBe('¡Nuevo récord!');
    expect(isNewRecord(170, 100)).toBe(true);
  });

  it('total que IGUALA el récord → «Récord: N» con N = total (marcado como récord)', () => {
    expect(recordLabel(170, 170)).toBe('Récord: 170');
    expect(isNewRecord(170, 170)).toBe(false);
  });

  it('total INFERIOR al récord → «Récord: N» con el récord vigente', () => {
    expect(recordLabel(100, 170)).toBe('Récord: 170');
    expect(isNewRecord(100, 170)).toBe(false);
  });

  it('primera victoria con récord previo 0 → «¡Nuevo récord!»', () => {
    expect(recordLabel(214, 0)).toBe('¡Nuevo récord!');
    expect(isNewRecord(214, 0)).toBe(true);
  });

  it('entradas basura se tratan como 0 (sin NaN en el rótulo)', () => {
    expect(recordLabel(Number.NaN, Number.NaN)).toBe('Récord: 0');
    expect(recordLabel(-5, 0)).toBe('Récord: 0');
    expect(isNewRecord(Number.NaN, 0)).toBe(false);
  });
});

// ---- sanitizeName -----------------------------------------------------------------

describe('sanitizeName — nombre opcional del diploma (SPEC §6)', () => {
  it('vacío → fallback «Valiente lector/a»', () => {
    expect(sanitizeName('')).toBe(DEFAULT_READER_NAME);
    expect(DEFAULT_READER_NAME).toBe('Valiente lector/a');
  });

  it('solo espacios → fallback', () => {
    expect(sanitizeName('     ')).toBe(DEFAULT_READER_NAME);
    expect(sanitizeName(' \t \n ')).toBe(DEFAULT_READER_NAME);
  });

  it('recorta espacios de los extremos y colapsa los internos', () => {
    expect(sanitizeName('  Ana  ')).toBe('Ana');
    expect(sanitizeName('Ana   María   López')).toBe('Ana María López');
  });

  it(`límite de ${NAME_MAX_LENGTH} caracteres`, () => {
    const long = 'a'.repeat(50);
    expect(sanitizeName(long).length).toBe(NAME_MAX_LENGTH);
    expect(sanitizeName(long)).toBe('a'.repeat(NAME_MAX_LENGTH));
    // El límite cuenta DESPUÉS del trim: nunca acaba en espacio.
    const squeezed = sanitizeName('Ana '.repeat(10));
    expect(squeezed.length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    expect(squeezed.endsWith(' ')).toBe(false);
  });

  it('caracteres raros no rompen (se renderiza en Phaser.Text, no HTML)', () => {
    expect(() => sanitizeName('🔥💀<script>alert(1)</script>')).not.toThrow();
    expect(sanitizeName('🔥')).toBe('🔥');
    // Los marcadores de énfasis del lore no tienen tratamiento especial: pasan.
    expect(sanitizeName('**Hyde**')).toBe('**Hyde**');
  });

  it('no-string defensivo → fallback (la firma cruza el borde DOM)', () => {
    expect(sanitizeName(undefined as unknown as string)).toBe(DEFAULT_READER_NAME);
    expect(sanitizeName(null as unknown as string)).toBe(DEFAULT_READER_NAME);
  });
});

// ---- diplomaText / diplomaParts ----------------------------------------------------

describe('diplomaText — texto del diploma con y sin nombre (PLAN tarea 1)', () => {
  it('con nombre: contiene la línea del nombre y el total', () => {
    const text = diplomaText('Ana', 170);
    expect(text).toContain('Se otorga el presente diploma a');
    expect(text).toContain('Ana');
    expect(text).toContain('170');
    expect(text).toContain('El extraño caso');
    expect(text).toContain('Dr. Jekyll');
    expect(text).toContain('Mr. Hyde');
  });

  it('sin nombre (vacío): el diploma dice «Valiente lector/a»', () => {
    const text = diplomaText('', 170);
    expect(text).toContain('Valiente lector/a');
    expect(text).not.toContain('Tu nombre');
  });

  it('estructura fija: el nombre cae SIEMPRE en la línea NAME_LINE_INDEX', () => {
    for (const name of ['Ana', '', 'Nombre Largo Válido']) {
      const lines = diplomaText(name, 170).split('\n');
      expect(lines[NAME_LINE_INDEX]).toBe(name === '' ? DEFAULT_READER_NAME : name);
      expect(lines.length).toBe(DIPLOMA_LINE_COUNT);
    }
  });

  it('diplomaText es la unión de diplomaParts (intro / nombre / cuerpo)', () => {
    const parts = diplomaParts('Ana', 170);
    expect(diplomaText('Ana', 170)).toBe([parts.top, parts.name, parts.bottom].join('\n'));
  });

  it('el total del diploma se sanea (sin NaN nunca)', () => {
    expect(diplomaText('Ana', Number.NaN)).not.toContain('NaN');
  });
});

// ---- VICTORY_LAYOUT (datos de composición 720×1280) --------------------------------

describe('VICTORY_LAYOUT — composición de la pantalla (SPEC §6/§9)', () => {
  it('el diploma (velo + panel) vive dentro del lienzo 720×1280', () => {
    const { panel } = VICTORY_LAYOUT;
    expect(panel.width).toBeLessThanOrEqual(BASE_WIDTH);
    expect(panel.centerX - panel.width / 2).toBeGreaterThanOrEqual(0);
    expect(panel.centerX + panel.width / 2).toBeLessThanOrEqual(BASE_WIDTH);
    expect(panel.centerY - panel.height / 2).toBeGreaterThanOrEqual(0);
    expect(panel.centerY + panel.height / 2).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  it('AMBOS botones miden ≥ 64 px de alto (SPEC §9) y son de paleta', () => {
    expect(VICTORY_BUTTON.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT);
    expect(VICTORY_BUTTON.minWidth).toBeGreaterThan(0);
    const buttonsY = [VICTORY_LAYOUT.buttons.playAgainCenterY, VICTORY_LAYOUT.buttons.menuCenterY];
    for (const y of buttonsY) {
      expect(y - VICTORY_BUTTON.height / 2).toBeGreaterThan(VICTORY_LAYOUT.panel.centerY);
      expect(y + VICTORY_BUTTON.height / 2).toBeLessThanOrEqual(BASE_HEIGHT);
    }
    // Sin solape entre botones.
    expect(buttonsY[1] - buttonsY[0]).toBeGreaterThanOrEqual(VICTORY_BUTTON.height);
  });

  it('todos los colores del layout provienen de la PALETTE (SPEC §7.1)', () => {
    const paletteNumbers = new Set(Object.values(PALETTE).map((hex) => hexToNumber(hex)));
    const colors: string[] = [
      VICTORY_LAYOUT.veil.color,
      VICTORY_LAYOUT.heading.color,
      VICTORY_LAYOUT.body.color,
      VICTORY_LAYOUT.nameInput.color,
      VICTORY_LAYOUT.nameInput.backgroundColor,
      VICTORY_LAYOUT.underline.color,
      VICTORY_LAYOUT.hint.color,
      VICTORY_LAYOUT.plaque.fill,
      VICTORY_LAYOUT.plaque.stroke,
      VICTORY_LAYOUT.breakdown.labelColor,
      VICTORY_LAYOUT.breakdown.valueColor,
      VICTORY_LAYOUT.breakdown.totalColor,
      VICTORY_LAYOUT.breakdown.separatorColor,
      VICTORY_LAYOUT.record.newRecordColor,
      VICTORY_LAYOUT.record.color,
    ];
    for (const color of colors) {
      expect(paletteNumbers.has(hexToNumber(color as `#${string}`)), color).toBe(true);
    }
    // El marco del diploma es el pergamino CLARO (carta del quiz, SPEC §6).
    expect(VICTORY_PANEL_STYLE.fill).toBe(PALETTE.parchmentLight);
    expect(VICTORY_PANEL_STYLE.stroke).toBe(PALETTE.parchmentDark);
    // Estados del botón de paleta (patrón GothicButton).
    for (const state of Object.values(VICTORY_BUTTON.states)) {
      expect(paletteNumbers.has(hexToNumber(state.fill))).toBe(true);
      expect(paletteNumbers.has(hexToNumber(state.stroke))).toBe(true);
      expect(paletteNumbers.has(hexToNumber(state.text))).toBe(true);
    }
  });

  it('el sello de cera usa la textura procedural wax-seal y cabe en el diploma', () => {
    expect(VICTORY_LAYOUT.seal.textureKey).toBe(TEXTURE_KEYS.waxSeal);
    const { panel, seal } = VICTORY_LAYOUT;
    const half = seal.size / 2;
    expect(seal.centerX - half).toBeGreaterThanOrEqual(panel.centerX - panel.width / 2);
    expect(seal.centerX + half).toBeLessThanOrEqual(panel.centerX + panel.width / 2);
    expect(seal.centerY - half).toBeGreaterThanOrEqual(panel.centerY - panel.height / 2);
    expect(seal.centerY + half).toBeLessThanOrEqual(panel.centerY + panel.height / 2);
  });

  it('la placa del desglose (4 filas) y el récord caben dentro del diploma', () => {
    const { panel, plaque } = VICTORY_LAYOUT;
    const height = breakdownPlaqueHeight();
    expect(height).toBe(2 * plaque.paddingY + 4 * plaque.rowHeightPx);
    expect(plaque.width).toBeLessThanOrEqual(panel.width - 2 * panel.padding);
    const plaqueBottom = plaque.topY + height;
    // La placa queda dentro del panel y antes del récord; el récord antes del pie.
    expect(plaqueBottom).toBeLessThan(VICTORY_LAYOUT.record.centerY);
    expect(VICTORY_LAYOUT.record.centerY).toBeLessThan(VICTORY_LAYOUT.hint.centerY);
    expect(VICTORY_LAYOUT.hint.centerY).toBeLessThan(panel.centerY + panel.height / 2);
    // Los centros de fila son crecientes y viven dentro de la placa.
    for (let i = 0; i < 4; i++) {
      const y = breakdownRowCenterY(i);
      expect(y).toBeGreaterThan(plaque.topY);
      expect(y).toBeLessThan(plaqueBottom);
      if (i > 0) {
        expect(y).toBeGreaterThan(breakdownRowCenterY(i - 1));
      }
    }
  });

  it('el cuerpo del diploma (6 líneas fijas) no pisa la placa del desglose', () => {
    const { body, plaque } = VICTORY_LAYOUT;
    const lastLineTop = body.topY + (DIPLOMA_LINE_COUNT - 1) * body.lineHeightPx;
    const bodyBottom = lastLineTop + body.fontSize;
    expect(bodyBottom).toBeLessThan(plaque.topY);
  });

  it('la zona de firma queda centrada sobre la línea del nombre', () => {
    const zone = victoryNameZone();
    const { body } = VICTORY_LAYOUT;
    expect(zone.centerX).toBe(VICTORY_LAYOUT.panel.centerX);
    expect(zone.centerY).toBe(
      body.topY + body.nameLineIndex * body.lineHeightPx + body.fontSize / 2,
    );
    // El input de firma respeta el maxlength del módulo puro.
    expect(VICTORY_LAYOUT.nameInput.maxLength).toBe(NAME_MAX_LENGTH);
    expect(VICTORY_LABELS.namePlaceholder).toBe('Tu nombre');
  });

  it('profundidades ordenadas: velo < diploma < contenido < sello < UI', () => {
    const { depths } = VICTORY_LAYOUT;
    expect(depths.veil).toBeLessThan(depths.panel);
    expect(depths.panel).toBeLessThan(depths.content);
    expect(depths.content).toBeLessThan(depths.seal);
    expect(depths.seal).toBeLessThan(depths.ui);
  });

  it('etiquetas de los botones según el PLAN (español)', () => {
    expect(VICTORY_LABELS.playAgain).toBe('Jugar de nuevo');
    expect(VICTORY_LABELS.backToMenu).toBe('Volver al inicio');
    expect(VICTORY_LABELS.heading).toBe('¡Victoria!');
  });
});

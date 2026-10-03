/**
 * Etapa 7 — QA responsive AUTOMATIZABLE (PLAN tarea 2 / SPEC §9): la cadena
 * 320 px → 1920 px a nivel de escala FIT.
 *
 * La matemática de `Scale.FIT + CENTER_BOTH` vive en `ui/fitScale.ts`
 * (extraída de `canvasPointToCss`, ui/nameField — misma fuente de verdad).
 * Estos tests verifican como PROPIEDAD, para cada viewport del QA:
 *
 *  1. El canvas SIEMPRE cabe (cssWidth ≤ viewport, cssHeight ≤ viewport).
 *  2. El canvas SIEMPRE conserva el ratio 720:1280 (sin deformación).
 *  3. El letterbox es ≥ 0 y centrado (CENTER_BOTH).
 *  4. La correspondencia con `canvasPointToCss` (el mapeo de la firma del
 *     diploma usa la MISMA escala) y las esquinas del lienzo caen dentro
 *     del viewport.
 *  5. En el viewport más pequeño (320 px), la hitbox de la niña (+20 %)
 *     sigue midiendo ≥ 44 px CSS — objetivo táctil mínimo (Apple HIG).
 *
 * Los casos cubren: móvil pequeño (320×480), móvil estándar (375×667),
 * tablet (768×1024), desktop (1920×1080), orientación horizontal
 * (1280×720 — letterbox lateral grande) y zoom de navegador al 150 %
 * (viewport efectivo ≈ 1280×853).
 */
import { describe, expect, it } from 'vitest';
import { fitScale } from '../ui/fitScale';
import { canvasPointToCss } from '../ui/nameField';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { ACTION_LAYOUT } from '../gameplay/actionLayout';
import { DEFAULT_HITBOX_EXPANSION } from '../gameplay/hitbox';

/** Casos del QA responsive (PLAN Etapa 7, tarea 2). */
const VIEWPORTS: readonly { name: string; width: number; height: number }[] = [
  { name: 'móvil pequeño 320×480', width: 320, height: 480 },
  { name: 'móvil estándar 375×667', width: 375, height: 667 },
  { name: 'tablet 768×1024', width: 768, height: 1024 },
  { name: 'desktop 1920×1080', width: 1920, height: 1080 },
  { name: 'horizontal 1280×720 (landscape)', width: 1280, height: 720 },
  { name: 'zoom 150 % → viewport efectivo 1280×853', width: 1280, height: 853 },
];

/** Tolerancia para comparaciones de punto flotante (px). */
const EPS = 1e-6;

describe('fitScale — el canvas SIEMPRE cabe y conserva el ratio 720:1280', () => {
  it.each(VIEWPORTS)('$name: cabe, ratio exacto y letterbox centrado', ({ width, height }) => {
    const fit = fitScale(width, height, BASE_WIDTH, BASE_HEIGHT);

    // 1. Cabe SIEMPRE (propiedad de Scale.FIT).
    expect(fit.fits).toBe(true);
    expect(fit.cssWidth).toBeLessThanOrEqual(width + EPS);
    expect(fit.cssHeight).toBeLessThanOrEqual(height + EPS);

    // 2. Conserva el ratio 720:1280 (sin deformar el juego).
    const canvasRatio = fit.cssWidth / fit.cssHeight;
    const baseRatio = BASE_WIDTH / BASE_HEIGHT;
    expect(Math.abs(canvasRatio - baseRatio)).toBeLessThan(EPS);

    // 3. Escala positiva = la mínima de las dos razones; letterbox ≥ 0.
    expect(fit.scale).toBe(Math.min(width / BASE_WIDTH, height / BASE_HEIGHT));
    expect(fit.scale).toBeGreaterThan(0);
    expect(fit.letterboxX).toBeGreaterThanOrEqual(-EPS);
    expect(fit.letterboxY).toBeGreaterThanOrEqual(-EPS);
    expect(fit.cssWidth + 2 * fit.letterboxX).toBeCloseTo(width, 6);
    expect(fit.cssHeight + 2 * fit.letterboxY).toBeCloseTo(height, 6);
  });

  it('320×480 limita el ALTO (escala 0.375) y deja 25 px de banda por lado', () => {
    const fit = fitScale(320, 480, BASE_WIDTH, BASE_HEIGHT);
    expect(fit.scale).toBeCloseTo(0.375, 9);
    expect(fit.cssWidth).toBeCloseTo(270, 6); // 720 · 0.375
    expect(fit.cssHeight).toBeCloseTo(480, 6);
    expect(fit.letterboxX).toBeCloseTo(25, 6); // (320 − 270) / 2
    expect(fit.letterboxY).toBeCloseTo(0, 6);
  });

  it('1920×1080 limita el ALTO: canvas 607.5×1080, letterbox lateral 656.25', () => {
    const fit = fitScale(1920, 1080, BASE_WIDTH, BASE_HEIGHT);
    expect(fit.scale).toBeCloseTo(0.84375, 9);
    expect(fit.cssWidth).toBeCloseTo(607.5, 6);
    expect(fit.cssHeight).toBeCloseTo(1080, 6);
    expect(fit.letterboxX).toBeCloseTo(656.25, 6);
  });

  it('horizontal 1280×720: el canvas sigue vertical y centrado (letterbox decorado)', () => {
    const fit = fitScale(1280, 720, BASE_WIDTH, BASE_HEIGHT);
    expect(fit.cssHeight).toBeCloseTo(720, 6);
    expect(fit.cssWidth).toBeCloseTo(405, 6); // 720 · 0.5625
    expect(fit.letterboxX).toBeCloseTo(437.5, 6);
    // La horizontal es el caso del «letterbox decorado» (SPEC §9): banda
    // ancha a cada lado — el fondo de niebla de style.css la viste.
    expect(fit.letterboxX).toBeGreaterThan(fit.letterboxY);
  });

  it('zoom 150 % (viewport efectivo 1280×853): sigue cabiendo sin recortes', () => {
    const fit = fitScale(1280, 853, BASE_WIDTH, BASE_HEIGHT);
    expect(fit.fits).toBe(true);
    expect(fit.scale).toBeCloseTo(853 / 1280, 9); // limita el alto
    expect(fit.cssWidth).toBeLessThanOrEqual(1280);
    expect(fit.cssHeight).toBeCloseTo(853, 6);
  });

  it('entradas degeneradas (0, negativas, NaN) degradan a escala 0 sin NaN', () => {
    for (const [w, h] of [
      [0, 480],
      [320, 0],
      [-320, 480],
      [Number.NaN, 480],
      [320, Number.POSITIVE_INFINITY],
    ] as const) {
      const fit = fitScale(w, h, BASE_WIDTH, BASE_HEIGHT);
      expect(fit.scale).toBe(0);
      expect(Number.isNaN(fit.cssWidth)).toBe(false);
      expect(Number.isNaN(fit.cssHeight)).toBe(false);
      expect(Number.isNaN(fit.letterboxX)).toBe(false);
      expect(Number.isNaN(fit.letterboxY)).toBe(false);
    }
  });
});

describe('cadena completa fitScale ⇄ canvasPointToCss (misma matemática, un solo origen)', () => {
  it.each(VIEWPORTS)('$name: las esquinas del lienzo caen DENTRO del viewport', ({ width, height }) => {
    // El rect del canvas ES el resultado del fit (Phaser lo dimensiona así).
    const rect = { left: fitScale(width, height, BASE_WIDTH, BASE_HEIGHT).letterboxX, top: 0, width, height };
    for (const point of [
      { x: 0, y: 0 },
      { x: BASE_WIDTH, y: 0 },
      { x: 0, y: BASE_HEIGHT },
      { x: BASE_WIDTH, y: BASE_HEIGHT },
      { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 },
    ]) {
      const css = canvasPointToCss(point, rect, BASE_WIDTH, BASE_HEIGHT);
      expect(css.left).toBeGreaterThanOrEqual(-EPS);
      expect(css.left).toBeLessThanOrEqual(width + EPS);
      expect(css.top).toBeGreaterThanOrEqual(-EPS);
      expect(css.top).toBeLessThanOrEqual(height + EPS);
    }
  });

  it.each(VIEWPORTS)('$name: canvasPointToCss usa la MISMA escala que fitScale', ({ width, height }) => {
    const fit = fitScale(width, height, BASE_WIDTH, BASE_HEIGHT);
    const css = canvasPointToCss({ x: BASE_WIDTH, y: BASE_HEIGHT }, { left: 0, top: 0, width, height }, BASE_WIDTH, BASE_HEIGHT);
    expect(css.scale).toBe(fit.scale);
    // La esquina inferior derecha del lienzo cae exactamente donde dice el fit.
    expect(css.left).toBeCloseTo(fit.letterboxX + fit.cssWidth, 6);
    expect(css.top).toBeCloseTo(fit.letterboxY + fit.cssHeight, 6);
  });

  it('con un rect más ancho que alto (letterbox lateral) el punto se centra igual', () => {
    // Mismo caso que el test histórico de nameField: rect 800×640.
    const css = canvasPointToCss({ x: 360, y: 640 }, { left: 0, top: 0, width: 800, height: 640 }, BASE_WIDTH, BASE_HEIGHT);
    expect(css.scale).toBe(0.5);
    expect(css.left).toBe(400);
    expect(css.top).toBe(320);
  });
});

describe('objetivo táctil en el viewport MÍNIMO (320 px de ancho)', () => {
  it('la hitbox de la niña (+20 %) mide ≥ 44 px CSS en 320×480', () => {
    // SPEC §4.2: hitbox generosa «apropiada para dedos de niños». En el
    // viewport más pequeño soportado debe seguir siendo un objetivo real.
    const fit = fitScale(320, 480, BASE_WIDTH, BASE_HEIGHT);
    const hitboxCss = ACTION_LAYOUT.girl.width * DEFAULT_HITBOX_EXPANSION * fit.scale;
    expect(hitboxCss).toBeGreaterThanOrEqual(44); // Apple HIG: 44 pt mínimo
  });

  it('los botones primarios (96 px de juego) miden ≥ 36 px CSS en 320×480', () => {
    // El estándar de 64 px (SPEC §9) está garantizado en PX DE JUEGO y se
    // testea en accessibility.test.ts; aquí se documenta el tamaño CSS real
    // en el peor caso para el checklist manual de dispositivo.
    const fit = fitScale(320, 480, BASE_WIDTH, BASE_HEIGHT);
    const primaryButtonCss = 96 * fit.scale;
    expect(primaryButtonCss).toBeGreaterThanOrEqual(36);
  });
});

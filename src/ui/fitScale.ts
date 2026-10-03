/**
 * Matemática de escala del lienzo (QA responsive Etapa 7): el cálculo puro
 * de `Phaser.Scale.FIT` + `CENTER_BOTH` extraído de `canvasPointToCss`
 * (ui/nameField) para poder TESTEAR la cadena 320 px → 1920 px sin navegador.
 *
 * Con `Scale.FIT` el canvas SIEMPRE cabe en el viewport y SIEMPRE conserva
 * el ratio base (720:1280, SPEC §9): la escala es el MÍNIMO de las dos
 * razones viewport/base y el sobrante se reparte como letterbox centrado.
 * `CENTER_BOTH` centra el canvas, así que el letterbox queda partido en
 * partes iguales a cada lado (los offsets de `canvasPointToCss`).
 *
 * Sin import de Phaser: módulo puro, testeable en jsdom y reutilizado por
 * `canvasPointToCss` (misma matemática, una sola fuente de verdad).
 */

/** Resultado de ajustar el lienzo base en un viewport (todo en px CSS). */
export interface FitResult {
  /**
   * Escala lienzo→CSS: `min(viewportW/baseW, viewportH/baseH)`. 0 si las
   * entradas son degeneradas (0, negativas o no finitas) — nunca NaN.
   */
  scale: number;
  /** Ancho del canvas en px CSS (= baseWidth · scale). */
  cssWidth: number;
  /** Alto del canvas en px CSS (= baseHeight · scale). */
  cssHeight: number;
  /** Letterbox horizontal total a UN lado ((viewportW − cssWidth) / 2) ≥ 0. */
  letterboxX: number;
  /** Letterbox vertical por lado ((viewportH − cssHeight) / 2) ≥ 0. */
  letterboxY: number;
  /**
   * Veredicto de encaje: el canvas (cssWidth × cssHeight) cabe en el
   * viewport. Con FIT es true POR CONSTRUCCIÓN para cualquier viewport
   * sano — el test lo verifica como propiedad, no como tautología.
   */
  fits: boolean;
}

/** Número sano: finito y > 0 (lo que un viewport/base puede valer). */
function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Calcula el tamaño del canvas y el letterbox para un viewport dado,
 * replicando `Scale.FIT` + `CENTER_BOTH` de Phaser.
 *
 * Viewports o bases degenerados (0, negativos, NaN, Infinity) devuelven
 * escala 0 con letterbox 0 — degradan sin NaN, igual que el resto de los
 * módulos puros del juego.
 */
export function fitScale(
  viewportWidth: number,
  viewportHeight: number,
  baseWidth: number,
  baseHeight: number,
): FitResult {
  const usable =
    positiveFinite(viewportWidth) &&
    positiveFinite(viewportHeight) &&
    positiveFinite(baseWidth) &&
    positiveFinite(baseHeight);
  const scale = usable
    ? Math.min(viewportWidth / baseWidth, viewportHeight / baseHeight)
    : 0;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 0;

  const cssWidth = baseWidth * safeScale;
  const cssHeight = baseHeight * safeScale;
  const letterboxX = (viewportWidth - cssWidth) / 2;
  const letterboxY = (viewportHeight - cssHeight) / 2;

  return {
    scale: safeScale,
    cssWidth,
    cssHeight,
    // Degenerados → safeScale 0 → letterbox = viewport/2 ≥ 0 igualmente.
    letterboxX: Number.isFinite(letterboxX) ? letterboxX : 0,
    letterboxY: Number.isFinite(letterboxY) ? letterboxY : 0,
    fits: cssWidth <= viewportWidth && cssHeight <= viewportHeight,
  };
}

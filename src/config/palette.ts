/**
 * Paleta gótica del juego (SPEC §7.1) — fuente de verdad de los colores.
 *
 * Todos los valores son strings `#rrggbb` (tipo `HexColor`) para que sean
 * legibles, comparables en tests y directamente usables en CSS/Phaser
 * (`backgroundColor` acepta string). Para las APIs que piden número
 * (`Graphics.fillStyle`, `fillStyle(color: number)`) existe `hexToNumber`,
 * y para los fades de cámara `hexToRgb`.
 *
 * Sin import de Phaser: este módulo se consume en tests (jsdom no puede
 * cargar Phaser).
 */

/** Color en formato hex CSS de 6 dígitos, p. ej. `'#0d0f14'`. */
export type HexColor = `#${string}`;

/** Fondo noche / cielo. */
export const nightBackground: HexColor = '#0d0f14';

/** Niebla, capa lejana (la más oscura de las tres). */
export const fogFar: HexColor = '#3a4048';

/** Niebla, capa media. */
export const fogMid: HexColor = '#565e68';

/** Niebla, capa cercana (la más clara). */
export const fogNear: HexColor = '#78818c';

/** Edificios en silueta. */
export const buildings: HexColor = '#1a1d24';

/** Calle / adoquines. */
export const street: HexColor = '#23262e';

/** Verde laboratorio (acentos). */
export const labGreen: HexColor = '#4f7a5c';

/** Sepia pergamino claro (superficie de UI/quiz). */
export const parchmentLight: HexColor = '#d8c9a3';

/** Sepia pergamino oscuro (bordes y fondo del pergamino). */
export const parchmentDark: HexColor = '#2b2620';

/** Fuego de farola / farol de la niña. */
export const lampFire: HexColor = '#e8b45a';

/** Púrpura poción (acentos de narrativa). */
export const potionPurple: HexColor = '#7a4f8f';

/** Texto principal sobre fondos oscuros. */
export const textPrimary: HexColor = '#e8e3d5';

/** Feedback de éxito (desaturado, no agresivo). */
export const success: HexColor = '#7fb069';

/** Feedback de error (desaturado, no agresivo). */
export const error: HexColor = '#b05a5a';

/** Paleta agrupada por uso (SPEC §7.1). Referencia rápida / iteración. */
export const PALETTE = {
  nightBackground,
  fogFar,
  fogMid,
  fogNear,
  buildings,
  street,
  labGreen,
  parchmentLight,
  parchmentDark,
  lampFire,
  potionPurple,
  textPrimary,
  success,
  error,
} as const satisfies Record<string, HexColor>;

/** Convierte `'#0d0f14'` → `0x0d0f14` (para `Graphics.fillStyle` y afines). */
export function hexToNumber(hex: HexColor): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** Componentes RGB 0–255 de un hex (para `Camera.fadeOut(d, r, g, b)`). */
export function hexToRgb(hex: HexColor): { r: number; g: number; b: number } {
  const value = hexToNumber(hex);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/**
 * Dimensiones base del juego (SPEC §9: mobile-first vertical 720×1280).
 * El escalado al viewport lo hace Phaser (Scale.FIT + CENTER_BOTH, ver `main.ts`);
 * estas constantes se centralizan aquí para que sean testeables y compartidas
 * por el resto del código a partir de la Etapa 1.
 */
export const BASE_WIDTH = 720;
export const BASE_HEIGHT = 1280;

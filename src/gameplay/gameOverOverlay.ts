/**
 * Overlay GAME_OVER del timeout (SPEC §3/§6): TEXTOS y ESTILO como DATOS
 * PUROS. No es una escena: es un overlay dentro de `ActionScene` (ver
 * `sceneKeys.ts`), y su tono es PARTE del diseño (SPEC §6: «Tono animoso;
 * sin "perdiste" en rojo agresivo») — los tests validan ese tono.
 *
 * Reencuadre D4: el timeout es «la niebla lo cubrió todo», nunca un
 * castigo. El botón «Reintentar» reinicia SOLO el minijuego (D6).
 */

import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { nightBackground, parchmentDark } from '../config/palette';
import { TEXTURE_KEYS } from '../art/textures';

/**
 * Textos del overlay (SPEC §6 verbatim: «La niebla lo ocultó todo…
 * ¡inténtalo de nuevo!» + botón «Reintentar»).
 */
export const GAME_OVER_OVERLAY = {
  /** Velo de niebla que cubre la escena (mismo recurso del «Cómo jugar»). */
  veil: {
    alpha: 0.88,
    color: nightBackground,
  },
  /** Panel pergamino centrado. */
  panel: {
    width: 560,
    height: 430,
    textureKey: TEXTURE_KEYS.parchmentFrame,
  },
  /** Título: la primera mitad de la frase del SPEC, con elipsis. */
  title: 'La niebla lo ocultó todo…',
  /** Subtítulo animoso: la exhortación del SPEC. */
  subtitle: '¡Inténtalo de nuevo!',
  /** Botón de salida («Reintentar» = reiniciar SOLO el minijuego, D6). */
  retryLabel: 'Reintentar',
  /** Entrada del overlay (ms): fade suave, sin golpe. */
  fadeMs: 250,
} as const;

/** Estilo del overlay: pergamino oscuro + textos cálidos (paleta §7.1). */
export const GAME_OVER_STYLE = {
  title: {
    fontFamily: 'UnifrakturCook, Georgia, serif',
    fontSize: 54,
    color: parchmentDark,
    /** Wrap para que la frase quepa en el pergamino (320–720 px, SPEC §9). */
    wordWrapWidth: 440,
  },
  subtitle: {
    fontFamily: '"Special Elite", Georgia, serif',
    fontSize: 36,
    // Sepia oscuro sobre el pergamino claro (contraste, SPEC §9).
    color: parchmentDark,
  },
} as const;

/**
 * ¿El color del título es apto para el tono amable del SPEC? Expuesto como
 * predicado para el test de tono: el título NUNCA es el rojo de error
 * (SPEC §6 «sin rojo agresivo») — se pinta sepia sobre pergamino claro.
 */
export function isGentleTitleColor(color: string): boolean {
  return color !== '#b05a5a';
}

/** Coherencia con el lienzo base (usado por tests): el panel cabe centrado. */
export function overlayFitsCanvas(panel: { width: number; height: number }): boolean {
  return panel.width <= BASE_WIDTH && panel.height <= BASE_HEIGHT;
}

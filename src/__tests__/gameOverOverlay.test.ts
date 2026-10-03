/**
 * Etapa 4 — test del overlay GAME_OVER (SPEC §6: tono ANIMOSO, sin «perdiste»
 * en rojo agresivo; D6: «Reintentar» reinicia SOLO el minijuego). Textos,
 * colores de paleta, contraste del subtítulo y coherencia con 720×1280.
 */
import { describe, expect, it } from 'vitest';
import {
  GAME_OVER_OVERLAY,
  GAME_OVER_STYLE,
  isGentleTitleColor,
  overlayFitsCanvas,
} from '../gameplay/gameOverOverlay';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/dimensions';
import { PALETTE, error, nightBackground, parchmentDark } from '../config/palette';
import { TEXTURE_KEYS } from '../art/textures';

/** Todo el texto visible del overlay en un solo string (para el test de tono). */
function overlayCopy(): string {
  return [GAME_OVER_OVERLAY.title, GAME_OVER_OVERLAY.subtitle, GAME_OVER_OVERLAY.retryLabel].join(' ');
}

describe('GAME_OVER_OVERLAY — textos del SPEC §6', () => {
  it('la frase literal: «La niebla lo ocultó todo…» + «¡inténtalo de nuevo!»', () => {
    expect(GAME_OVER_OVERLAY.title).toBe('La niebla lo ocultó todo…');
    expect(GAME_OVER_OVERLAY.subtitle).toBe('¡Inténtalo de nuevo!');
  });

  it('botón «Reintentar» (reinicia SOLO el minijuego, D6)', () => {
    expect(GAME_OVER_OVERLAY.retryLabel).toBe('Reintentar');
  });

  it('tono ANIMOSO: nada de «perdiste»/«game over»/derrota', () => {
    expect(overlayCopy()).not.toMatch(/perdiste|perdedor|game ?over|derrota|fracas|muerto|fallaste/i);
  });

  it('tono amable: invita a reintentar (contiene «inténtalo» y «niebla»)', () => {
    expect(overlayCopy()).toMatch(/inténtalo/i);
    expect(overlayCopy()).toMatch(/niebla/i);
  });

  it('textos no vacíos', () => {
    expect(GAME_OVER_OVERLAY.title.trim().length).toBeGreaterThan(0);
    expect(GAME_OVER_OVERLAY.subtitle.trim().length).toBeGreaterThan(0);
    expect(GAME_OVER_OVERLAY.retryLabel.trim().length).toBeGreaterThan(0);
  });
});

describe('GAME_OVER_OVERLAY — estilo (paleta y contraste, SPEC §7/§9)', () => {
  it('el título NUNCA es el rojo agresivo (SPEC §6)', () => {
    expect(GAME_OVER_STYLE.title.color).not.toBe(error);
    expect(isGentleTitleColor(GAME_OVER_STYLE.title.color)).toBe(true);
    // El predicado rechaza el rojo de error de la paleta.
    expect(isGentleTitleColor('#b05a5a')).toBe(false);
  });

  it('título y subtítulo en sepia OSCURO sobre el pergamino claro (contraste)', () => {
    expect(GAME_OVER_STYLE.title.color).toBe(parchmentDark);
    expect(GAME_OVER_STYLE.subtitle.color).toBe(parchmentDark);
  });

  it('velo de niebla nocturno con alfa válida', () => {
    expect(GAME_OVER_OVERLAY.veil.color).toBe(nightBackground);
    expect(GAME_OVER_OVERLAY.veil.alpha).toBeGreaterThan(0);
    expect(GAME_OVER_OVERLAY.veil.alpha).toBeLessThanOrEqual(1);
  });

  it('el panel usa la textura pergamino registrada', () => {
    expect(GAME_OVER_OVERLAY.panel.textureKey).toBe(TEXTURE_KEYS.parchmentFrame);
  });

  it('fade de entrada positivo y suave (≤ 500 ms: sin golpe)', () => {
    expect(GAME_OVER_OVERLAY.fadeMs).toBeGreaterThan(0);
    expect(GAME_OVER_OVERLAY.fadeMs).toBeLessThanOrEqual(500);
  });
});

describe('GAME_OVER_OVERLAY — coherencia con el lienzo 720×1280', () => {
  it('el panel cabe centrado en pantalla', () => {
    expect(overlayFitsCanvas(GAME_OVER_OVERLAY.panel)).toBe(true);
    expect(overlayFitsCanvas({ width: BASE_WIDTH + 1, height: 100 })).toBe(false);
    expect(overlayFitsCanvas({ width: 100, height: BASE_HEIGHT + 1 })).toBe(false);
  });

  it('dimensiones positivas y margen lateral ≥ 40 px (320→720 px, SPEC §9)', () => {
    expect(GAME_OVER_OVERLAY.panel.width).toBeGreaterThan(0);
    expect(GAME_OVER_OVERLAY.panel.height).toBeGreaterThan(0);
    expect((BASE_WIDTH - GAME_OVER_OVERLAY.panel.width) / 2).toBeGreaterThanOrEqual(40);
  });

  it('el wrap del título es más angosto que el panel', () => {
    expect(GAME_OVER_STYLE.title.wordWrapWidth).toBeLessThanOrEqual(
      GAME_OVER_OVERLAY.panel.width - 80,
    );
  });

  it('tipografías de la SPEC §7.3 con fallback serif', () => {
    expect(GAME_OVER_STYLE.title.fontFamily).toContain('Georgia, serif');
    expect(GAME_OVER_STYLE.subtitle.fontFamily).toContain('Georgia, serif');
  });

  it('todos los colores usados pertenecen a la paleta', () => {
    const paletteValues = new Set(Object.values(PALETTE));
    expect(paletteValues.has(GAME_OVER_OVERLAY.veil.color as `#${string}`)).toBe(true);
    expect(paletteValues.has(GAME_OVER_STYLE.title.color as `#${string}`)).toBe(true);
    expect(paletteValues.has(GAME_OVER_STYLE.subtitle.color as `#${string}`)).toBe(true);
  });
});

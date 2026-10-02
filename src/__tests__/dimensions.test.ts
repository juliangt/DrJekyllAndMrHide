/**
 * Etapa 0 — test de las dimensiones base del juego.
 * SPEC §9: mobile-first vertical 720×1280.
 */
import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, BASE_HEIGHT } from '../config/dimensions';

describe('dimensiones base (src/config/dimensions.ts)', () => {
  it('el ancho base es 720 px', () => {
    expect(BASE_WIDTH).toBe(720);
  });

  it('el alto base es 1280 px', () => {
    expect(BASE_HEIGHT).toBe(1280);
  });

  it('la orientación base es vertical (alto > ancho)', () => {
    expect(BASE_HEIGHT).toBeGreaterThan(BASE_WIDTH);
  });
});

/**
 * Etapa 1 — test de la paleta gótica (SPEC §7.1): todos los colores de la
 * tabla de la SPEC presentes, con su hex EXACTO, formato válido y objeto
 * agrupado consistente.
 */
import { describe, expect, it } from 'vitest';
import {
  PALETTE,
  buildings,
  error,
  fogFar,
  fogMid,
  fogNear,
  hexToNumber,
  hexToRgb,
  labGreen,
  lampFire,
  nightBackground,
  parchmentDark,
  parchmentLight,
  potionPurple,
  street,
  success,
  textPrimary,
} from '../config/palette';

const HEX_RE = /^#[0-9a-f]{6}$/;

describe('palette (SPEC §7.1) — colores exactos de la tabla', () => {
  it('fondo noche / cielo: #0d0f14', () => {
    expect(nightBackground).toBe('#0d0f14');
  });

  it('niebla lejos → cerca: #3a4048 · #565e68 · #78818c', () => {
    expect(fogFar).toBe('#3a4048');
    expect(fogMid).toBe('#565e68');
    expect(fogNear).toBe('#78818c');
  });

  it('edificios en silueta: #1a1d24', () => {
    expect(buildings).toBe('#1a1d24');
  });

  it('calle / adoquines: #23262e', () => {
    expect(street).toBe('#23262e');
  });

  it('verde laboratorio: #4f7a5c', () => {
    expect(labGreen).toBe('#4f7a5c');
  });

  it('pergamino claro sobre oscuro: #d8c9a3 sobre #2b2620', () => {
    expect(parchmentLight).toBe('#d8c9a3');
    expect(parchmentDark).toBe('#2b2620');
  });

  it('fuego de farola: #e8b45a', () => {
    expect(lampFire).toBe('#e8b45a');
  });

  it('púrpura poción: #7a4f8f', () => {
    expect(potionPurple).toBe('#7a4f8f');
  });

  it('texto principal: #e8e3d5', () => {
    expect(textPrimary).toBe('#e8e3d5');
  });

  it('éxito / error: #7fb069 / #b05a5a', () => {
    expect(success).toBe('#7fb069');
    expect(error).toBe('#b05a5a');
  });
});

describe('palette — formato e invariants', () => {
  it('todos los colores tienen formato #rrggbb válido', () => {
    for (const [name, color] of Object.entries(PALETTE)) {
      expect(color, `${name}=${String(color)}`).toMatch(HEX_RE);
    }
  });

  it('los 14 colores de la SPEC §7.1 están en el objeto agrupado', () => {
    expect(Object.keys(PALETTE).sort()).toEqual(
      [
        'buildings',
        'error',
        'fogFar',
        'fogMid',
        'fogNear',
        'labGreen',
        'lampFire',
        'nightBackground',
        'parchmentDark',
        'parchmentLight',
        'potionPurple',
        'street',
        'success',
        'textPrimary',
      ].sort(),
    );
  });

  it('el objeto agrupado coincide con las constantes individuales', () => {
    expect(PALETTE.nightBackground).toBe(nightBackground);
    expect(PALETTE.fogFar).toBe(fogFar);
    expect(PALETTE.fogMid).toBe(fogMid);
    expect(PALETTE.fogNear).toBe(fogNear);
    expect(PALETTE.buildings).toBe(buildings);
    expect(PALETTE.street).toBe(street);
    expect(PALETTE.labGreen).toBe(labGreen);
    expect(PALETTE.parchmentLight).toBe(parchmentLight);
    expect(PALETTE.parchmentDark).toBe(parchmentDark);
    expect(PALETTE.lampFire).toBe(lampFire);
    expect(PALETTE.potionPurple).toBe(potionPurple);
    expect(PALETTE.textPrimary).toBe(textPrimary);
    expect(PALETTE.success).toBe(success);
    expect(PALETTE.error).toBe(error);
  });

  it('los 14 colores son distintos entre sí', () => {
    const values = Object.values(PALETTE);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('palette — helpers numéricos', () => {
  it('hexToNumber convierte #0d0f14 → 0x0d0f14', () => {
    expect(hexToNumber('#0d0f14')).toBe(0x0d0f14);
  });

  it('hexToNumber convierte #ffffff → 0xffffff', () => {
    expect(hexToNumber('#ffffff')).toBe(0xffffff);
  });

  it('hexToRgb descompone en r/g/b 0–255', () => {
    expect(hexToRgb('#e8b45a')).toEqual({ r: 232, g: 180, b: 90 });
    expect(hexToRgb('#0d0f14')).toEqual({ r: 13, g: 15, b: 20 });
    expect(hexToRgb('#7fb069')).toEqual({ r: 127, g: 176, b: 105 });
  });
});

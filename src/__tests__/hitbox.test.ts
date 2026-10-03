/**
 * Etapa 4 — test de la hitbox +20 % (SPEC §4.2, geometría PURA): dentro del
 * sprite original, FUERA del original pero DENTRO de la expansión (el caso
 * que la hace «generosa para dedos de niños»), lejos, bordes inclusivos y
 * el parámetro de expansión respetado.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HITBOX_EXPANSION,
  expandedTarget,
  isHit,
  type TargetLike,
} from '../gameplay/hitbox';

/** La niña según ACTION_LAYOUT: display 120×220 centrada en (360, 680). */
const GIRL: TargetLike = { x: 360, y: 680, width: 120, height: 220 };

describe('DEFAULT_HITBOX_EXPANSION', () => {
  it('es +20 % (1.2, SPEC §4.2)', () => {
    expect(DEFAULT_HITBOX_EXPANSION).toBeCloseTo(1.2, 9);
  });
});

describe('expandedTarget', () => {
  it('mismo centro, lados × 1.2 (120×220 → 144×264)', () => {
    const box = expandedTarget(GIRL);
    expect(box.x).toBe(360);
    expect(box.y).toBe(680);
    expect(box.width).toBeCloseTo(144, 6);
    expect(box.height).toBeCloseTo(264, 6);
  });

  it('respeta la expansión personalizada', () => {
    expect(expandedTarget(GIRL, 1).width).toBe(120);
    expect(expandedTarget(GIRL, 2).width).toBe(240);
    expect(expandedTarget(GIRL, 1.5).height).toBeCloseTo(330, 6);
  });
});

describe('isHit — con la expansión por defecto (+20 %)', () => {
  it('en el centro: hit', () => {
    expect(isHit({ x: 360, y: 680 }, GIRL)).toBe(true);
  });

  it('dentro del sprite original (cerca del borde): hit', () => {
    expect(isHit({ x: 419, y: 680 }, GIRL)).toBe(true); // borde original x=420
    expect(isHit({ x: 360, y: 789 }, GIRL)).toBe(true); // borde original y=790
  });

  it('FUERA del original pero DENTRO de la expansión: hit (dedos de niños)', () => {
    // La expansión lleva el semiancho de 60 a 72 y el semialto de 110 a 132.
    expect(isHit({ x: 425, y: 680 }, GIRL)).toBe(true); // 65 > 60, ≤ 72
    expect(isHit({ x: 360, y: 800 }, GIRL)).toBe(true); // 120 > 110, ≤ 132
    expect(isHit({ x: 297, y: 680 }, GIRL)).toBe(true); // -63 < -60, ≥ -72
    expect(isHit({ x: 360, y: 570 }, GIRL)).toBe(true); // -110>-132 lado sup
  });

  it('fuera de la expansión (aunque sea por 1 px): miss', () => {
    expect(isHit({ x: 433, y: 680 }, GIRL)).toBe(false); // 73 > 72
    expect(isHit({ x: 360, y: 813 }, GIRL)).toBe(false); // 133 > 132
    expect(isHit({ x: 287, y: 680 }, GIRL)).toBe(false);
  });

  it('muy lejos: miss', () => {
    expect(isHit({ x: 0, y: 0 }, GIRL)).toBe(false);
    expect(isHit({ x: 720, y: 1280 }, GIRL)).toBe(false);
    expect(isHit({ x: 360, y: 200 }, GIRL)).toBe(false);
  });

  it('las esquinas expandidas son inclusivas (borde = hit)', () => {
    const halfW = 72;
    const halfH = 132;
    expect(isHit({ x: 360 + halfW, y: 680 + halfH }, GIRL)).toBe(true);
    expect(isHit({ x: 360 - halfW, y: 680 - halfH }, GIRL)).toBe(true);
  });

  it('la esquina diagonal dentro de la expansión: hit (rectángulo, no elipse)', () => {
    // x=425 (semiancho 65 ≤ 72) e y=800 (semialto 120 ≤ 132): dentro.
    expect(isHit({ x: 425, y: 800 }, GIRL)).toBe(true);
    // x fuera por poco e y dentro: miss (cada eje cuenta por separado).
    expect(isHit({ x: 440, y: 800 }, GIRL)).toBe(false); // 80 > 72
    expect(isHit({ x: 425, y: 820 }, GIRL)).toBe(false); // 140 > 132
  });
});

describe('isHit — expansión personalizada', () => {
  it('expansión 1 = hitbox EXACTA al sprite', () => {
    expect(isHit({ x: 419, y: 680 }, GIRL, 1)).toBe(true); // borde original
    expect(isHit({ x: 421, y: 680 }, GIRL, 1)).toBe(false); // 1 px fuera
  });

  it('expansión 2 = muy generosa (semiancho 120)', () => {
    expect(isHit({ x: 479, y: 680 }, GIRL, 2)).toBe(true);
    expect(isHit({ x: 481, y: 680 }, GIRL, 2)).toBe(false);
  });
});

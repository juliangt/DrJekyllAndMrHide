/**
 * Etapa 4 — test de la puntuación de la acción (SPEC §5, módulo PURO):
 * constantes exactas, `timeBonus` con floor del restante, y el CASO DEL CA
 * del PLAN: 3 taps + 20 s restantes + quiz pendiente = 70 pts acumulados
 * (ejercitado contra el ScoreSystem REAL, como lo hace la escena).
 */
import { describe, expect, it } from 'vitest';
import {
  TAP_POINTS,
  TIME_BONUS_PER_SECOND,
  actionRoundScore,
  timeBonus,
} from '../gameplay/scoring';
import { ScoreSystem } from '../systems/ScoreSystem';

describe('constantes de puntuación (SPEC §5)', () => {
  it('tap exitoso = +10', () => {
    expect(TAP_POINTS).toBe(10);
  });

  it('bonus de tiempo = +2 por segundo restante', () => {
    expect(TIME_BONUS_PER_SECOND).toBe(2);
  });

  it('3 taps = 30 máximos (SPEC: «x3 = 30 máx.»)', () => {
    expect(3 * TAP_POINTS).toBe(30);
  });
});

describe('timeBonus — floor del restante', () => {
  it('20 s restantes exactos → 40 pts', () => {
    expect(timeBonus(20_000)).toBe(40);
  });

  it('floor: 19 999 ms → 19 s → 38 pts (el resto no se redondea)', () => {
    expect(timeBonus(19_999)).toBe(38);
    expect(timeBonus(20_001)).toBe(40);
    expect(timeBonus(1_999)).toBe(2);
    expect(timeBonus(1)).toBe(0);
  });

  it('45 s a tope → 90 (bonus máximo con timer del N1)', () => {
    expect(timeBonus(45_000)).toBe(90);
  });

  it.each([0, -1, -45_000, NaN, Number.POSITIVE_INFINITY])(
    'timeLeft=%s → 0 (timeout no da bonus, jamás negativo)',
    (ms) => {
      expect(timeBonus(ms)).toBe(0);
    },
  );

  it('monótona no decreciente con el tiempo restante', () => {
    let previous = 0;
    for (let ms = 0; ms <= 45_000; ms += 250) {
      const bonus = timeBonus(ms);
      expect(bonus).toBeGreaterThanOrEqual(previous);
      previous = bonus;
    }
  });
});

describe('actionRoundScore — caso del CA de la Etapa 4 (PLAN)', () => {
  it('3 taps + 20 s restantes + quiz PENDIENTE = 70 pts acumulados', () => {
    // 30 de taps + 40 de bonus de tiempo; el quiz (+100) es otra fase.
    expect(actionRoundScore(3, 20_000)).toBe(70);
  });

  it('el máximo teórico del N1 con quiz incluido ronda los ~214 del SPEC §5', () => {
    // El SPEC aproxima el bonus máximo a +84 (= 2×42 s): 30 + 100 + 84 = 214.
    expect(actionRoundScore(3, 42_000) + 100).toBe(214);
    // Con 45 s a tope el bonus real es 2×45 = 90 → 220 (el SPEC lo redondea
    // asumiendo que los 3 taps tardan unos segundos).
    expect(actionRoundScore(3, 45_000) + 100).toBe(220);
  });

  it('hits ≤ 0 o basura → solo el bonus de tiempo', () => {
    expect(actionRoundScore(0, 20_000)).toBe(40);
    expect(actionRoundScore(-3, 20_000)).toBe(40);
    expect(actionRoundScore(NaN, 20_000)).toBe(40);
  });
});

describe('CA integrado con ScoreSystem (como lo hace ActionScene)', () => {
  it('3 taps (+10 c/u) + bonus de 20 s = 70 en el sistema real', () => {
    const score = new ScoreSystem();
    // La escena: scoreSystem.reset() al entrar; +10 por hit; bonus al goal.
    score.reset();
    score.add(TAP_POINTS);
    score.add(TAP_POINTS);
    score.add(TAP_POINTS);
    score.add(timeBonus(20_000));
    expect(score.getScore()).toBe(70);
  });

  it('timeout → Reintentar: la tanda vuelve a 0 (SPEC §5 timeout)', () => {
    const score = new ScoreSystem();
    score.add(TAP_POINTS);
    score.add(TAP_POINTS);
    score.reset(); // lo que hace onRetry/onRetry de la escena
    expect(score.getScore()).toBe(0);
    // Y una segunda tanda ganada deja solo SUS puntos (la primera se fue).
    score.add(3 * TAP_POINTS + timeBonus(20_000));
    expect(score.getScore()).toBe(70);
  });
});

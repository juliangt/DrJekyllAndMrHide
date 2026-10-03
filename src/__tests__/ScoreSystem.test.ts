/**
 * Etapa 1 — test del ScoreSystem (SPEC §5): inicio en 0, incrementos,
 * evento `score:change` con payload, rechazo de valores no válidos
 * (negativos / 0 / no finitos — criterio documentado en el módulo) y reset.
 *
 * Etapa 6 — extensión DESGLOSE POR CATEGORÍA (SPEC §6 «puntaje final
 * desglosado»): `add(points, category?)` acumula también en la cubeta de la
 * categoría (`getBreakdown()`), `reset()` limpia total Y cubetas, y la API
 * vieja `add(points)` sin categoría NO se rompe (suma al total, cubetas a 0).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  SCORE_CATEGORY,
  SCORE_CHANGE_EVENT,
  ScoreSystem,
  type ScoreChangePayload,
} from '../systems/ScoreSystem';

describe('ScoreSystem — estado inicial', () => {
  it('arranca en 0', () => {
    const score = new ScoreSystem();
    expect(score.getScore()).toBe(0);
  });
});

describe('ScoreSystem — add', () => {
  it('acumula puntos: +10 y +100 → 110', () => {
    const score = new ScoreSystem();
    expect(score.add(10)).toBe(10);
    expect(score.add(100)).toBe(110);
    expect(score.getScore()).toBe(110);
  });

  it('los valores del SPEC §5 acumulan bien (30 taps-equivalentes + quiz + bonus)', () => {
    const score = new ScoreSystem();
    score.add(10);
    score.add(10);
    score.add(10); // 3 taps exitosos
    score.add(100); // quiz correcto
    score.add(84); // bonus máximo de tiempo
    expect(score.getScore()).toBe(214); // máximo teórico del Nivel 1
  });

  it.each([-10, -1, 0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rechaza %s sin cambiar el score ni emitir',
    (invalid) => {
      const score = new ScoreSystem();
      score.add(10);
      const handler = vi.fn();
      score.onChange(handler);
      expect(score.add(invalid)).toBe(10);
      expect(score.getScore()).toBe(10);
      expect(handler).not.toHaveBeenCalled();
    },
  );
});

describe('ScoreSystem — evento score:change', () => {
  it('add emite el evento con el score nuevo y el delta', () => {
    const score = new ScoreSystem();
    const events: ScoreChangePayload[] = [];
    score.onChange((payload) => events.push(payload));

    score.add(10);
    expect(events).toEqual([{ score: 10, delta: 10 }]);

    score.add(100);
    expect(events).toEqual([
      { score: 10, delta: 10 },
      { score: 110, delta: 100 },
    ]);
  });

  it('reset emite el evento y vuelve a 0', () => {
    const score = new ScoreSystem();
    score.add(30);
    const handler = vi.fn();
    score.onChange(handler);

    score.reset();
    expect(score.getScore()).toBe(0);
    expect(handler).toHaveBeenCalledWith({ score: 0, delta: -30 });
  });

  it('reset desde 0 también emite (delta 0)', () => {
    const score = new ScoreSystem();
    const handler = vi.fn();
    score.onChange(handler);
    score.reset();
    expect(handler).toHaveBeenCalledWith({ score: 0, delta: 0 });
  });

  it('todos los suscriptores reciben el evento', () => {
    const score = new ScoreSystem();
    const a = vi.fn();
    const b = vi.fn();
    score.onChange(a);
    score.onChange(b);
    score.add(10);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('la baja devuelta por onChange desuscribe', () => {
    const score = new ScoreSystem();
    const handler = vi.fn();
    const off = score.onChange(handler);
    off();
    score.add(10);
    expect(handler).not.toHaveBeenCalled();
  });

  it('un handler que se desuscribe a sí mismo durante el emit no rompe', () => {
    const score = new ScoreSystem();
    const events: ScoreChangePayload[] = [];
    const off = score.onChange((payload) => {
      events.push(payload);
      off();
    });
    const second = vi.fn();
    score.onChange(second);
    expect(() => score.add(10)).not.toThrow();
    expect(events).toEqual([{ score: 10, delta: 10 }]);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('el nombre del evento es score:change', () => {
    expect(SCORE_CHANGE_EVENT).toBe('score:change');
  });
});

describe('ScoreSystem — desglose por categoría (Etapa 6, SPEC §6)', () => {
  it('arranca con las tres cubetas a 0', () => {
    const score = new ScoreSystem();
    expect(score.getBreakdown()).toEqual({ taps: 0, timeBonus: 0, quiz: 0 });
  });

  it('add(points, category) acumula en la cubeta de la categoría', () => {
    const score = new ScoreSystem();
    score.add(10, SCORE_CATEGORY.taps);
    score.add(10, SCORE_CATEGORY.taps);
    score.add(10, SCORE_CATEGORY.taps);
    expect(score.getBreakdown().taps).toBe(30);
    expect(score.getBreakdown().quiz).toBe(0);

    score.add(100, SCORE_CATEGORY.quiz);
    expect(score.getBreakdown().quiz).toBe(100);

    score.add(40, SCORE_CATEGORY.timeBonus);
    expect(score.getBreakdown().timeBonus).toBe(40);

    // El total sigue siendo la fuente de verdad.
    expect(score.getScore()).toBe(170);
  });

  it('el desglose de una tanda completa cuadra con el CA (30 + 100 + 40 = 170)', () => {
    const score = new ScoreSystem();
    score.add(10, SCORE_CATEGORY.taps);
    score.add(10, SCORE_CATEGORY.taps);
    score.add(10, SCORE_CATEGORY.taps);
    score.add(40, SCORE_CATEGORY.timeBonus);
    score.add(100, SCORE_CATEGORY.quiz);
    expect(score.getBreakdown()).toEqual({ taps: 30, timeBonus: 40, quiz: 100 });
    const total = Object.values(score.getBreakdown()).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(score.getScore());
    expect(total).toBe(170);
  });

  it('getBreakdown devuelve una COPIA: mutarla no toca el estado interno', () => {
    const score = new ScoreSystem();
    score.add(10, SCORE_CATEGORY.taps);
    const breakdown = score.getBreakdown();
    breakdown.taps = 999;
    expect(score.getBreakdown().taps).toBe(10);
  });

  it('los valores rechazados (≤ 0 / no finitos) tampoco tocan la cubeta', () => {
    const score = new ScoreSystem();
    expect(score.add(-10, SCORE_CATEGORY.taps)).toBe(0);
    expect(score.add(0, SCORE_CATEGORY.taps)).toBe(0);
    expect(score.add(Number.NaN, SCORE_CATEGORY.quiz)).toBe(0);
    expect(score.getBreakdown()).toEqual({ taps: 0, timeBonus: 0, quiz: 0 });
    expect(score.getScore()).toBe(0);
  });

  it('COMPATIBILIDAD API vieja: add(points) sin categoría suma al total sin tocar cubetas', () => {
    const score = new ScoreSystem();
    expect(score.add(10)).toBe(10);
    expect(score.getScore()).toBe(10);
    expect(score.getBreakdown()).toEqual({ taps: 0, timeBonus: 0, quiz: 0 });
  });

  it('una categoría desconocida (basura en runtime) suma al total, no al desglose', () => {
    const score = new ScoreSystem();
    const bogus = 'mist' as unknown as typeof SCORE_CATEGORY.taps;
    expect(score.add(50, bogus)).toBe(50);
    expect(score.getScore()).toBe(50);
    expect(score.getBreakdown()).toEqual({ taps: 0, timeBonus: 0, quiz: 0 });
  });

  it('reset limpia el total Y las cubetas (descarte de tanda D5 / Jugar de nuevo)', () => {
    const score = new ScoreSystem();
    score.add(30, SCORE_CATEGORY.taps);
    score.add(40, SCORE_CATEGORY.timeBonus);
    score.add(100, SCORE_CATEGORY.quiz);
    score.reset();
    expect(score.getScore()).toBe(0);
    expect(score.getBreakdown()).toEqual({ taps: 0, timeBonus: 0, quiz: 0 });
  });

  it('el payload de score:change NO cambia (score + delta, sin desglose)', () => {
    const score = new ScoreSystem();
    const events: ScoreChangePayload[] = [];
    score.onChange((payload) => events.push(payload));
    score.add(10, SCORE_CATEGORY.taps);
    expect(events).toEqual([{ score: 10, delta: 10 }]);
  });

  it('las tres categorías del desglose son taps / timeBonus / quiz (valores = claves de la cubeta)', () => {
    expect(SCORE_CATEGORY.taps).toBe('taps');
    expect(SCORE_CATEGORY.timeBonus).toBe('timeBonus');
    expect(SCORE_CATEGORY.quiz).toBe('quiz');
  });
});

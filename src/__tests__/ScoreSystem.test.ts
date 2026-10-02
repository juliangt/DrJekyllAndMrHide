/**
 * Etapa 1 — test del ScoreSystem (SPEC §5): inicio en 0, incrementos,
 * evento `score:change` con payload, rechazo de valores no válidos
 * (negativos / 0 / no finitos — criterio documentado en el módulo) y reset.
 */
import { describe, expect, it, vi } from 'vitest';
import { SCORE_CHANGE_EVENT, ScoreSystem, type ScoreChangePayload } from '../systems/ScoreSystem';

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

/**
 * Etapa 4 — test del timer del minijuego (SPEC §4.2/§6, módulo PURO):
 * segundos mostrados (ceil), ventana crítica de 5 s, UN tick por segundo
 * (sin dobles ticks dentro del mismo segundo) y el ratio de la barra.
 */
import { describe, expect, it } from 'vitest';
import {
  CRITICAL_WINDOW_MS,
  isCriticalTime,
  secondsLeft,
  shouldTick,
  tickSecond,
  timerRatio,
} from '../gameplay/timerTick';

describe('secondsLeft — segundos a mostrar', () => {
  it('ceil: 44 999 ms todavía son «45»', () => {
    expect(secondsLeft(45_000)).toBe(45);
    expect(secondsLeft(44_999)).toBe(45);
    expect(secondsLeft(44_000)).toBe(44);
  });

  it('en la ventana crítica: 4 999 → 5; 4 001 → 5; 4 000 → 4', () => {
    expect(secondsLeft(4_999)).toBe(5);
    expect(secondsLeft(4_001)).toBe(5);
    expect(secondsLeft(4_000)).toBe(4);
    expect(secondsLeft(900)).toBe(1);
    expect(secondsLeft(1)).toBe(1);
  });

  it.each([0, -100, NaN])('timeLeft=%s → 0', (ms) => {
    expect(secondsLeft(ms)).toBe(0);
  });
});

describe('isCriticalTime — ventana de 5 s', () => {
  it('la ventana es exactamente 5 000 ms (SPEC §4.2)', () => {
    expect(CRITICAL_WINDOW_MS).toBe(5000);
  });

  it('fuera de la ventana: false', () => {
    expect(isCriticalTime(45_000)).toBe(false);
    expect(isCriticalTime(5_001)).toBe(false);
  });

  it('dentro de la ventana (incluido el borde): true', () => {
    expect(isCriticalTime(5_000)).toBe(true);
    expect(isCriticalTime(4_999)).toBe(true);
    expect(isCriticalTime(1)).toBe(true);
  });

  it('a 0 o menos ya NO es crítica (eso es timeout, no tick)', () => {
    expect(isCriticalTime(0)).toBe(false);
    expect(isCriticalTime(-1)).toBe(false);
  });

  it('ventana personalizable', () => {
    expect(isCriticalTime(3_000, 2_500)).toBe(false);
    expect(isCriticalTime(2_500, 2_500)).toBe(true);
  });
});

describe('tickSecond — el segundo ticable', () => {
  it('null fuera de la ventana y a 0', () => {
    expect(tickSecond(45_000)).toBeNull();
    expect(tickSecond(5_001)).toBeNull();
    expect(tickSecond(0)).toBeNull();
  });

  it('el segundo mostrado dentro de la ventana', () => {
    expect(tickSecond(5_000)).toBe(5);
    expect(tickSecond(4_650)).toBe(5);
    expect(tickSecond(4_000)).toBe(4);
    expect(tickSecond(350)).toBe(1);
  });
});

describe('shouldTick — un tick por segundo, sin dobles', () => {
  it('primer tick al ENTRAR en la ventana (5000 ms exactos)', () => {
    expect(shouldTick(5_000, null)).toBe(true);
  });

  it('sin doble tick dentro del MISMO segundo mostrado', () => {
    // Entra por 4 700 ms (segundo 5) → ticado; 4 550 sigue siendo segundo 5.
    expect(shouldTick(4_700, 5)).toBe(false);
    expect(shouldTick(4_001, 5)).toBe(false);
  });

  it('tick al cambiar de segundo: 5 → 4 → 3 → 2 → 1', () => {
    let last: number | null = null;
    const ticks: number[] = [];
    // 45 s → 0 en pasos de 100 ms (10 pasos por segundo): SOLO 5 ticks.
    for (let ms = 45_000; ms > 0; ms -= 100) {
      if (shouldTick(ms, last)) {
        const second = tickSecond(ms);
        ticks.push(second ?? -1);
        last = second;
      }
    }
    expect(ticks).toEqual([5, 4, 3, 2, 1]);
  });

  it('entrar a la ventana a mitad de segundo tica el segundo en curso', () => {
    // Primer frame bajo 5 000 ms: 4 720 → segundo 5 → tick.
    expect(shouldTick(4_720, null)).toBe(true);
  });

  it('fuera de la ventana nunca tica (lastTicked da igual)', () => {
    expect(shouldTick(45_000, null)).toBe(false);
    expect(shouldTick(6_000, 5)).toBe(false);
  });
});

describe('timerRatio — proporción de la barra (SPEC §6)', () => {
  it('llena al inicio, vacía al final', () => {
    expect(timerRatio(45_000, 45_000)).toBe(1);
    expect(timerRatio(0, 45_000)).toBe(0);
  });

  it('proporcional: mitad del tiempo = mitad de barra', () => {
    expect(timerRatio(22_500, 45_000)).toBeCloseTo(0.5, 6);
  });

  it('clamp: nunca > 1 ni < 0 (basura de entrada no rompe la barra)', () => {
    expect(timerRatio(50_000, 45_000)).toBe(1);
    expect(timerRatio(-5, 45_000)).toBe(0);
    expect(timerRatio(NaN, 45_000)).toBe(0);
    expect(timerRatio(1_000, 0)).toBe(0);
    expect(timerRatio(1_000, NaN)).toBe(0);
  });
});

/**
 * Etapa 4 — test del movimiento errático (SPEC §4.2, módulo PURO): respeta
 * `speedRange`, cambia dirección dentro de `dirChangeMs`, rebota en los 4
 * lados de la zona de juego, nunca sale de bounds y tolera dt variables.
 * Determinismo vía rng INYECTADO (secuencias fijas / grabadoras).
 */
import { describe, expect, it } from 'vitest';
import {
  erraticSpeed,
  initialErraticState,
  stepErratic,
  type ErraticOptions,
  type ErraticState,
} from '../gameplay/erraticMovement';

/** Parámetros del Nivel 1 (SPEC §4.2) + zona de juego de prueba. */
const OPTIONS: ErraticOptions = {
  speedRange: [120, 180],
  dirChangeMs: [800, 1500],
  bounds: { minX: 96, maxX: 624, minY: 380, maxY: 980 },
};

/** rng determinista que devuelve SIEMPRE n (para bordes de rangos). */
const constantRng = (n: number): (() => number) => (): number => n;

/** rng de secuencia grabable (registra cada número consumido). */
function sequenceRng(values: number[]): { rng: () => number; calls: () => number } {
  let calls = 0;
  const rng = (): number => {
    const value = values[Math.min(calls, values.length - 1)];
    calls++;
    return value;
  };
  return { rng, calls: () => calls };
}

/** Estado quieto en el centro apuntando a la derecha (para rebotes). */
function stateAt(partial: Partial<ErraticState>): ErraticState {
  return {
    x: 360,
    y: 680,
    vx: 150,
    vy: 0,
    nextDirChangeIn: 5000,
    ...partial,
  };
}

describe('initialErraticState', () => {
  it('nace en el CENTRO de la zona de juego', () => {
    const state = initialErraticState(constantRng(0.5), OPTIONS);
    expect(state.x).toBe((96 + 624) / 2);
    expect(state.y).toBe((380 + 980) / 2);
  });

  it('la velocidad inicial está dentro de speedRange [120, 180]', () => {
    for (const n of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
      const state = initialErraticState(constantRng(n), OPTIONS);
      expect(erraticSpeed(state)).toBeGreaterThanOrEqual(120);
      expect(erraticSpeed(state)).toBeLessThanOrEqual(180);
    }
  });

  it('el primer intervalo de cambio está dentro de dirChangeMs [800, 1500]', () => {
    for (const n of [0, 0.2, 0.5, 0.8, 0.99]) {
      const state = initialErraticState(constantRng(n), OPTIONS);
      expect(state.nextDirChangeIn).toBeGreaterThanOrEqual(800);
      expect(state.nextDirChangeIn).toBeLessThanOrEqual(1500);
    }
  });

  it('rng()=0.5 exacto: velocidad y intervalo en el punto medio del rango', () => {
    const state = initialErraticState(constantRng(0.5), OPTIONS);
    expect(erraticSpeed(state)).toBeCloseTo(150, 6);
    expect(state.nextDirChangeIn).toBeCloseTo(1150, 6);
  });
});

describe('stepErratic — integración del movimiento', () => {
  it('avanza según v·dt (px/s × s)', () => {
    const state = stateAt({ vx: 100, vy: -50 });
    const next = stepErratic(state, 1000, constantRng(0.5), OPTIONS);
    expect(next.x).toBeCloseTo(460, 6);
    expect(next.y).toBeCloseTo(630, 6);
    // La velocidad no cambia si no toca cambio de dirección.
    expect(next.vx).toBe(100);
    expect(next.vy).toBe(-50);
  });

  it('descuenta el tiempo al próximo cambio de dirección', () => {
    const next = stepErratic(stateAt({ nextDirChangeIn: 1000 }), 250, constantRng(0.5), OPTIONS);
    expect(next.nextDirChangeIn).toBe(750);
  });

  it.each([0, -5, NaN, Number.POSITIVE_INFINITY])('dt=%s: sin cambios (frame nulo)', (dt) => {
    const state = stateAt({ nextDirChangeIn: 1000 });
    expect(stepErratic(state, dt, constantRng(0.5), OPTIONS)).toBe(state);
  });

  it('dt variables (16.7, 50, 100, 250 ms) mantienen todos los invariantes', () => {
    for (const dt of [16.7, 50, 100, 250]) {
      let state = initialErraticState(Math.random, OPTIONS);
      for (let i = 0; i < 200; i++) {
        state = stepErratic(state, dt, Math.random, OPTIONS);
        expect(state.x).toBeGreaterThanOrEqual(OPTIONS.bounds.minX);
        expect(state.x).toBeLessThanOrEqual(OPTIONS.bounds.maxX);
        expect(state.y).toBeGreaterThanOrEqual(OPTIONS.bounds.minY);
        expect(state.y).toBeLessThanOrEqual(OPTIONS.bounds.maxY);
      }
    }
  });
});

describe('stepErratic — cambio aleatorio de dirección', () => {
  it('cambia de dirección al agotarse el intervalo (nunca después)', () => {
    // rng()=0.5: ángulo π, velocidad 150, intervalo 1150.
    const before = stateAt({ vx: 100, vy: 0, nextDirChangeIn: 800 });
    const noChange = stepErratic(before, 799, constantRng(0.5), OPTIONS);
    expect(noChange.vx).toBe(100); // aún no
    const change = stepErrStep(before, 801);
    expect(change.vx).not.toBe(100); // ya sí (nueva dirección sorteada)
  });

  it('el intervalo sorteado cae dentro de dirChangeMs', () => {
    for (const n of [0, 0.3, 0.7, 0.999]) {
      const next = stepErratic(stateAt({ nextDirChangeIn: 0 }), 16, constantRng(n), OPTIONS);
      expect(next.nextDirChangeIn).toBeGreaterThanOrEqual(800);
      expect(next.nextDirChangeIn).toBeLessThanOrEqual(1500);
    }
  });

  it('la nueva rapidez cae dentro de speedRange', () => {
    for (const n of [0, 0.25, 0.5, 0.75, 1 - 1e-9]) {
      const next = stepErratic(stateAt({ nextDirChangeIn: 0 }), 16, constantRng(n), OPTIONS);
      expect(erraticSpeed(next)).toBeGreaterThanOrEqual(120);
      expect(erraticSpeed(next)).toBeLessThanOrEqual(180);
    }
  });

  it('NO consume rng si no toca cambio de dirección (determinismo barato)', () => {
    const { rng, calls } = sequenceRng([0.5, 0.5, 0.5]);
    stepErratic(stateAt({ nextDirChangeIn: 5000 }), 100, rng, OPTIONS);
    expect(calls()).toBe(0);
  });

  it('un cambio de dirección consume exactamente 3 números del rng', () => {
    const { rng, calls } = sequenceRng([0.25, 0.5, 0.75]);
    stepErratic(stateAt({ nextDirChangeIn: 0 }), 100, rng, OPTIONS);
    expect(calls()).toBe(3);
  });

  it('determinista: mismo estado + misma secuencia rng → mismo resultado', () => {
    const values = [0.11, 0.42, 0.93];
    const a = stepErratic(stateAt({ nextDirChangeIn: 0 }), 100, sequenceRng(values).rng, OPTIONS);
    const b = stepErratic(stateAt({ nextDirChangeIn: 0 }), 100, sequenceRng(values).rng, OPTIONS);
    expect(a).toEqual(b);
  });
});

describe('stepErratic — rebote en los 4 bordes de la zona de juego', () => {
  it('borde izquierdo: clamp + vx invertida', () => {
    const next = stepErratic(stateAt({ x: 100, vx: -150 }), 100, constantRng(0.5), OPTIONS);
    expect(next.x).toBe(OPTIONS.bounds.minX);
    expect(next.vx).toBe(150);
  });

  it('borde derecho: clamp + vx invertida', () => {
    const next = stepErratic(stateAt({ x: 620, vx: 150 }), 100, constantRng(0.5), OPTIONS);
    expect(next.x).toBe(OPTIONS.bounds.maxX);
    expect(next.vx).toBe(-150);
  });

  it('borde superior: clamp + vy invertida', () => {
    const next = stepErratic(stateAt({ y: 390, vy: -200 }), 100, constantRng(0.5), OPTIONS);
    expect(next.y).toBe(OPTIONS.bounds.minY);
    expect(next.vy).toBe(200);
  });

  it('borde inferior: clamp + vy invertida', () => {
    const next = stepErratic(stateAt({ y: 970, vy: 200 }), 100, constantRng(0.5), OPTIONS);
    expect(next.y).toBe(OPTIONS.bounds.maxY);
    expect(next.vy).toBe(-200);
  });

  it('el rebote CONSERVA la rapidez (solo invierte el signo)', () => {
    const state = stateAt({ x: 620, vx: 130, vy: -50 });
    const next = stepErratic(state, 100, constantRng(0.5), OPTIONS);
    expect(erraticSpeed(next)).toBeCloseTo(erraticSpeed(state), 6);
  });

  it('un dt gigante que cruza el bounds de largo queda clampado dentro', () => {
    // 10 s a 180 px/s = 1800 px: atraviesa cualquier bounds de la zona.
    const next = stepErratic(stateAt({ vx: 180, vy: 0 }), 10000, constantRng(0.5), OPTIONS);
    expect(next.x).toBe(OPTIONS.bounds.maxX);
    expect(next.x).toBeLessThanOrEqual(OPTIONS.bounds.maxX);
  });
});

describe('stepErratic — fuzz de invariantes (nunca sale de bounds)', () => {
  it('1000 pasos aleatorios: posición siempre dentro de la zona', () => {
    let state = initialErraticState(Math.random, OPTIONS);
    for (let i = 0; i < 1000; i++) {
      const dt = Math.random() * 120;
      state = stepErratic(state, dt, Math.random, OPTIONS);
      expect(state.x).toBeGreaterThanOrEqual(OPTIONS.bounds.minX - 1e-9);
      expect(state.x).toBeLessThanOrEqual(OPTIONS.bounds.maxX + 1e-9);
      expect(state.y).toBeGreaterThanOrEqual(OPTIONS.bounds.minY - 1e-9);
      expect(state.y).toBeLessThanOrEqual(OPTIONS.bounds.maxY + 1e-9);
      expect(state.nextDirChangeIn).toBeGreaterThan(0);
    }
  });
});

/** Helper local: un paso con rng constante 0.5 (legibilidad del test). */
function stepErrStep(before: ErraticState, dt: number): ErraticState {
  return stepErratic(before, dt, constantRng(0.5), OPTIONS);
}

// ---------------------------------------------------------------------------
// Fase 3 — stepFlee: el patrón de HUIDA del N2 («tiende a alejarse del punto
// del último tap»). Mismos invariantes que stepErratic + giro de huida con
// la rapidez CONSERVADA.
// ---------------------------------------------------------------------------
import { DEFAULT_FLEE_BIAS, stepFlee } from '../gameplay/erraticMovement';

describe('stepFlee — contrato básico', () => {
  it('dt ≤ 0 o no finito: estado intacto (frame congelado, como N1)', () => {
    const state = stateAt({ vx: 150, vy: 0 });
    const threat = { x: 0, y: 0 };
    for (const dt of [0, -50, NaN, Number.POSITIVE_INFINITY]) {
      expect(stepFlee(state, dt, Math.random, OPTIONS, threat)).toBe(state);
    }
  });

  it('sin amenaza (threat=null) es IDÉNTICO a stepErratic (misma secuencia rng)', () => {
    const state = stateAt({});
    const a = stepFlee(state, 16, Math.random, OPTIONS, null);
    const b = stepErratic(state, 16, Math.random, OPTIONS);
    expect(a).toEqual(b);
  });

  it('bias 0 (o inválido) también degenera en stepErratic', () => {
    const state = stateAt({});
    const threat = { x: state.x - 100, y: state.y };
    const a = stepFlee(state, 16, Math.random, OPTIONS, threat, 0);
    const b = stepErratic(state, 16, Math.random, OPTIONS);
    expect(a).toEqual(b);
    const c = stepFlee(state, 16, Math.random, OPTIONS, threat, NaN);
    expect(c).toEqual(b);
  });

  it('CONSERVA la rapidez (solo gira el rumbo, nunca acelera ni frena)', () => {
    const state = stateAt({ vx: 150, vy: 60 });
    const threat = { x: state.x + 300, y: state.y - 200 };
    let next = state;
    for (let i = 0; i < 50; i++) {
      next = stepFlee(next, 33, Math.random, OPTIONS, threat);
      expect(erraticSpeed(next)).toBeCloseTo(erraticSpeed(stateAt({ vx: 150, vy: 60 })), 6);
    }
  });

  it('NO consume rng extra: misma cantidad de números que stepErratic', () => {
    const state = stateAt({ nextDirChangeIn: 10 }); // fuerza 1 re-sorteo
    const threat = { x: 0, y: 0 };
    const a = sequenceRng([0.5]);
    const b = sequenceRng([0.5]);
    stepFlee(state, 50, a.rng, OPTIONS, threat);
    stepErratic(state, 50, b.rng, OPTIONS);
    expect(a.calls()).toBe(b.calls());
  });
});

describe('stepFlee — el patrón de huida', () => {
  it('gira el rumbo ALEJÁNDOSE de la amenaza (proyección de huida creciente)', () => {
    // Corriendo DIRECTO hacia la amenaza, tras un paso el rumbo ya se abre.
    const state = stateAt({ vx: 150, vy: 0 });
    const threat = { x: state.x + 200, y: state.y }; // amenaza delante
    const next = stepFlee(state, 16, constantRng(0.5), OPTIONS, threat);
    const away = { x: -1, y: 0 }; // vector unitario de huida
    const dotBefore = (state.vx / erraticSpeed(state)) * away.x + (state.vy / erraticSpeed(state)) * away.y;
    const dotAfter = (next.vx / erraticSpeed(next)) * away.x + (next.vy / erraticSpeed(next)) * away.y;
    expect(dotAfter).toBeGreaterThan(dotBefore);
  });

  it('con el sesgo por defecto la distancia a la amenaza CRECE con los pasos', () => {
    const threat = { x: 360, y: 680 };
    let state = stateAt({});
    state = { ...state, x: threat.x + 120, y: threat.y }; // 120 px a la derecha
    const initialDistance = Math.hypot(state.x - threat.x, state.y - threat.y);
    for (let i = 0; i < 200; i++) {
      state = stepFlee(state, 33, Math.random, OPTIONS, threat);
    }
    const finalDistance = Math.hypot(state.x - threat.x, state.y - threat.y);
    expect(finalDistance).toBeGreaterThan(initialDistance);
  });

  it('bias 1 = huida pura: tras suficientes pasos se aleja en línea recta', () => {
    const threat = { x: 360, y: 680 };
    let state = stateAt({ x: threat.x + 150, y: threat.y, vx: -150, vy: 0 });
    for (let i = 0; i < 60; i++) {
      state = stepFlee(state, 33, Math.random, OPTIONS, threat, 1);
    }
    expect(state.x).toBeGreaterThan(threat.x + 150);
  });

  it('mantiene los invariantes de N1: rebote en bounds y re-sorteos en rango', () => {
    let state = initialErraticState(Math.random, OPTIONS);
    const threat = { x: 360, y: 680 };
    for (let i = 0; i < 1000; i++) {
      state = stepFlee(state, Math.random() * 120, Math.random, OPTIONS, threat, DEFAULT_FLEE_BIAS);
      expect(state.x).toBeGreaterThanOrEqual(OPTIONS.bounds.minX - 1e-9);
      expect(state.x).toBeLessThanOrEqual(OPTIONS.bounds.maxX + 1e-9);
      expect(state.y).toBeGreaterThanOrEqual(OPTIONS.bounds.minY - 1e-9);
      expect(state.y).toBeLessThanOrEqual(OPTIONS.bounds.maxY + 1e-9);
      expect(state.nextDirChangeIn).toBeGreaterThan(0);
    }
  });
});

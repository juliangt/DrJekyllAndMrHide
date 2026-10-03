/**
 * Etapa 4 — test del reducer del minijuego (SPEC §4.2, módulo PURO):
 * invariantes (hits ≤ goal, timeLeft ≥ 0), transiciones hit/tick/restart,
 * fase goal a la meta, fase timeout a 0, y transiciones inválidas IGNORADAS
 * (incluido el ciclo completo timeout → restart → playing del «Reintentar»).
 */
import { describe, expect, it } from 'vitest';
import {
  ActionEventType,
  ActionPhase,
  actionReducer,
  initialActionState,
  type ActionEvent,
  type ActionState,
} from '../gameplay/actionState';

/** Tanda del Nivel 1: meta 3, 45 s (SPEC §4.2). */
const N1 = { goal: 3, timeLimitSec: 45 };

const hit: ActionEvent = { type: ActionEventType.Hit };
const miss: ActionEvent = { type: ActionEventType.Miss };
const restart: ActionEvent = { type: ActionEventType.Restart };
const tick = (dtMs: number): ActionEvent => ({ type: ActionEventType.Tick, dtMs });

describe('initialActionState', () => {
  it('tanda del N1: 0 sustos, 45 000 ms, fase playing', () => {
    const state = initialActionState(N1);
    expect(state).toEqual({
      hits: 0,
      goal: 3,
      timeLeftMs: 45000,
      timeLimitMs: 45000,
      phase: ActionPhase.Playing,
    });
  });

  it('configs inválidas se clampan (goal ≥ 1, tiempo ≥ 0)', () => {
    expect(initialActionState({ goal: 0, timeLimitSec: 45 }).goal).toBe(1);
    expect(initialActionState({ goal: -2, timeLimitSec: 45 }).goal).toBe(1);
    expect(initialActionState({ goal: 3, timeLimitSec: -5 }).timeLeftMs).toBe(0);
    expect(initialActionState({ goal: 2.9, timeLimitSec: 1.5 }).goal).toBe(2);
    expect(initialActionState({ goal: 3, timeLimitSec: 1.5 }).timeLeftMs).toBe(1500);
  });
});

describe('actionReducer — hit (tap exitoso)', () => {
  it('suma un susto por hit', () => {
    const s1 = actionReducer(initialActionState(N1), hit);
    expect(s1.hits).toBe(1);
    expect(s1.phase).toBe(ActionPhase.Playing);
    const s2 = actionReducer(s1, hit);
    expect(s2.hits).toBe(2);
    expect(s2.phase).toBe(ActionPhase.Playing);
  });

  it('el hit n°3 (meta) pasa a fase goal EXACTAMENTE al alcanzarla', () => {
    let state = initialActionState(N1);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    expect(state.phase).toBe(ActionPhase.Playing);
    state = actionReducer(state, hit);
    expect(state.hits).toBe(3);
    expect(state.phase).toBe(ActionPhase.Goal);
  });

  it('hits > goal es IMPOSIBLE: hits extra en goal se ignoran', () => {
    let state = initialActionState(N1);
    for (let i = 0; i < 10; i++) {
      state = actionReducer(state, hit);
      expect(state.hits).toBeLessThanOrEqual(state.goal);
    }
    expect(state.hits).toBe(3);
  });

  it('goal=1: un solo hit gana la tanda', () => {
    const state = actionReducer(initialActionState({ goal: 1, timeLimitSec: 10 }), hit);
    expect(state.phase).toBe(ActionPhase.Goal);
  });
});

describe('actionReducer — miss (tap al aire, sin castigo)', () => {
  it('no cambia NADA del estado (ni hits ni timer ni fase)', () => {
    const before = actionReducer(initialActionState(N1), hit);
    expect(actionReducer(before, miss)).toBe(before);
    expect(actionReducer(initialActionState(N1), miss)).toEqual(initialActionState(N1));
  });

  it('miss es no-op en TODAS las fases', () => {
    for (const state of [
      initialActionState(N1),
      actionReducer(actionReducer(actionReducer(initialActionState(N1), hit), hit),
      hit), // goal
      actionReducer(initialActionState({ goal: 3, timeLimitSec: 0.05 }), tick(100)), // timeout
    ]) {
      expect(actionReducer(state, miss)).toBe(state);
    }
  });
});

describe('actionReducer — tick (timer)', () => {
  it('descuenta dt del tiempo restante', () => {
    const state = actionReducer(initialActionState(N1), tick(250));
    expect(state.timeLeftMs).toBe(44750);
  });

  it('acumula varios ticks', () => {
    let state = initialActionState(N1);
    for (let i = 0; i < 10; i++) {
      state = actionReducer(state, tick(100));
    }
    expect(state.timeLeftMs).toBe(44000);
  });

  it('NUNCA baja de 0: a 0 exacto pasa a fase timeout', () => {
    let state = initialActionState({ goal: 3, timeLimitSec: 1 });
    state = actionReducer(state, tick(999));
    expect(state.timeLeftMs).toBe(1);
    expect(state.phase).toBe(ActionPhase.Playing);
    state = actionReducer(state, tick(500));
    expect(state.timeLeftMs).toBe(0);
    expect(state.phase).toBe(ActionPhase.Timeout);
  });

  it('un tick que se pasa de largo clampa en 0 (sin negativos)', () => {
    const state = actionReducer(initialActionState({ goal: 3, timeLimitSec: 2 }), tick(10_000));
    expect(state.timeLeftMs).toBe(0);
    expect(state.phase).toBe(ActionPhase.Timeout);
  });

  it.each([0, -100, NaN, Number.POSITIVE_INFINITY])('dt=%s: frame ignorado', (dt) => {
    const state = initialActionState(N1);
    expect(actionReducer(state, tick(dt))).toBe(state);
  });

  it('tick con dt fraccionario (60 fps ≈ 16.67 ms) redondea sin perder tiempo', () => {
    let state = initialActionState({ goal: 3, timeLimitSec: 10 });
    for (let i = 0; i < 600; i++) {
      state = actionReducer(state, tick(1000 / 60));
    }
    expect(state.timeLeftMs).toBe(0);
    expect(state.phase).toBe(ActionPhase.Timeout);
  });
});

describe('actionReducer — fases terminales congelan el timer', () => {
  it('en fase goal el tick ya no descuenta (el bonus se calcula congelado)', () => {
    let state = initialActionState(N1);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    expect(state.phase).toBe(ActionPhase.Goal);
    const frozen = actionReducer(state, tick(5000));
    expect(frozen.timeLeftMs).toBe(state.timeLeftMs);
    expect(frozen.phase).toBe(ActionPhase.Goal);
  });

  it('en fase timeout el tick ya no descuenta', () => {
    let state = initialActionState({ goal: 3, timeLimitSec: 0.1 });
    state = actionReducer(state, tick(100));
    expect(state.phase).toBe(ActionPhase.Timeout);
    const frozen = actionReducer(state, tick(5000));
    expect(frozen.timeLeftMs).toBe(0);
    expect(frozen.phase).toBe(ActionPhase.Timeout);
  });

  it('hit tras la meta se ignora (no hay 4º susto)', () => {
    let state = initialActionState(N1);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    expect(actionReducer(state, hit).hits).toBe(3);
  });

  it('hit en timeout se ignora (la tanda ya murió)', () => {
    let state = initialActionState({ goal: 3, timeLimitSec: 0.05 });
    state = actionReducer(state, tick(100));
    expect(actionReducer(state, hit).hits).toBe(0);
  });
});

describe('actionReducer — restart («Reintentar», D6: SOLO el minijuego)', () => {
  it('desde timeout: tanda fresca (0 sustos, timer a tope) en fase restart', () => {
    let state: ActionState = initialActionState(N1);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    state = actionReducer(state, tick(45_000)); // se acaba el tiempo
    expect(state.phase).toBe(ActionPhase.Timeout);
    expect(state.hits).toBe(2);

    state = actionReducer(state, restart);
    expect(state).toEqual({
      hits: 0,
      goal: 3,
      timeLeftMs: 45000,
      timeLimitMs: 45000,
      phase: ActionPhase.Restart,
    });
  });

  it('el PRIMER tick tras restart reanuda el reloj SIN descontar ese frame', () => {
    let state: ActionState = initialActionState(N1);
    state = actionReducer(state, tick(45_000));
    state = actionReducer(state, restart);
    state = actionReducer(state, tick(16));
    expect(state.phase).toBe(ActionPhase.Playing);
    expect(state.timeLeftMs).toBe(45000);
    // A partir de ahí el reloj corre normal.
    state = actionReducer(state, tick(16));
    expect(state.timeLeftMs).toBe(44984);
  });

  it('restart desde playing se IGNORA (no hay botón, pero por si acaso)', () => {
    const state = actionReducer(initialActionState(N1), hit);
    expect(actionReducer(state, restart)).toBe(state);
  });

  it('restart desde goal se ignora (la meta ya ganó la tanda)', () => {
    let state = initialActionState(N1);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    expect(actionReducer(state, restart).phase).toBe(ActionPhase.Goal);
  });

  it('restart es idempotente: reiniciar dos veces es un solo reinicio', () => {
    let state: ActionState = initialActionState(N1);
    state = actionReducer(state, tick(45_000));
    state = actionReducer(state, restart);
    const once = state;
    expect(actionReducer(state, restart)).toBe(once); // ya no está en timeout
  });
});

describe('actionReducer — ciclo completo del CA de la etapa (timeout → reintento)', () => {
  it('timeout con 2 sustos → Reintentar → 45 s y 0 hits → meta 3/3 en fase goal', () => {
    let state = initialActionState(N1);

    // Dos sustos y se acaba el tiempo.
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    state = actionReducer(state, tick(45_000));
    expect(state.phase).toBe(ActionPhase.Timeout);

    // «Reintentar»: SOLO el minijuego (timer y contador a cero).
    state = actionReducer(state, restart);
    state = actionReducer(state, tick(16)); // reanudar
    expect(state.hits).toBe(0);
    expect(state.timeLeftMs).toBe(45000);

    // Segunda tanda ganada con ~20 s restantes.
    state = actionReducer(state, tick(25_000));
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    state = actionReducer(state, hit);
    expect(state.phase).toBe(ActionPhase.Goal);
    expect(state.timeLeftMs).toBe(20_000);
  });
});

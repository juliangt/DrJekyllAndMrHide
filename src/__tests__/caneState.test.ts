/**
 * Fase 3 — test del reducer del N2 «cane-strike» (módulo PURO): invariantes
 * (hits ≤ goal, timeLeft ≥ 0), la secuencia teatral falling → line → goal,
 * timer congelado desde el golpe de meta (el bonus se calcula sobre ese
 * instante), transiciones inválidas IGNORADAS y el ciclo completo del
 * «Reintentar» (timeout → restart → playing).
 */
import { describe, expect, it } from 'vitest';
import {
  CanePhase,
  caneReducer,
  initialCaneState,
  type CaneEvent,
  type CaneState,
} from '../gameplay/caneState';

/** Tanda del N2: meta 5, 60 s, secuencia 900/1600 ms (datos de la escena). */
const N2 = { goal: 5, timeLimitSec: 60, fallMs: 900, lineMs: 1600 };

const hit: CaneEvent = { type: 'hit' };
const miss: CaneEvent = { type: 'miss' };
const restart: CaneEvent = { type: 'restart' };
const advance: CaneEvent = { type: 'advance' };
const tick = (dtMs: number): CaneEvent => ({ type: 'tick', dtMs });

function playingWith(hits: number): CaneState {
  let state = initialCaneState(N2);
  for (let i = 0; i < hits; i++) {
    state = caneReducer(state, hit);
  }
  return state;
}

describe('initialCaneState', () => {
  it('tanda del N2: 0 bastonazos, 60 000 ms, fase playing, secuencia a 0', () => {
    expect(initialCaneState(N2)).toEqual({
      hits: 0,
      goal: 5,
      timeLeftMs: 60000,
      timeLimitMs: 60000,
      fallMs: 900,
      lineMs: 1600,
      sequenceMsLeft: 0,
      phase: CanePhase.Playing,
    });
  });

  it('configs inválidas se clampan (goal ≥ 1, tiempos ≥ 0)', () => {
    expect(initialCaneState({ goal: 0, timeLimitSec: 10, fallMs: 5, lineMs: 5 }).goal).toBe(1);
    expect(
      initialCaneState({ goal: 3, timeLimitSec: -1, fallMs: 5, lineMs: 5 }).timeLeftMs,
    ).toBe(0);
    expect(initialCaneState({ goal: 3, timeLimitSec: 1, fallMs: -5, lineMs: -5 }).fallMs).toBe(0);
  });

  it('sin secuencia (fallMs = lineMs = 0) el golpe de meta va DIRECTO a goal', () => {
    const state = caneReducer(
      initialCaneState({ goal: 2, timeLimitSec: 10, fallMs: 0, lineMs: 0 }),
      hit,
    );
    const final = caneReducer(state, hit);
    expect(final.phase).toBe(CanePhase.Goal);
  });
});

describe('caneReducer — hit (bastonazo)', () => {
  it('suma un bastonazo por hit sin llegar a la meta', () => {
    expect(playingWith(1).hits).toBe(1);
    expect(playingWith(4).phase).toBe(CanePhase.Playing);
  });

  it('el golpe n.º 5 (meta) pasa a falling EXACTAMENTE al alcanzarla', () => {
    const state = playingWith(5);
    expect(state.hits).toBe(5);
    expect(state.phase).toBe(CanePhase.Falling);
    expect(state.sequenceMsLeft).toBe(900);
  });

  it('hits > goal es IMPOSIBLE: hits extra en la secuencia se ignoran', () => {
    let state = playingWith(5);
    for (let i = 0; i < 10; i++) {
      state = caneReducer(state, hit);
      expect(state.hits).toBeLessThanOrEqual(state.goal);
    }
    expect(state.hits).toBe(5);
  });

  it('goal=1: un solo bastonazo gana (entra en falling)', () => {
    const state = caneReducer(
      initialCaneState({ goal: 1, timeLimitSec: 10, fallMs: 100, lineMs: 100 }),
      hit,
    );
    expect(state.phase).toBe(CanePhase.Falling);
  });
});

describe('caneReducer — miss (tap al aire, sin castigo)', () => {
  it('no cambia NADA del estado (ni hits ni timer ni fase)', () => {
    const before = playingWith(2);
    expect(caneReducer(before, miss)).toBe(before);
  });

  it('miss es no-op en TODAS las fases (incluida la secuencia)', () => {
    let state = playingWith(5); // falling
    expect(caneReducer(state, miss)).toBe(state);
    state = caneReducer(state, advance); // line
    expect(caneReducer(state, miss)).toBe(state);
  });
});

describe('caneReducer — la secuencia falling → line → goal', () => {
  it('el tick descuenta la secuencia y NUNCA el timer en falling', () => {
    let state = playingWith(5);
    state = caneReducer(state, tick(400));
    expect(state.phase).toBe(CanePhase.Falling);
    expect(state.sequenceMsLeft).toBe(500);
    expect(state.timeLeftMs).toBe(60000); // congelado
  });

  it('al agotarse falling pasa a line con SU duración (1600 ms)', () => {
    let state = playingWith(5);
    state = caneReducer(state, tick(899));
    expect(state.phase).toBe(CanePhase.Falling);
    state = caneReducer(state, tick(1));
    expect(state.phase).toBe(CanePhase.Line);
    expect(state.sequenceMsLeft).toBe(1600);
  });

  it('al agotarse line pasa a goal (la escena suma el bonus y va al QUIZ)', () => {
    let state = playingWith(5);
    state = caneReducer(state, tick(900));
    state = caneReducer(state, tick(1599));
    expect(state.phase).toBe(CanePhase.Line);
    state = caneReducer(state, tick(1));
    expect(state.phase).toBe(CanePhase.Goal);
    expect(state.sequenceMsLeft).toBe(0);
  });

  it('la línea congelada NO corre el timer del bonus', () => {
    let state = playingWith(5);
    state = caneReducer(state, tick(900));
    state = caneReducer(state, tick(1600));
    expect(state.timeLeftMs).toBe(60000);
  });

  it('advance salta la secuencia un paso; fuera de falling/line se ignora', () => {
    let state = playingWith(5);
    state = caneReducer(state, advance);
    expect(state.phase).toBe(CanePhase.Line);
    state = caneReducer(state, advance);
    expect(state.phase).toBe(CanePhase.Goal);
    expect(caneReducer(state, advance)).toBe(state); // goal: no-op
    expect(caneReducer(playingWith(2), advance)).toEqual(playingWith(2)); // playing: no-op
  });

  it('dt degenerado en la secuencia: frame ignorado (ni avanza ni se salta)', () => {
    let state = playingWith(5);
    for (const dt of [0, -100, NaN, Number.POSITIVE_INFINITY]) {
      expect(caneReducer(state, tick(dt))).toBe(state);
    }
    state = caneReducer(state, tick(400));
    for (const dt of [0, -100, NaN, Number.POSITIVE_INFINITY]) {
      expect(caneReducer(state, tick(dt))).toBe(state);
    }
  });
});

describe('caneReducer — tick del timer (fase playing)', () => {
  it('descuenta dt del tiempo restante', () => {
    expect(caneReducer(initialCaneState(N2), tick(250)).timeLeftMs).toBe(59750);
  });

  it('NUNCA baja de 0: a 0 exacto pasa a fase timeout', () => {
    let state = initialCaneState({ ...N2, timeLimitSec: 1 });
    state = caneReducer(state, tick(999));
    expect(state.phase).toBe(CanePhase.Playing);
    state = caneReducer(state, tick(500));
    expect(state.timeLeftMs).toBe(0);
    expect(state.phase).toBe(CanePhase.Timeout);
  });

  it('tick con dt fraccionario (60 fps) no deja fantasmas de redondeo', () => {
    let state = initialCaneState({ ...N2, timeLimitSec: 10 });
    for (let i = 0; i < 600; i++) {
      state = caneReducer(state, tick(1000 / 60));
    }
    expect(state.timeLeftMs).toBe(0);
    expect(state.phase).toBe(CanePhase.Timeout);
  });
});

describe('caneReducer — fases terminales congelan todo', () => {
  it('en goal el tick no descuenta nada (ni timer ni fase)', () => {
    let state = playingWith(5);
    state = caneReducer(state, tick(900));
    state = caneReducer(state, tick(1600));
    const frozen = caneReducer(state, tick(5000));
    expect(frozen.phase).toBe(CanePhase.Goal);
    expect(frozen.timeLeftMs).toBe(state.timeLeftMs);
  });

  it('en timeout el tick ya no descuenta', () => {
    let state = initialCaneState({ ...N2, timeLimitSec: 0.1 });
    state = caneReducer(state, tick(100));
    expect(state.phase).toBe(CanePhase.Timeout);
    const frozen = caneReducer(state, tick(5000));
    expect(frozen.timeLeftMs).toBe(0);
  });

  it('hit tras la meta se ignora (no hay 6.º bastonazo)', () => {
    expect(playingWith(5).hits).toBe(5);
    expect(caneReducer(playingWith(5), hit).phase).toBe(CanePhase.Falling);
  });
});

describe('caneReducer — restart («Reintentar», D6: SOLO el minijuego)', () => {
  it('desde timeout: tanda fresca (0 hits, timer a tope) en fase restart', () => {
    let state: CaneState = playingWith(3);
    state = caneReducer(state, tick(60000)); // se acaba el tiempo
    expect(state.phase).toBe(CanePhase.Timeout);
    state = caneReducer(state, restart);
    expect(state).toEqual({
      hits: 0,
      goal: 5,
      timeLeftMs: 60000,
      timeLimitMs: 60000,
      fallMs: 900,
      lineMs: 1600,
      sequenceMsLeft: 0,
      phase: CanePhase.Restart,
    });
  });

  it('el PRIMER tick tras restart reanuda el reloj SIN descontar ese frame', () => {
    let state: CaneState = initialCaneState(N2);
    state = caneReducer(state, tick(60000));
    state = caneReducer(state, restart);
    state = caneReducer(state, tick(16));
    expect(state.phase).toBe(CanePhase.Playing);
    expect(state.timeLeftMs).toBe(60000);
    state = caneReducer(state, tick(16));
    expect(state.timeLeftMs).toBe(59984);
  });

  it('restart desde playing/goal se IGNORA; es idempotente tras reiniciar', () => {
    const playing = playingWith(2);
    expect(caneReducer(playing, restart)).toBe(playing);
    const goal = caneReducer(caneReducer(playingWith(5), advance), advance);
    expect(caneReducer(goal, restart)).toBe(goal);
    let state: CaneState = initialCaneState(N2);
    state = caneReducer(state, tick(60000));
    state = caneReducer(state, restart);
    expect(caneReducer(state, restart)).toBe(state);
  });

  it('ciclo completo: timeout con 4 hits → Reintentar → meta 5/5 en goal', () => {
    let state: CaneState = playingWith(4);
    state = caneReducer(state, tick(60000));
    expect(state.phase).toBe(CanePhase.Timeout);
    state = caneReducer(state, restart);
    state = caneReducer(state, tick(16)); // reanudar
    expect(state.hits).toBe(0);
    expect(state.timeLeftMs).toBe(60000);
    state = caneReducer(state, tick(20000)); // 40 s restantes
    state = playingFrom(state, 5);
    state = caneReducer(state, advance); // falling → line
    state = caneReducer(state, advance); // line → goal
    expect(state.phase).toBe(CanePhase.Goal);
    expect(state.timeLeftMs).toBe(40000);
  });

  function playingFrom(start: CaneState, hits: number): CaneState {
    let state = start;
    for (let i = 0; i < hits; i++) state = caneReducer(state, hit);
    return state;
  }
});

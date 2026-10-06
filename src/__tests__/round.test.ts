/**
 * Fase 3 — test del glue tipado de gameplay/round: el superconjunto de
 * eventos, los accesores de lectura sobre la unión de estados y
 * `adaptRoundReducer` (el ÚNICO punto con casts) elevando los tres reducers
 * a la firma unificada que consume `ActionScene`.
 */
import { describe, expect, it } from 'vitest';
import { actionReducer, initialActionState } from '../gameplay/actionState';
import { caneReducer, initialCaneState } from '../gameplay/caneState';
import {
  initialTransformState,
  transformReducer,
  type TransformState,
} from '../gameplay/transformState';
import {
  RoundEventType,
  adaptRoundReducer,
  roundGoal,
  roundHits,
  roundTimeLeftMs,
  roundTimeLimitMs,
  type AnyRoundState,
  type RoundEvent,
} from '../gameplay/round';

describe('RoundEventType — el vocabulario compartido', () => {
  it('los literales coinciden con los de los reducers individuales', () => {
    expect(RoundEventType.Hit).toBe('hit');
    expect(RoundEventType.Miss).toBe('miss');
    expect(RoundEventType.Tick).toBe('tick');
    expect(RoundEventType.Restart).toBe('restart');
    expect(RoundEventType.Advance).toBe('advance');
    expect(RoundEventType.Start).toBe('start');
  });
});

describe('adaptRoundReducer — eleva los tres reducers a la firma unificada', () => {
  const dispatch = (reduce: (s: AnyRoundState, e: RoundEvent) => AnyRoundState) => reduce;

  it('N1 actionReducer: hit suma y la meta pasa a goal', () => {
    const reduce = dispatch(adaptRoundReducer(actionReducer));
    let state: AnyRoundState = initialActionState({ goal: 2, timeLimitSec: 10 });
    state = reduce(state, { type: RoundEventType.Hit });
    expect(roundHits(state)).toBe(1);
    state = reduce(state, { type: RoundEventType.Hit });
    expect(state.phase).toBe('goal');
  });

  it('N2 caneReducer: hit de meta entra en falling y advance llega a goal', () => {
    const reduce = dispatch(adaptRoundReducer(caneReducer));
    let state: AnyRoundState = initialCaneState({
      goal: 1,
      timeLimitSec: 10,
      fallMs: 200,
      lineMs: 300,
    });
    state = reduce(state, { type: RoundEventType.Hit });
    expect(state.phase).toBe('falling');
    state = reduce(state, { type: RoundEventType.Advance });
    expect(state.phase).toBe('line');
    state = reduce(state, { type: RoundEventType.Advance });
    expect(state.phase).toBe('goal');
  });

  it('N3 transformReducer: start arranca la tanda y hit abre la ventana Jekyll', () => {
    const reduce = dispatch(adaptRoundReducer(transformReducer));
    let state: AnyRoundState = initialTransformState({
      goal: 2,
      timeLimitSec: 10,
      revertMs: 3000,
      fallMs: 200,
    });
    expect(state.phase).toBe('intro');
    state = reduce(state, { type: RoundEventType.Start });
    expect(state.phase).toBe('ready');
    state = reduce(state, { type: RoundEventType.Tick, dtMs: 16 });
    expect(state.phase).toBe('playing');
    state = reduce(state, { type: RoundEventType.Hit });
    expect(state.phase).toBe('playing');
    expect((state as TransformState).form).toBe('jekyll');
  });

  it('los eventos que un reducer no consume se IGNORAN (no rompen)', () => {
    const reduce = dispatch(adaptRoundReducer(actionReducer));
    const state: AnyRoundState = initialActionState({ goal: 2, timeLimitSec: 10 });
    expect(reduce(state, { type: RoundEventType.Advance })).toBe(state);
    expect(reduce(state, { type: RoundEventType.Start })).toBe(state);
  });
});

describe('accesores de lectura sobre la unión de estados', () => {
  it('leen hits/goal/tiempo de los tres estados sin narrows en la escena', () => {
    const n1: AnyRoundState = initialActionState({ goal: 3, timeLimitSec: 45 });
    const n2: AnyRoundState = initialCaneState({
      goal: 5,
      timeLimitSec: 60,
      fallMs: 900,
      lineMs: 1600,
    });
    const n3: AnyRoundState = initialTransformState({
      goal: 6,
      timeLimitSec: 90,
      revertMs: 3000,
      fallMs: 900,
    });
    for (const state of [n1, n2, n3]) {
      expect(roundHits(state)).toBe(0);
      expect(roundGoal(state)).toBeGreaterThan(0);
      expect(roundTimeLeftMs(state)).toBe(roundTimeLimitMs(state));
    }
  });
});

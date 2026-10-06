/**
 * Fase 3 — test del reducer del N3 «transform-target» (módulo PURO): fase
 * intro con timer PARADO, arranque start → ready → playing, golpes SOLO
 * sobre Hyde, ventana Jekyll de EXACTAMENTE `revertMs`, meta 6/6 con caída,
 * timeout/restart (D6) e idempotencia del skip de la intro.
 */
import { describe, expect, it } from 'vitest';
import {
  TargetForm,
  TransformPhase,
  initialTransformState,
  transformReducer,
  type TransformEvent,
  type TransformState,
} from '../gameplay/transformState';

/** Tanda del N3: meta 6, 90 s, ventana Jekyll de 3000 ms (datos de level3). */
const N3 = { goal: 6, timeLimitSec: 90, revertMs: 3000, fallMs: 900 };

const hit: TransformEvent = { type: 'hit' };
const miss: TransformEvent = { type: 'miss' };
const start: TransformEvent = { type: 'start' };
const restart: TransformEvent = { type: 'restart' };
const tick = (dtMs: number): TransformEvent => ({ type: 'tick', dtMs });

/** Estado en fase playing (la escena llega aquí tras la intro + primer tick). */
function playingState(): TransformState {
  let state = initialTransformState(N3);
  state = transformReducer(state, start);
  state = transformReducer(state, tick(16));
  expect(state.phase).toBe(TransformPhase.Playing);
  return state;
}

/** Aplica `hits` golpes con sus ventanas (3000 ms entre golpes). */
function withHits(base: TransformState, hits: number): TransformState {
  let state = base;
  for (let i = 0; i < hits; i++) {
    state = transformReducer(state, hit);
    if (i < hits - 1) {
      state = transformReducer(state, tick(3000)); // ventana fuera → Hyde
    }
  }
  return state;
}

describe('initialTransformState', () => {
  it('nace en fase intro, Hyde golpeable, 90 000 ms, ventana a 0', () => {
    expect(initialTransformState(N3)).toEqual({
      hits: 0,
      goal: 6,
      timeLeftMs: 90000,
      timeLimitMs: 90000,
      revertMs: 3000,
      fallMs: 900,
      form: TargetForm.Hyde,
      revertInMs: 0,
      sequenceMsLeft: 0,
      phase: TransformPhase.Intro,
    });
  });

  it('configs inválidas se clampan (goal ≥ 1, tiempos ≥ 0)', () => {
    const state = initialTransformState({ goal: 0, timeLimitSec: -3, revertMs: -1, fallMs: -2 });
    expect(state.goal).toBe(1);
    expect(state.timeLeftMs).toBe(0);
    expect(state.revertMs).toBe(0);
    expect(state.fallMs).toBe(0);
  });
});

describe('transformReducer — intro del asedio (el timer NO corre)', () => {
  it('el tick en intro no descuenta NADA (ni timer ni ventana ni forma)', () => {
    const state = initialTransformState(N3);
    const after = transformReducer(state, tick(5000));
    expect(after).toBe(state);
  });

  it('start pasa a ready; el PRIMER tick arranca el reloj sin descontar frame', () => {
    let state = initialTransformState(N3);
    state = transformReducer(state, start);
    expect(state.phase).toBe(TransformPhase.Ready);
    state = transformReducer(state, tick(16));
    expect(state.phase).toBe(TransformPhase.Playing);
    expect(state.timeLeftMs).toBe(90000); // sin descontar ese frame
  });

  it('start es idempotente (el skip de la intro no rompe nada) y fuera de intro se ignora', () => {
    let state = initialTransformState(N3);
    state = transformReducer(state, start);
    expect(transformReducer(state, start)).toBe(state); // ya en ready
    const playing = playingState();
    expect(transformReducer(playing, start)).toBe(playing);
  });
});

describe('transformReducer — hit: solo Hyde cuenta', () => {
  it('un golpe a Hyde suma y abre la ventana Jekyll EXACTA de revertMs', () => {
    const state = transformReducer(playingState(), hit);
    expect(state.hits).toBe(1);
    expect(state.form).toBe(TargetForm.Jekyll);
    expect(state.revertInMs).toBe(3000);
  });

  it('un golpe a Jekyll se IGNORA (no suma, no reinicia la ventana)', () => {
    let state = transformReducer(playingState(), hit);
    const before = state;
    state = transformReducer(state, hit);
    expect(state).toBe(before);
    expect(state.hits).toBe(1);
    expect(state.form).toBe(TargetForm.Jekyll);
    expect(state.revertInMs).toBe(3000);
  });

  it('la ventana dura EXACTAMENTE revertMs: 2999 ms sigue Jekyll, a 3000 vuelve Hyde', () => {
    let state = transformReducer(playingState(), hit);
    state = transformReducer(state, tick(2999));
    expect(state.form).toBe(TargetForm.Jekyll);
    expect(state.revertInMs).toBe(1);
    state = transformReducer(state, tick(1));
    expect(state.form).toBe(TargetForm.Hyde);
    expect(state.revertInMs).toBe(0);
  });

  it('mientras es Jekyll el timer SÍ corre (la tregua no para el reloj)', () => {
    let state = transformReducer(playingState(), hit);
    state = transformReducer(state, tick(1000));
    expect(state.timeLeftMs).toBe(89000);
    expect(state.revertInMs).toBe(2000);
  });

  it('hit y timeout compiten en el mismo tick: gana el timeout', () => {
    let state = playingState();
    state = transformReducer(state, { type: 'tick', dtMs: 89990 });
    expect(state.phase).toBe(TransformPhase.Playing);
    state = transformReducer(state, tick(16));
    expect(state.phase).toBe(TransformPhase.Timeout);
  });
});

describe('transformReducer — miss (sin castigo, SPEC §4.2)', () => {
  it('no cambia NADA del estado, en cualquier forma y fase', () => {
    const hyde = playingState();
    expect(transformReducer(hyde, miss)).toBe(hyde);
    const jekyll = transformReducer(hyde, hit);
    expect(transformReducer(jekyll, miss)).toBe(jekyll);
  });
});

describe('transformReducer — tick del timer (fase playing, Hyde)', () => {
  it('descuenta dt y a 0 exacto pasa a timeout', () => {
    let state = playingState();
    state = transformReducer(state, tick(89999));
    expect(state.timeLeftMs).toBe(1);
    expect(state.phase).toBe(TransformPhase.Playing);
    state = transformReducer(state, tick(500));
    expect(state.timeLeftMs).toBe(0);
    expect(state.phase).toBe(TransformPhase.Timeout);
  });

  it('dt degenerado: frame ignorado', () => {
    const state = playingState();
    for (const dt of [0, -100, NaN, Number.POSITIVE_INFINITY]) {
      expect(transformReducer(state, tick(dt))).toBe(state);
    }
  });

  it('tick con dt fraccionario (60 fps) no deja fantasmas de redondeo', () => {
    let state = initialTransformState({ ...N3, timeLimitSec: 10 });
    state = transformReducer(state, start);
    state = transformReducer(state, tick(16));
    for (let i = 0; i < 600; i++) {
      state = transformReducer(state, tick(1000 / 60));
    }
    expect(state.timeLeftMs).toBe(0);
    expect(state.phase).toBe(TransformPhase.Timeout);
  });
});

describe('transformReducer — meta 6/6: caída y goal', () => {
  it('el golpe de meta NO transforma: Hyde cae siendo Hyde (falling)', () => {
    let state = withHits(playingState(), 5);
    state = transformReducer(state, tick(3000)); // cierra la ventana del 5.º golpe
    expect(state.hits).toBe(5);
    expect(state.form).toBe(TargetForm.Hyde);
    state = transformReducer(state, hit);
    expect(state.hits).toBe(6);
    expect(state.form).toBe(TargetForm.Hyde);
    expect(state.revertInMs).toBe(0);
    expect(state.phase).toBe(TransformPhase.Falling);
    expect(state.sequenceMsLeft).toBe(900);
  });

  it('la secuencia de caída avanza con tick y termina en goal', () => {
    let state = withHits(playingState(), 5);
    state = transformReducer(state, tick(3000)); // ventana del 5.º golpe fuera
    state = transformReducer(state, hit);
    state = transformReducer(state, tick(899));
    expect(state.phase).toBe(TransformPhase.Falling);
    state = transformReducer(state, tick(1));
    expect(state.phase).toBe(TransformPhase.Goal);
    expect(state.sequenceMsLeft).toBe(0);
  });

  it('en falling/goal el timer y la forma quedan congelados; hits extra se ignoran', () => {
    let state = withHits(playingState(), 5);
    state = transformReducer(state, tick(3000)); // ventana del 5.º golpe fuera
    state = transformReducer(state, hit);
    const frozenTime = state.timeLeftMs;
    state = transformReducer(state, tick(5000));
    expect(state.phase).toBe(TransformPhase.Goal);
    expect(state.timeLeftMs).toBe(frozenTime);
    expect(transformReducer(state, hit)).toBe(state);
    expect(state.hits).toBe(6);
  });

  it('sin fallMs configurado el golpe de meta va DIRECTO a goal', () => {
    let state = initialTransformState({ ...N3, fallMs: 0 });
    state = transformReducer(state, start);
    state = transformReducer(state, tick(16));
    state = withHits(state, 6);
    expect(state.phase).toBe(TransformPhase.Goal);
  });
});

describe('transformReducer — restart («Reintentar», D6: SOLO el minijuego)', () => {
  it('desde timeout: tanda fresca, Hyde golpeable, ventana a 0, fase restart', () => {
    let state: TransformState = playingState();
    state = transformReducer(state, hit);
    state = transformReducer(state, tick(90000));
    expect(state.phase).toBe(TransformPhase.Timeout);
    state = transformReducer(state, restart);
    expect(state).toEqual({
      hits: 0,
      goal: 6,
      timeLeftMs: 90000,
      timeLimitMs: 90000,
      revertMs: 3000,
      fallMs: 900,
      form: TargetForm.Hyde,
      revertInMs: 0,
      sequenceMsLeft: 0,
      phase: TransformPhase.Restart,
    });
  });

  it('el PRIMER tick tras restart reanuda el reloj SIN descontar ese frame', () => {
    let state: TransformState = playingState();
    state = transformReducer(state, tick(90000));
    state = transformReducer(state, restart);
    state = transformReducer(state, tick(16));
    expect(state.phase).toBe(TransformPhase.Playing);
    expect(state.timeLeftMs).toBe(90000);
  });

  it('restart fuera de timeout se ignora y es idempotente tras reiniciar', () => {
    const playing = playingState();
    expect(transformReducer(playing, restart)).toBe(playing);
    let state: TransformState = playingState();
    state = transformReducer(state, tick(90000));
    state = transformReducer(state, restart);
    expect(transformReducer(state, restart)).toBe(state);
  });

  it('ciclo completo: timeout → Reintentar → 6 golpes con ventanas → goal', () => {
    let state: TransformState = playingState();
    state = transformReducer(state, tick(90000));
    state = transformReducer(state, restart);
    state = transformReducer(state, tick(16)); // reanudar
    state = withHits(state, 6);
    expect(state.phase).toBe(TransformPhase.Falling);
    expect(state.hits).toBe(6);
    state = transformReducer(state, tick(900));
    expect(state.phase).toBe(TransformPhase.Goal);
  });
});

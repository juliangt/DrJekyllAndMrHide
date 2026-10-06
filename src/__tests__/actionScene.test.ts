/**
 * Etapa 4 + Fase 3 — test de ActionScene como CAPA FINA data-driven (estilo
 * tests de game.config: se lee el ARCHIVO como fuente, porque importarlo
 * cargaría Phaser y jsdom no puede). Se valida que la escena CONSUME los
 * módulos puros de gameplay/ para las TRES mecánicas (tap-target N1,
 * cane-strike N2, transform-target N3), que arrastra multi-touch, que
 * resetea la tanda al entrar y al reintentar, y que sus dos salidas
 * (QUIZ / MENU) y el overlay GAME_OVER están cableados según SPEC
 * §3/§4.2/§6. Las REGLAS de las mecánicas nuevas se ejercitan con sus
 * reducers puros + los datos reales de level2/level3 (fakes estructurales
 * del cableado de escena).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { level2 } from '../config/levels/level2';
import { level3 } from '../config/levels/level3';
import type {
  CaneStrikeActionConfig,
  TransformTargetActionConfig,
} from '../config/levels/types';
import {
  CanePhase,
  caneReducer,
  initialCaneState,
  type CaneEvent,
} from '../gameplay/caneState';
import {
  TargetForm,
  TransformPhase,
  initialTransformState,
  transformReducer,
  type TransformEvent,
} from '../gameplay/transformState';
import { timeBonus } from '../gameplay/scoring';

const source = readFileSync(resolve(process.cwd(), 'src/scenes/ActionScene.ts'), 'utf8');

describe('ActionScene — consume los módulos PUROS de gameplay (arquitectura)', () => {
  it('el estado lo decide el reducer actionReducer (nada de lógica inline)', () => {
    expect(source).toContain('actionReducer');
    expect(source).toContain('initialActionState');
    expect(source).toContain('ActionEventType.Tick');
    expect(source).toContain('ActionEventType.Hit');
    expect(source).toContain('ActionEventType.Restart');
  });

  it('Fase 3: despacha por mecánica a los reducers PUROS caneState/transformState', () => {
    // El guard de la Fase 1 ya no existe: las tres mecánicas están cableadas.
    expect(source).not.toContain('aún no está implementada');
    expect(source).toContain("case 'cane-strike'");
    expect(source).toContain("case 'transform-target'");
    expect(source).toContain('initialCaneState');
    expect(source).toContain('caneReducer');
    expect(source).toContain('initialTransformState');
    expect(source).toContain('transformReducer');
    // El glue unificado de eventos (único punto con casts del proyecto).
    expect(source).toContain('adaptRoundReducer');
    expect(source).toContain('RoundEventType');
  });

  it('movimiento errático por stepErratic con rng inyectable (+ huida N2)', () => {
    expect(source).toContain('stepErratic');
    expect(source).toContain('initialErraticState');
    expect(source).toContain('stepFlee');
  });

  it('hit-test geométrico puro isHit (hitbox +20 %)', () => {
    expect(source).toContain('isHit');
  });

  it('bonus de tiempo por timeBonus y tick sonoro por shouldTick', () => {
    expect(source).toContain('timeBonus');
    expect(source).toContain('shouldTick');
    expect(source).toContain('tickSecond');
  });

  it('layout, textos y SECUENCIAS desde los DATOS de gameplay (sin números mágicos)', () => {
    expect(source).toContain('ACTION_LAYOUT');
    expect(source).toContain('ACTION_FEEDBACK');
    expect(source).toContain('GAME_OVER_OVERLAY');
    expect(source).toContain('GAME_OVER_STYLE');
    // Fase 3: las secuencias animadas son DATOS (gameplay/actionSequences).
    expect(source).toContain('CANE_SWING');
    expect(source).toContain('FALL_SEQUENCE');
    expect(source).toContain('VICTORY_LINE');
    expect(source).toContain('TRANSFORM_ANIM');
    expect(source).toContain('SIEGE_INTRO');
    expect(source).toContain('SIEGE_ENTRANCE');
  });

  it('nivel activo por scene-start data {levelId} (genérica, como NARRATIVE)', () => {
    expect(source).toContain('activeLevelFor(data.levelId)');
    expect(source).toContain('interface ActionSceneData');
  });
});

describe('ActionScene — ciclo de la tanda (SPEC §4.2/§5)', () => {
  it('al entrar a ACTION: scoreSystem.reset() (tanda nueva)', () => {
    const createBlock = source.slice(source.indexOf('create(): void'));
    expect(createBlock.indexOf('scoreSystem.reset()')).toBeGreaterThan(-1);
  });

  it('«Reintentar» también resetea el puntaje de la tanda a 0', () => {
    const retryBlock = source.slice(source.indexOf('onRetry()'));
    expect(retryBlock.indexOf('scoreSystem.reset()')).toBeGreaterThan(-1);
    expect(retryBlock.indexOf('ActionEventType.Restart')).toBeGreaterThan(-1);
  });

  it('meta: transición a QUIZ pasando {levelId}', () => {
    expect(source).toContain('transitionTo(this, SceneKey.QUIZ, { levelId: this.level.id })');
  });

  it('pausa: vuelve a Menu guardando progreso (SPEC §6)', () => {
    const pauseBlock = source.slice(source.indexOf('onPause()'));
    expect(pauseBlock.indexOf('setInProgress(true)')).toBeGreaterThan(-1);
    expect(pauseBlock.indexOf('SceneKey.MENU')).toBeGreaterThan(-1);
  });

  it('timeout: sonido timeout() + overlay GAME_OVER dentro de la escena', () => {
    const timeoutBlock = source.slice(source.indexOf('onTimeout()'));
    expect(timeoutBlock.indexOf('audioSystem.timeout()')).toBeGreaterThan(-1);
    expect(timeoutBlock.indexOf('overlay.setVisible(true)')).toBeGreaterThan(-1);
  });

  it('el bonus de tiempo se suma UNA vez al lograr la meta (en su categoría, Etapa 6)', () => {
    const goalBlock = source.slice(source.indexOf('onGoal()'));
    expect(goalBlock.indexOf('timeBonus(this.state.timeLeftMs)')).toBeGreaterThan(-1);
    expect(goalBlock.indexOf('scoreSystem.add(bonus, SCORE_CATEGORY.timeBonus)')).toBeGreaterThan(-1);
  });
});

describe('ActionScene — input multi-touch (CA: 60 taps rápidos no pierden hits)', () => {
  it('arrastra 2 pointers EXTRA con input.addPointer (3 en total)', () => {
    expect(source).toContain('this.input.addPointer(2)');
  });

  it('escucha pointerdown a NIVEL DE ESCENA (un evento POR pointer activo)', () => {
    expect(source).toContain('Phaser.Input.Events.POINTER_DOWN');
    // El hit-test usa coordenadas de MUNDO (válido durante el shake).
    expect(source).toContain('pointer.worldX');
    expect(source).toContain('pointer.worldY');
  });

  it('los taps sobre UI no cuentan como juego (currentlyOver)', () => {
    expect(source).toContain('currentlyOver.length > 0');
  });

  it('Fase 3: la intro del asedio (N3) es skipeable con un tap', () => {
    expect(source).toContain('skipSiegeIntro');
  });
});

describe('ActionScene — feedback del tap (SPEC §4.2/§7.2)', () => {
  it('hit: flash + micro-shake de cámara + «!» + «+10» + sonido compuesto', () => {
    const hitBlock = source.slice(source.indexOf('private onHit('));
    expect(hitBlock.indexOf('cameras.main.flash')).toBeGreaterThan(-1);
    expect(hitBlock.indexOf('cameras.main.shake')).toBeGreaterThan(-1);
    expect(hitBlock.indexOf("'!'")).toBeGreaterThan(-1);
    expect(hitBlock.indexOf("'+10'")).toBeGreaterThan(-1);
    // SPEC §8: tap exitoso = thump + click (composición).
    expect(hitBlock.indexOf('audioSystem.thump()')).toBeGreaterThan(-1);
    expect(hitBlock.indexOf('audioSystem.blip(')).toBeGreaterThan(-1);
  });

  it('REGRESIÓN: la entrada a `falling` llega por INPUT (entre frames) y la caída arranca en onHit', () => {
    // El watcher de update() compara contra el INICIO del frame: si el golpe
    // de meta entra a `falling` desde onPointerDown, previousPhase ya es
    // 'falling' y el watcher nunca dispara. onHit debe detectarlo él mismo
    // (como ya hace con 'goal') y llamar a playFall() sin esperar un tick.
    const hitBlock = source.slice(source.indexOf('private onHit('), source.indexOf('private onJekyllTap('));
    expect(hitBlock).toContain("previousPhase !== 'falling'");
    expect(hitBlock).toContain('this.playFall()');
  });

  it('miss: puff de niebla + noise suave, SIN castigo (no toca el reducer)', () => {
    const start = source.indexOf('private onMiss(');
    const missBlock = source.slice(start, source.indexOf('// ---- Finales de tanda'));
    expect(missBlock.indexOf('spawnPuff')).toBeGreaterThan(-1);
    expect(missBlock.indexOf('audioSystem.noise(')).toBeGreaterThan(-1);
    expect(missBlock).not.toContain('scoreSystem.add');
    expect(missBlock).not.toContain('actionReducer');
  });

  it('Fase 3: swing del bastón (N2) y near-miss con hop de esquiva, sin castigo', () => {
    const sceneBlock = source.slice(source.indexOf('private onHit('));
    expect(sceneBlock.indexOf('playCaneSwing')).toBeGreaterThan(-1);
    expect(source).toContain('onNearMiss');
    expect(source).toContain('NEAR_MISS_HOP');
  });

  it('Fase 3: los taps sobre JEKYLL dan feedback amable y no suman golpes', () => {
    expect(source).toContain('onJekyllTap');
    expect(source).toContain('showJekyllNotice');
    expect(source).toContain('JEKYLL_MISS_NOTICE');
  });

  it('la niña «sale corriendo asustada pero ilesa»: estallido + reaparición', () => {
    const scareBlock = source.slice(source.indexOf('scareGirl()'));
    expect(scareBlock.indexOf('setVisible(false)')).toBeGreaterThan(-1);
    expect(scareBlock.indexOf('initialErraticState')).toBeGreaterThan(-1);
  });

  it('meta 3/3: la niña huye de la pantalla con tween fuera', () => {
    const goalBlock = source.slice(source.indexOf('onGoal()'));
    expect(goalBlock.indexOf('this.tweens.add')).toBeGreaterThan(-1);
    expect(goalBlock.indexOf('fleeX')).toBeGreaterThan(-1);
  });

  it('Fase 3: caída final (N2/N3) y línea de victoria (N2) animadas desde DATOS', () => {
    expect(source).toContain('playFall');
    expect(source).toContain('showVictoryLine');
    expect(source).toContain('playTransformAnimation');
    expect(source).toContain('playEntrance');
  });
});

describe('ActionScene — perf desde el día 1 (PLAN Etapa 4)', () => {
  it('fondo por ParallaxField con la tabla de fondos por mecánica (Fase 3)', () => {
    expect(source).toContain('ParallaxField');
    expect(source).toContain('ACTION_BACKGROUNDS');
  });

  it('pool de puffs acotado (PUFF_POOL_SIZE, sin crear sprites por tap)', () => {
    expect(source).toContain('PUFF_POOL_SIZE');
    expect(source).toContain('buildPuffPool');
    const missBlock = source.slice(source.indexOf('onMiss('));
    expect(missBlock).not.toContain('this.add.image');
  });

  it('dt acotado por frame (ACTION_DT_CAP_MS: un stall no devora el timer)', () => {
    expect(source).toContain('ACTION_DT_CAP_MS');
    expect(source).toContain('Math.min(delta');
  });

  it('contador de FPS debug por ?debug, costo cero apagado', () => {
    expect(source).toContain('debugEnabled');
    expect(source).toContain('this.game.loop.actualFps');
    // El texto NO se crea sin ?debug (return temprano en buildDebugFps).
    const debugBlock = source.slice(source.indexOf('buildDebugFps()'));
    expect(debugBlock.indexOf('if (!debugEnabled(search))')).toBeGreaterThan(-1);
  });

  it('el HUD vive en ui/Hud (contador + timer + puntaje + pausa)', () => {
    expect(source).toContain('new Hud(this');
    expect(source).toContain('hud.setHits');
    expect(source).toContain('hud.setTimeLeft');
  });
});

// ---------------------------------------------------------------------------
// Fase 3 — las REGLAS de las mecánicas nuevas (reducers puros + datos reales
// de level2/level3): el comportamiento que la escena refleja, testeado sin
// Phaser (los fakes estructurales de arriba validan el cableado).
// ---------------------------------------------------------------------------

describe('ActionScene — N2 cane-strike: la tanda de level2 arranca y gana bien', () => {
  const config = level2.action as CaneStrikeActionConfig;
  expect(config.mechanic).toBe('cane-strike');
  const roundConfig = {
    goal: config.goal,
    timeLimitSec: config.timeLimitSec,
    fallMs: 900,
    lineMs: 1600,
  };
  const hit: CaneEvent = { type: 'hit' };

  it('level2 inicia en fase correcta: playing, meta 5/5, timer de 60 s', () => {
    const state = initialCaneState(roundConfig);
    expect(state.phase).toBe(CanePhase.Playing);
    expect(state).toMatchObject({ hits: 0, goal: 5, timeLeftMs: 60000 });
  });

  it('el 5.º bastonazo dispara la caída (falling) con el timer congelado', () => {
    let state = initialCaneState(roundConfig);
    for (let i = 0; i < 4; i++) {
      state = caneReducer(state, hit);
      expect(state.phase).toBe(CanePhase.Playing);
    }
    state = caneReducer(state, hit);
    expect(state.hits).toBe(5);
    expect(state.phase).toBe(CanePhase.Falling);
    expect(state.timeLeftMs).toBe(60000); // congelado para el bonus
    // La secuencia avanza sola: falling → line → goal (→ QUIZ en la escena).
    state = caneReducer(state, { type: 'advance' });
    expect(state.phase).toBe(CanePhase.Line);
    state = caneReducer(state, { type: 'advance' });
    expect(state.phase).toBe(CanePhase.Goal);
  });

  it('el bonus de la meta usa el tiempo congelado (2 pts/s, igual que N1)', () => {
    let state = initialCaneState(roundConfig);
    for (let i = 0; i < 5; i++) state = caneReducer(state, hit);
    state = caneReducer(state, { type: 'tick', dtMs: 20000 });
    expect(state.timeLeftMs).toBe(60000); // en falling el timer NO corre
    state = caneReducer(state, { type: 'advance' });
    state = caneReducer(state, { type: 'advance' });
    expect(state.phase).toBe(CanePhase.Goal);
    expect(timeBonus(state.timeLeftMs)).toBe(120);
  });
});

describe('ActionScene — N3 transform-target: Hyde suma, Jekyll no', () => {
  const config = level3.action as TransformTargetActionConfig;
  expect(config.mechanic).toBe('transform-target');
  const roundConfig = {
    goal: config.goal,
    timeLimitSec: config.timeLimitSec,
    revertMs: config.revertMs,
    fallMs: 900,
  };
  const hit: TransformEvent = { type: 'hit' };
  const start: TransformEvent = { type: 'start' };

  function playingState(): ReturnType<typeof initialTransformState> {
    // intro → start → ready → primer tick → playing (como la escena).
    let state = initialTransformState(roundConfig);
    state = transformReducer(state, start);
    state = transformReducer(state, { type: 'tick', dtMs: 16 });
    expect(state.phase).toBe(TransformPhase.Playing);
    return state;
  }

  it('level3 nace en fase intro (el timer NO corre durante la cinemática)', () => {
    const state = initialTransformState(roundConfig);
    expect(state.phase).toBe(TransformPhase.Intro);
    expect(state.form).toBe(TargetForm.Hyde);
    const afterTicks = transformReducer(state, { type: 'tick', dtMs: 3000 });
    expect(afterTicks.phase).toBe(TransformPhase.Intro);
    expect(afterTicks.timeLeftMs).toBe(90000); // parado
  });

  it('un golpe a Hyde sube el contador y abre la ventana Jekyll EXACTA', () => {
    let state = playingState();
    state = transformReducer(state, hit);
    expect(state.hits).toBe(1);
    expect(state.form).toBe(TargetForm.Jekyll);
    expect(state.revertInMs).toBe(3000); // revertMs de level3, exacto
    state = transformReducer(state, { type: 'tick', dtMs: 2999 });
    expect(state.form).toBe(TargetForm.Jekyll); // aún en ventana
    state = transformReducer(state, { type: 'tick', dtMs: 1 });
    expect(state.form).toBe(TargetForm.Hyde); // revierte a los 3000 ms justos
    expect(state.revertInMs).toBe(0);
  });

  it('un golpe a Jekyll NO sube el contador (miss pedagógico, sin castigo)', () => {
    let state = playingState();
    state = transformReducer(state, hit); // ahora es Jekyll
    const jekyllState = state;
    expect(transformReducer(state, hit)).toBe(jekyllState); // idempotente
    expect(transformReducer(state, { type: 'miss' })).toBe(jekyllState);
    expect(jekyllState.hits).toBe(1);
  });

  it('meta 6/6: Hyde cae (falling) y la tanda termina en goal → QUIZ', () => {
    let state = playingState();
    for (let i = 0; i < 5; i++) {
      state = transformReducer(state, hit);
      state = transformReducer(state, { type: 'tick', dtMs: 3000 }); // ventana fuera
    }
    expect(state.hits).toBe(5);
    state = transformReducer(state, hit);
    expect(state.hits).toBe(6);
    expect(state.phase).toBe(TransformPhase.Falling);
    expect(state.form).toBe(TargetForm.Hyde); // cae SIENDO Hyde
    state = transformReducer(state, { type: 'tick', dtMs: 900 });
    expect(state.phase).toBe(TransformPhase.Goal);
    // Bonus por tiempo, misma fórmula que N1/N2.
    expect(timeBonus(state.timeLeftMs)).toBeGreaterThan(0);
  });
});

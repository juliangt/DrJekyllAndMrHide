/**
 * Etapa 4 — test de ActionScene como CAPA FINA data-driven (estilo tests de
 * game.config: se lee el ARCHIVO como fuente, porque importarlo cargaría
 * Phaser y jsdom no puede). Se valida que la escena CONSUME los módulos
 * puros de gameplay/ y los datos, que arrastra multi-touch, que resetea la
 * tanda al entrar y al reintentar, y que sus dos salidas (QUIZ / MENU) y el
 * overlay GAME_OVER están cableados según SPEC §3/§4.2/§6.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/scenes/ActionScene.ts'), 'utf8');

describe('ActionScene — consume los módulos PUROS de gameplay (arquitectura)', () => {
  it('el estado lo decide el reducer actionReducer (nada de lógica inline)', () => {
    expect(source).toContain('actionReducer');
    expect(source).toContain('initialActionState');
    expect(source).toContain('ActionEventType.Tick');
    expect(source).toContain('ActionEventType.Hit');
    expect(source).toContain('ActionEventType.Restart');
  });

  it('movimiento errático por stepErratic con rng inyectable', () => {
    expect(source).toContain('stepErratic');
    expect(source).toContain('initialErraticState');
  });

  it('hit-test geométrico puro isHit (hitbox +20 %)', () => {
    expect(source).toContain('isHit');
  });

  it('bonus de tiempo por timeBonus y tick sonoro por shouldTick', () => {
    expect(source).toContain('timeBonus');
    expect(source).toContain('shouldTick');
    expect(source).toContain('tickSecond');
  });

  it('layout y textos desde los DATOS de gameplay (sin números mágicos)', () => {
    expect(source).toContain('ACTION_LAYOUT');
    expect(source).toContain('ACTION_FEEDBACK');
    expect(source).toContain('GAME_OVER_OVERLAY');
    expect(source).toContain('GAME_OVER_STYLE');
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
});

describe('ActionScene — feedback del tap (SPEC §4.2/§7.2)', () => {
  it('hit: flash + micro-shake de cámara + «!» + «+10» + sonido compuesto', () => {
    const hitBlock = source.slice(source.indexOf('onHit()'));
    expect(hitBlock.indexOf('cameras.main.flash')).toBeGreaterThan(-1);
    expect(hitBlock.indexOf('cameras.main.shake')).toBeGreaterThan(-1);
    expect(hitBlock.indexOf("'!'")).toBeGreaterThan(-1);
    expect(hitBlock.indexOf("'+10'")).toBeGreaterThan(-1);
    // SPEC §8: tap exitoso = thump + click (composición).
    expect(hitBlock.indexOf('audioSystem.thump()')).toBeGreaterThan(-1);
    expect(hitBlock.indexOf('audioSystem.blip(')).toBeGreaterThan(-1);
  });

  it('miss: puff de niebla + noise suave, SIN castigo (no toca el reducer)', () => {
    const start = source.indexOf('private onMiss(');
    const missBlock = source.slice(start, source.indexOf('// ---- Finales de tanda'));
    expect(missBlock.indexOf('spawnPuff')).toBeGreaterThan(-1);
    expect(missBlock.indexOf('audioSystem.noise(')).toBeGreaterThan(-1);
    expect(missBlock).not.toContain('scoreSystem.add');
    expect(missBlock).not.toContain('actionReducer');
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
});

describe('ActionScene — perf desde el día 1 (PLAN Etapa 4)', () => {
  it('fondo por ParallaxField con la tabla ACTION_PARALLAX_LAYERS', () => {
    expect(source).toContain('ParallaxField');
    expect(source).toContain('ACTION_PARALLAX_LAYERS');
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
